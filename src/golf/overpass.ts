import type { Point } from '../types'
import { distanceMeters } from '../utils/distance'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const SEARCH_RADIUS_METERS = 5_000
const REQUEST_TIMEOUT_MS = 8_000

type OverpassElement = {
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  bounds?: {
    minlat: number
    minlon: number
    maxlat: number
    maxlon: number
  }
  tags?: Record<string, string>
}

type OverpassResponse = {
  elements?: OverpassElement[]
}

export type GolfSuggestion = {
  courseName: string | null
  green: Point | null
  nearbyCourses: NearbyCourse[]
}

export type NearbyCourse = {
  name: string
  distanceMeters: number
}

const lookupCache = new Map<string, Promise<GolfSuggestion>>()

function elementPoint(element: OverpassElement): Point | null {
  const boundsCenter = element.bounds
    ? {
        lat: (element.bounds.minlat + element.bounds.maxlat) / 2,
        lng: (element.bounds.minlon + element.bounds.maxlon) / 2,
      }
    : null
  const lat = element.lat ?? element.center?.lat ?? boundsCenter?.lat
  const lng = element.lon ?? element.center?.lon ?? boundsCenter?.lng
  return typeof lat === 'number' && typeof lng === 'number'
    ? { lat, lng }
    : null
}

function closestElement(
  origin: Point,
  elements: OverpassElement[],
): OverpassElement | null {
  let closest: OverpassElement | null = null
  let closestDistance = Number.POSITIVE_INFINITY

  for (const element of elements) {
    const point = elementPoint(element)
    if (!point) continue
    const distance = distanceMeters(origin, point)
    if (distance < closestDistance) {
      closest = element
      closestDistance = distance
    }
  }

  return closest
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function isInsideBounds(point: Point, element: OverpassElement): boolean {
  const bounds = element.bounds
  if (!bounds) return false
  return (
    point.lat >= bounds.minlat &&
    point.lat <= bounds.maxlat &&
    point.lng >= bounds.minlon &&
    point.lng <= bounds.maxlon
  )
}

export function selectGolfSuggestion(
  origin: Point,
  response: OverpassResponse,
  requestedCourseName = '',
): GolfSuggestion {
  const elements = response.elements ?? []
  const courses = elements.filter(
    (element) => element.tags?.leisure === 'golf_course',
  )
  const greens = elements.filter(
    (element) => element.tags?.golf === 'green',
  )
  const normalizedRequest = normalizeName(requestedCourseName)
  const matchingCourses = normalizedRequest
    ? courses.filter(
        (element) =>
          normalizeName(element.tags?.name ?? '') === normalizedRequest,
      )
    : courses
  const course = closestElement(origin, matchingCourses)
  const eligibleGreens = course
    ? greens.filter((element) => {
        const point = elementPoint(element)
        return point ? isInsideBounds(point, course) : false
      })
    : normalizedRequest
      ? []
      : greens
  const green = closestElement(origin, eligibleGreens)
  const nearbyCourses = courses
    .flatMap((element): NearbyCourse[] => {
      const name = element.tags?.name
      const point = elementPoint(element)
      return name && point
        ? [{ name, distanceMeters: Math.round(distanceMeters(origin, point)) }]
        : []
    })
    .filter(
      (course, index, all) =>
        all.findIndex((candidate) => candidate.name === course.name) === index,
    )
    .toSorted((a, b) => a.distanceMeters - b.distanceMeters)

  return {
    courseName: course?.tags?.name ?? null,
    green: green ? elementPoint(green) : null,
    nearbyCourses,
  }
}

async function requestGolfSuggestion(
  origin: Point,
  courseName: string,
): Promise<GolfSuggestion> {
  const query = `[out:json][timeout:7];(
    nwr(around:${SEARCH_RADIUS_METERS},${origin.lat},${origin.lng})["leisure"="golf_course"];
    nwr(around:${SEARCH_RADIUS_METERS},${origin.lat},${origin.lng})["golf"="green"];
  );out center bb tags;`
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`)
    const data = (await response.json()) as OverpassResponse
    return selectGolfSuggestion(origin, data, courseName)
  } finally {
    window.clearTimeout(timeout)
  }
}

export function findNearbyGolf(
  origin: Point,
  courseName: string,
): Promise<GolfSuggestion> {
  // Roughly 100 m buckets avoid duplicate public API requests at the same spot.
  const cacheKey = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)},${normalizeName(courseName)}`
  const cached = lookupCache.get(cacheKey)
  if (cached) return cached

  const request = requestGolfSuggestion(origin, courseName).catch((error: unknown) => {
    lookupCache.delete(cacheKey)
    throw error
  })
  lookupCache.set(cacheKey, request)
  return request
}

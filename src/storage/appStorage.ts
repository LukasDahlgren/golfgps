import type { AppState, Point } from '../types'

const STORAGE_KEY = 'golf-ruler-state-v1'

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.lat === 'number' &&
    Number.isFinite(candidate.lat) &&
    candidate.lat >= -90 &&
    candidate.lat <= 90 &&
    typeof candidate.lng === 'number' &&
    Number.isFinite(candidate.lng) &&
    candidate.lng >= -180 &&
    candidate.lng <= 180
  )
}

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    isPoint(candidate.pointA) &&
    isPoint(candidate.pointB) &&
    isPoint(candidate.pointC) &&
    typeof candidate.showPointC === 'boolean'
  )
}

export function loadAppState(defaultState: AppState): AppState {
  try {
    const storedState = localStorage.getItem(STORAGE_KEY)
    if (!storedState) return defaultState
    const parsedState: unknown = JSON.parse(storedState)
    return isAppState(parsedState) ? parsedState : defaultState
  } catch {
    return defaultState
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // The app remains usable when storage is unavailable or full.
  }
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import L, { type LeafletEvent, type LeafletMouseEvent } from 'leaflet'
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { findNearbyGolf } from './golf/overpass'
import type { NearbyCourse } from './golf/overpass'
import { loadAppState, saveAppState } from './storage/appStorage'
import type { AppState, Point } from './types'
import { distanceMeters, midpoint } from './utils/distance'
import './App.css'

const DEFAULT_CENTER: Point = { lat: 59.3293, lng: 18.0686 }
const COURSE_STORAGE_KEY = 'golf-ruler-course-v1'
const DEFAULT_COURSE_NAME = 'Ingarö GK'

const DEFAULT_STATE: AppState = {
  pointA: null,
  pointB: null,
  pointC: null,
  showPointC: false,
}

type PointKey = 'pointA' | 'pointB' | 'pointC'
type MarkerLabel = 'A' | 'B' | 'C'

const MARKER_CONTENT: Record<MarkerLabel, string> = {
  A: `<svg class="marker-symbol marker-person" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="5.2" r="2.6" fill="currentColor" />
    <path d="M9.3 10.1c.3-1.5 1.3-2.3 2.7-2.3s2.4.8 2.7 2.3l.7 4.1-2.2.4-.5-3v3.6l2.5 5.1-2.2 1.1-2-4-1.8 4-2.3-1 2.4-5.2v-3.6l-.5 3-2.2-.4.7-4.1Z" fill="currentColor" />
  </svg>`,
  B: `<svg class="marker-symbol marker-pin" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 3v18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    <path d="M9 4h8l-2.4 3L17 10H9Z" fill="currentColor" />
    <path d="M4.5 21h7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
  </svg>`,
  C: '',
}

function markerIcon(label: MarkerLabel) {
  return L.divIcon({
    className: 'ruler-marker-shell',
    html: `<span class="ruler-marker ruler-marker-${label.toLowerCase()}" aria-hidden="true"><span class="marker-badge">${MARKER_CONTENT[label]}</span><span class="marker-stem"></span></span>`,
    iconSize: [54, 62],
    iconAnchor: [27, 58],
  })
}

const MARKER_ICONS = {
  A: markerIcon('A'),
  B: markerIcon('B'),
  C: markerIcon('C'),
}

function distanceLabelIcon(distance: number) {
  return L.divIcon({
    className: 'distance-label-shell',
    html: `<span class="distance-label">${distance} m</span>`,
    iconSize: [72, 32],
    iconAnchor: [36, 16],
  })
}

function RecenterMap({ target }: { target: Point | null }) {
  const map = useMap()

  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 18))
  }, [map, target])

  return null
}

function MapLongPress({ onSelect }: { onSelect: (point: Point) => void }) {
  useMapEvents({
    contextmenu(event: LeafletMouseEvent) {
      event.originalEvent.preventDefault()
      onSelect({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })

  return null
}

function App() {
  const [appState, setAppState] = useState<AppState>(() =>
    loadAppState(DEFAULT_STATE),
  )
  const [recenterTarget, setRecenterTarget] = useState<Point | null>(null)
  const [nearbyCourses, setNearbyCourses] = useState<NearbyCourse[]>([])
  const [lastGpsPoint, setLastGpsPoint] = useState<Point | null>(null)
  const [coursePickerOpen, setCoursePickerOpen] = useState(false)
  const [courseSearch, setCourseSearch] = useState('')
  const [heldPoint, setHeldPoint] = useState<Point | null>(null)
  const [courseName, setCourseName] = useState(() => {
    try {
      return localStorage.getItem(COURSE_STORAGE_KEY) ?? DEFAULT_COURSE_NAME
    } catch {
      return DEFAULT_COURSE_NAME
    }
  })

  useEffect(() => saveAppState(appState), [appState])
  useEffect(() => {
    try {
      localStorage.setItem(COURSE_STORAGE_KEY, courseName)
    } catch {
      // Course selection remains usable when storage is unavailable.
    }
  }, [courseName])

  const updatePoint = useCallback((key: PointKey, point: Point) => {
    setAppState((current) => ({ ...current, [key]: point }))
  }, [])

  const handleMarkerMove = useCallback(
    (key: PointKey) => (event: LeafletEvent) => {
      const { lat, lng } = event.target.getLatLng()
      updatePoint(key, { lat, lng })
    },
    [updatePoint],
  )

  const distances = useMemo(
    () => {
      const { pointA, pointB, pointC } = appState
      if (!pointA || !pointB) return null
      return {
        ab: Math.round(distanceMeters(pointA, pointB)),
        ac: pointC ? Math.round(distanceMeters(pointA, pointC)) : null,
        cb: pointC ? Math.round(distanceMeters(pointC, pointB)) : null,
      }
    },
    [appState],
  )

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLocaleLowerCase()
    return query
      ? nearbyCourses.filter((course) =>
          course.name.toLocaleLowerCase().includes(query),
        )
      : nearbyCourses
  }, [courseSearch, nearbyCourses])
  const lookupGolf = useCallback(
    async (origin: Point, selectedCourse: string) => {
      try {
        const suggestion = await findNearbyGolf(origin, selectedCourse)
        setNearbyCourses(suggestion.nearbyCourses)
      } catch {
        setNearbyCourses([])
      }
    },
    [],
  )

  const selectCourse = useCallback(
    (name: string) => {
      setCourseName(name)
      setCoursePickerOpen(false)
      setCourseSearch('')
      if (lastGpsPoint) void lookupGolf(lastGpsPoint, name)
    },
    [lastGpsPoint, lookupGolf],
  )

  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const nextPoint = { lat: coords.latitude, lng: coords.longitude }
        updatePoint('pointA', nextPoint)
        setLastGpsPoint(nextPoint)
        setRecenterTarget(nextPoint)
        await lookupGolf(nextPoint, courseName)
      },
      (error) => {
        console.error('Could not get current location', error)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    )
  }, [courseName, lookupGolf, updatePoint])

  const clearMeasurement = useCallback(() => {
    setAppState({
      pointA: lastGpsPoint,
      pointB: null,
      pointC: null,
      showPointC: false,
    })
    setHeldPoint(null)
  }, [lastGpsPoint])

  const route =
    appState.pointA && appState.pointB
      ? appState.showPointC && appState.pointC
        ? [appState.pointA, appState.pointC, appState.pointB]
        : [appState.pointA, appState.pointB]
      : null
  const directRoute =
    appState.showPointC && appState.pointA && appState.pointB && appState.pointC
      ? [appState.pointA, appState.pointB]
      : null
  const segmentLabels =
    appState.pointA && appState.pointB && distances
      ? appState.showPointC && appState.pointC
        ? [
        {
          key: 'ab',
          position: midpoint(appState.pointA, appState.pointB),
          distance: distances.ab,
        },
        {
          key: 'ac',
          position: midpoint(appState.pointA, appState.pointC),
          distance: distances.ac ?? 0,
        },
        {
          key: 'cb',
          position: midpoint(appState.pointC, appState.pointB),
          distance: distances.cb ?? 0,
        },
      ]
        : [
        {
          key: 'ab',
          position: midpoint(appState.pointA, appState.pointB),
          distance: distances.ab,
        },
      ]
      : []

  return (
    <main className="app-shell">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={17}
        maxZoom={23}
        zoomControl={false}
        className="map"
      >
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={23}
        />
        {route ? (
          <Polyline positions={route} pathOptions={{ className: 'ruler-line' }} />
        ) : null}
        {directRoute ? (
          <Polyline
            positions={directRoute}
            pathOptions={{ className: 'direct-line' }}
          />
        ) : null}
        {segmentLabels.map((label) => (
          <Marker
            key={label.key}
            position={label.position}
            icon={distanceLabelIcon(label.distance)}
            interactive={false}
            keyboard={false}
            zIndexOffset={500}
          />
        ))}
        {appState.pointA ? (
          <Marker
            position={appState.pointA}
            icon={MARKER_ICONS.A}
            draggable
            eventHandlers={{
              drag: handleMarkerMove('pointA'),
              dragend: handleMarkerMove('pointA'),
            }}
            title="Start point"
          />
        ) : null}
        {appState.pointB ? (
          <Marker
            position={appState.pointB}
            icon={MARKER_ICONS.B}
            draggable
            eventHandlers={{
              drag: handleMarkerMove('pointB'),
              dragend: handleMarkerMove('pointB'),
            }}
            title="Goal"
          />
        ) : null}
        {appState.showPointC && appState.pointC ? (
          <Marker
            position={appState.pointC}
            icon={MARKER_ICONS.C}
            draggable
            eventHandlers={{
              drag: handleMarkerMove('pointC'),
              dragend: handleMarkerMove('pointC'),
            }}
            title="Third point"
          />
        ) : null}
        <RecenterMap target={recenterTarget} />
        <MapLongPress onSelect={setHeldPoint} />
      </MapContainer>

      <div className="course-control">
        <button
          className="course-picker-button"
          type="button"
          onClick={() => setCoursePickerOpen(true)}
        >
          <span>
            <small>Golf course</small>
            {courseName}
          </span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      </div>

      <button
        className="location-fab"
        type="button"
        aria-label="Use my location as A"
        onClick={useCurrentLocation}
      >
        <span aria-hidden="true">▲</span>
      </button>

      {appState.pointA || appState.pointB || appState.pointC ? (
        <button
          className="clear-button"
          type="button"
          onClick={clearMeasurement}
        >
          Clear
        </button>
      ) : null}

      {appState.pointA && appState.pointB ? (
        <button
          className="third-point-fab"
          type="button"
          aria-label={appState.showPointC ? 'Remove third point' : 'Add third point'}
          onClick={() =>
            setAppState((current) =>
              current.showPointC
                ? { ...current, showPointC: false }
                : current.pointA && current.pointB
                  ? {
                      ...current,
                      pointC: midpoint(current.pointA, current.pointB),
                      showPointC: true,
                    }
                  : current,
            )
          }
        >
          <span aria-hidden="true">{appState.showPointC ? '−' : '+'}</span>
        </button>
      ) : null}

      {heldPoint ? (
        <section
          className="point-placement"
          role="dialog"
          aria-modal="true"
          aria-labelledby="point-placement-title"
        >
          <strong id="point-placement-title">Set this position as</strong>
          <div>
            <button
              type="button"
              onClick={() => {
                updatePoint('pointA', heldPoint)
                setHeldPoint(null)
              }}
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => {
                updatePoint('pointB', heldPoint)
                setHeldPoint(null)
              }}
            >
              Goal
            </button>
          </div>
          <button
            className="point-placement-cancel"
            type="button"
            onClick={() => setHeldPoint(null)}
          >
            Cancel
          </button>
        </section>
      ) : null}

      {coursePickerOpen ? (
        <section
          className="course-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-picker-title"
        >
          <header className="course-picker-header">
            <button
              className="course-picker-close"
              type="button"
              aria-label="Close course picker"
              onClick={() => {
                setCoursePickerOpen(false)
                setCourseSearch('')
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 id="course-picker-title">Choose golf course</h1>
              <p>Nearby courses are sorted by distance</p>
            </div>
          </header>

          <label className="course-search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              type="search"
              value={courseSearch}
              onChange={(event) => setCourseSearch(event.target.value)}
              placeholder="Search nearby courses"
              autoFocus
            />
          </label>

          <div className="course-results">
            {filteredCourses.length > 0 ? (
              filteredCourses.map((course, index) => (
                <button
                  className="course-result"
                  type="button"
                  key={course.name}
                  onClick={() => selectCourse(course.name)}
                >
                  <span>
                    <strong>{course.name}</strong>
                    <small>
                      {course.distanceMeters < 1_000
                        ? `${course.distanceMeters} m away`
                        : `${(course.distanceMeters / 1_000).toFixed(1)} km away`}
                      {index === 0 && !courseSearch ? ' · Nearest' : ''}
                    </small>
                  </span>
                  {course.name === courseName ? (
                    <span className="course-selected" aria-label="Selected">✓</span>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 5 7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <div className="course-empty">
                <strong>{nearbyCourses.length ? 'No matching course' : 'Find your location first'}</strong>
                <p>
                  {nearbyCourses.length
                    ? 'Try another search.'
                    : 'Close this page and use the location button to load nearby courses.'}
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App

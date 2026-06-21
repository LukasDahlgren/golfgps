# Golf Ruler Web App — Agent Handoff

## Goal

Build a simple mobile-friendly web app for golf distance measuring.

The app should let the user open a map of a golf hole, drag 2–3 dots around, and instantly see distances in meters between the dots.

This is **not** a full golf GPS/course database app. It is a lightweight “golf map ruler.”

---

## Product Summary

### Core idea

User opens the website on their phone and sees a full-screen map.

They can drag markers/dots around the hole:

- **Point A**: ball/start position
- **Point B**: target/green/hazard
- **Point C**: optional extra point for layup, bunker, carry, etc.

The app shows:

- Distance A → B
- Distance A → C, if point C is enabled
- Distance C → B, if point C is enabled

Distances should be shown in **meters**, rounded to the nearest meter.

---

## Target Platform

This should be a **website/PWA-style app**, not a native iOS app.

The user already has Railway and wants to deploy it there.

Primary usage:

- iPhone Safari
- Added to Home Screen
- Used on a golf course

---

## Recommended Stack

Use:

- Vite
- React
- TypeScript
- Leaflet
- react-leaflet
- CSS modules or normal CSS
- localStorage for persistence

No backend is needed.

Suggested setup:

```bash
npm create vite@latest golf-ruler -- --template react-ts
cd golf-ruler
npm install
npm install leaflet react-leaflet
npm run dev
```

---

## Functional Requirements

### 1. Full-screen map

The main page should show a full-screen interactive map.

Requirements:

- Mobile-first layout
- Map fills the viewport
- Works on iPhone Safari
- Touch drag should feel usable
- Initial map location can default to Stockholm or a configurable default coordinate

Initial default coordinate example:

```ts
const DEFAULT_CENTER = {
  lat: 59.3293,
  lng: 18.0686,
};
```

---

### 2. Draggable points

The app should display at least two draggable markers:

- Point A
- Point B

A third marker should be optional:

- Point C

Requirements:

- Markers must be draggable
- Dragging a marker updates the distance immediately after drag ends
- Marker positions should be stored in React state
- Marker positions should persist to `localStorage`

Recommended state shape:

```ts
type Point = {
  lat: number;
  lng: number;
};

type AppState = {
  pointA: Point;
  pointB: Point;
  pointC?: Point;
  showPointC: boolean;
};
```

---

### 3. Distance calculation

Use the Haversine formula.

Add a utility function:

```ts
export type Point = {
  lat: number;
  lng: number;
};

export function distanceMeters(a: Point, b: Point): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
```

Display rounded values:

```ts
Math.round(distanceMeters(pointA, pointB))
```

---

### 4. Distance display panel

Overlay a small panel above the map.

It should show:

```text
A → B: 146 m
A → C: 212 m
C → B: 83 m
```

If C is disabled, only show:

```text
A → B: 146 m
```

Mobile UI requirements:

- Large readable text
- White or dark translucent background
- Rounded corners
- Fixed to top or bottom
- Should not block too much map area

---

### 5. Lines between points

Draw a line between active measurement points.

Minimum:

- A → B polyline

If C is enabled:

- A → C polyline
- C → B polyline

This makes the measuring feel obvious visually.

---

### 6. Add/remove third point

Add a simple button:

```text
+ Third point
```

When enabled, show point C.

When disabled, hide point C but keep the saved coordinate in state/localStorage.

Button states:

```text
+ Third point
Remove third point
```

---

### 7. Use current location button

Add a button:

```text
Use my location as A
```

Behavior:

- Ask for browser location permission.
- Get current location via `navigator.geolocation.getCurrentPosition`.
- Set Point A to the current location.
- Recenter the map around Point A if possible.

Implementation:

```ts
navigator.geolocation.getCurrentPosition(
  (position) => {
    const point = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
    setPointA(point);
  },
  (error) => {
    console.error(error);
  },
  {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }
);
```

Also display accuracy if available:

```text
GPS accuracy: ±5 m
```

Use:

```ts
position.coords.accuracy
```

---

### 8. Long press / tap to move points

Nice-to-have, but useful.

Possible behavior:

- Tap marker selector: `A`, `B`, or `C`
- Then tap/long-press map to move selected marker there

This is optional for first version. Dragging is enough for MVP.

---

## Map Tiles

### First version

Use standard OpenStreetMap tiles for simplicity:

```tsx
<TileLayer
  attribution="&copy; OpenStreetMap contributors"
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>
```

### Later improvement: satellite map

Golf needs satellite view, but start simple.

Possible satellite providers later:

- Esri World Imagery
- Mapbox
- Google Maps
- MapTiler
- other tile providers

Do not overcomplicate the MVP with billing/API key issues.

---

## Suggested File Structure

```text
golf-ruler/
  src/
    App.tsx
    App.css
    main.tsx
    types.ts
    utils/
      distance.ts
    storage/
      appStorage.ts
```

---

## Implementation Details

### `src/types.ts`

```ts
export type Point = {
  lat: number;
  lng: number;
};

export type AppState = {
  pointA: Point;
  pointB: Point;
  pointC: Point;
  showPointC: boolean;
};
```

---

### `src/utils/distance.ts`

```ts
import type { Point } from "../types";

export function distanceMeters(a: Point, b: Point): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
```

---

### `src/storage/appStorage.ts`

```ts
import type { AppState } from "../types";

const STORAGE_KEY = "golf-ruler-state";

export function loadAppState(defaultState: AppState): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;

    const parsed = JSON.parse(raw) as AppState;

    if (!parsed.pointA || !parsed.pointB || !parsed.pointC) {
      return defaultState;
    }

    return parsed;
  } catch {
    return defaultState;
  }
}

export function saveAppState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

---

## UI Design

Keep it very simple.

Layout:

```text
┌─────────────────────────────┐
│ A → B: 146 m                │
│ A → C: 212 m                │
│ C → B: 83 m                 │
│ GPS accuracy: ±5 m          │
├─────────────────────────────┤
│ [Use my location as A]      │
│ [+ Third point]             │
└─────────────────────────────┘

Full-screen map behind panel.
```

Marker labels should be obvious:

- A
- B
- C

If custom marker styling is annoying in Leaflet, use default markers first.

---

## Railway Deployment

Use Railway static hosting or a normal frontend deployment.

Expected build settings:

```text
Build command: npm run build
Output directory: dist
```

Suggested scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

If Railway needs a start command, use:

```bash
npm run preview -- --host 0.0.0.0 --port $PORT
```

But if using Railway static hosting, serving `dist` directly is preferred.

---

## PWA / Phone Usage

Minimum requirement:

The site should work well in Safari.

Later optional PWA support:

- Add manifest
- Add app icon
- Add mobile viewport meta
- Add theme color

User flow:

1. Deploy to Railway.
2. Open Railway URL in iPhone Safari.
3. Tap Share.
4. Tap Add to Home Screen.
5. Use it like a simple app.

---

## Acceptance Criteria

The MVP is complete when:

- The app runs with `npm run dev`.
- The app builds with `npm run build`.
- A map fills the screen.
- There are two draggable markers.
- The app displays the distance between A and B in meters.
- A line is drawn between A and B.
- A third marker can be toggled on/off.
- When C is enabled, distances A → C and C → B are shown.
- User can set Point A to current GPS location.
- Last marker positions persist after page refresh.
- App works on mobile Safari.
- App can be deployed to Railway.

---

## Non-Goals

Do not build these in the first version:

- User accounts
- Login
- Backend
- Course database
- Scorecard
- Club recommendations
- Shot history
- Apple Watch app
- Payments
- App Store deployment
- Automatic pin positions
- Complex golf statistics

---

## Stretch Features

After MVP, consider:

1. Satellite map layer toggle.
2. Save named courses/holes.
3. One-tap reset to current location.
4. Measure carry and total separately.
5. Club suggestion from manual distances.
6. Offline support for last loaded map area.
7. Installable PWA manifest.
8. Dark mode / outdoor high-contrast mode.
9. Larger draggable handles for use while walking.
10. “Lock map / move dots only” mode.

---

## Important UX Notes

This app will be used outdoors, possibly in sunlight, while walking.

Prioritize:

- Big text
- Big buttons
- Minimal taps
- Fast loading
- No login
- No clutter
- Stable marker dragging
- Meter distances only

Do not make it look like a dashboard. Make it feel like a tool.

---

## First Build Order

Implement in this order:

1. Create Vite React TypeScript app.
2. Add Leaflet map.
3. Add two draggable markers.
4. Add Haversine distance calculation.
5. Add overlay distance panel.
6. Add polyline between markers.
7. Add localStorage persistence.
8. Add third marker toggle.
9. Add current location button.
10. Test on iPhone Safari.
11. Deploy to Railway.

---

## Final Expected Result

A small web app where the user can open a golf hole map, drag 2–3 points around, and instantly measure golf distances in meters from their phone.

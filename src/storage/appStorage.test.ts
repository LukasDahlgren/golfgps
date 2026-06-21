import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import { loadAppState, saveAppState } from './appStorage'

const defaultState: AppState = {
  pointA: null,
  pointB: null,
  pointC: null,
  showPointC: false,
}

describe('appStorage', () => {
  const values = new Map<string, string>()

  beforeEach(() => {
    values.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
  })

  it('round-trips valid app state', () => {
    const saved: AppState = {
      pointA: { lat: 59, lng: 18 },
      pointB: { lat: 59.1, lng: 18.1 },
      pointC: { lat: 59.05, lng: 18.05 },
      showPointC: true,
    }
    saveAppState(saved)
    expect(loadAppState(defaultState)).toEqual(saved)
  })

  it('falls back when persisted coordinates are invalid', () => {
    values.set(
      'golf-ruler-state-v2',
      JSON.stringify({ ...defaultState, pointA: { lat: 200, lng: 18 } }),
    )
    expect(loadAppState(defaultState)).toEqual(defaultState)
  })
})

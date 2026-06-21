import { describe, expect, it } from 'vitest'
import { distanceMeters, midpoint } from './distance'

describe('midpoint', () => {
  it('places a point halfway between two coordinates', () => {
    expect(
      midpoint({ lat: 59.32, lng: 18.06 }, { lat: 59.34, lng: 18.1 }),
    ).toEqual({ lat: 59.33, lng: 18.08 })
  })
})

describe('distanceMeters', () => {
  it('returns zero for the same point', () => {
    const point = { lat: 59.3293, lng: 18.0686 }
    expect(distanceMeters(point, point)).toBe(0)
  })

  it('calculates a known one-degree equatorial distance', () => {
    const distance = distanceMeters(
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
    )
    expect(Math.round(distance)).toBe(111_195)
  })

  it('is symmetric', () => {
    const a = { lat: 59.3293, lng: 18.0686 }
    const b = { lat: 59.3301, lng: 18.0702 }
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 8)
  })
})

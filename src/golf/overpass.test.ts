import { describe, expect, it } from 'vitest'
import { selectGolfSuggestion } from './overpass'

describe('selectGolfSuggestion', () => {
  const origin = { lat: 59.286, lng: 18.459 }

  it('selects the closest course and green', () => {
    const suggestion = selectGolfSuggestion(origin, {
      elements: [
        {
          center: { lat: 59.28, lon: 18.45 },
          bounds: {
            minlat: 59.27,
            minlon: 18.44,
            maxlat: 59.30,
            maxlon: 18.47,
          },
          tags: { leisure: 'golf_course', name: 'Ingarö GK' },
        },
        {
          center: { lat: 59.4, lon: 18.5 },
          tags: { leisure: 'golf_course', name: 'Other course' },
        },
        {
          center: { lat: 59.29, lon: 18.46 },
          tags: { golf: 'green' },
        },
        {
          center: { lat: 59.3, lon: 18.47 },
          tags: { golf: 'green' },
        },
      ],
    }, 'Ingarö GK')

    expect(suggestion).toEqual({
      courseName: 'Ingarö GK',
      green: { lat: 59.29, lng: 18.46 },
      nearbyCourses: [
        { name: 'Ingarö GK', distanceMeters: 840 },
        { name: 'Other course', distanceMeters: 12_888 },
      ],
    })
  })

  it('excludes greens outside the requested course bounds', () => {
    const suggestion = selectGolfSuggestion(origin, {
      elements: [
        {
          center: { lat: 59.286, lon: 18.459 },
          bounds: {
            minlat: 59.27,
            minlon: 18.44,
            maxlat: 59.29,
            maxlon: 18.47,
          },
          tags: { leisure: 'golf_course', name: 'Ingarö GK' },
        },
        {
          center: { lat: 59.305, lon: 18.47 },
          tags: { golf: 'green' },
        },
      ],
    }, 'Ingarö GK')

    expect(suggestion).toEqual({
      courseName: 'Ingarö GK',
      green: null,
      nearbyCourses: [{ name: 'Ingarö GK', distanceMeters: 0 }],
    })
  })

  it('returns empty suggestions for incomplete data', () => {
    expect(selectGolfSuggestion(origin, { elements: [] })).toEqual({
      courseName: null,
      green: null,
      nearbyCourses: [],
    })
  })
})

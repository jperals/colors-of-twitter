const assert = require('assert')
const intersect = require('@turf/intersect').default
const az = require('./az.json')
const land = require('../lib/geojson/land.json')
const turf = require('@turf/helpers')

describe('intersect', () => {
  it('should generate valid GeoJSON using turf.polygon', () => {
    const intersection = intersect(az, land)
    assert.equal(typeof intersection.geometry, 'object')
  })
  it('should generate valid GeoJSON using turf.multiPolygon', () => {
    const multipolygon = turf.multiPolygon([az.geometry.coordinates])
    const intersection = intersect(multipolygon, land)
    assert.equal(typeof intersection.geometry, 'object')
  })
})

describe('Our land GeoJSON', () => {
  it('should have at least 4 points for each linearRing', () => {
    for (const polygon of land.geometry.coordinates) {
      for (const linearRing of polygon) {
        const atLeast4Points = 3 < linearRing.length
        assert(atLeast4Points)
      }
    }
  })
})

describe('Our "az" multipolygon', () => {
  it('should have at least 4 points for each linearRing', () => {
    const multipolygon = turf.multiPolygon([az.geometry.coordinates])
    for (const polygon of multipolygon.geometry.coordinates) {
      for (const linearRing of polygon) {
        const atLeast4Points = 3 < linearRing.length
        assert(atLeast4Points)
      }
    }
  })
})

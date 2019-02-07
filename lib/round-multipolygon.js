const defaultDecimals = 3

const {nDecimals} = require('./math')

function roundMultiPolygon(multipolygon, decimals = defaultDecimals) {
  for (const index in multipolygon.geometry.coordinates) {
    multipolygon.geometry.coordinates[index] = roundPolygon(multipolygon.geometry.coordinates[index], decimals)
  }
  return multipolygon
}


function roundPolygon(polygon, decimals = defaultDecimals) {
  for (const linearRing of polygon) {
    // Sometimes Turf.js uses the same point object when their
    // coordinates are the same.
    // Avoid modifying them twice by creating new objects.
    for (const pointIndex in linearRing) {
      const newPoint = []
      if(!(linearRing[pointIndex] instanceof Array)) {
        continue
      }
      for (const coordinate of linearRing[pointIndex]) {
        newPoint.push(nDecimals(coordinate, decimals))
      }
      linearRing[pointIndex] = newPoint
    }
  }
  return polygon
}

module.exports = {
  roundMultiPolygon
}

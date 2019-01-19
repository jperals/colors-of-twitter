const scaleFactor = 1000000

function scaleMultiPolygon(multipolygon, factor = scaleFactor) {
  for (const index in multipolygon.geometry.coordinates) {
    multipolygon.geometry.coordinates[index] = scalePolygon(multipolygon.geometry.coordinates[index], factor)
  }
  return multipolygon
}


function scalePolygon(polygon, factor = scaleFactor) {
  for (const linearRing of polygon) {
    // Sometimes Turf.js uses the same point object when their
    // coordinates are the same.
    // Avoid scaling them twice by creating new objects.
    for (const pointIndex in linearRing) {
      const newPoint = []
      if(!(linearRing[pointIndex] instanceof Array)) {
        continue
      }
      for (const coordinate of linearRing[pointIndex]) {
        newPoint.push(coordinate * factor)
      }
      linearRing[pointIndex] = newPoint
    }
  }
  return polygon
}

module.exports = {
  scaleMultiPolygon
}

require('dotenv').config()

const land = require('./geojson/land')
const sea = require('./geojson/sea')
const jsonfile = require('jsonfile')
const ProgressBar = require('progress')
const {roundMultiPolygon} = require('./round-multipolygon')
const {scaleMultiPolygon} = require('./scale')
const turf = require('@turf/helpers')
const difference = require('@turf/difference')
const intersect = require('@turf/intersect').default
const polygonUnion = require('@turf/union').default

// We might scale coordinates up before performing calculations
// in order to prevent precision-related errors,
// and scale them back down afterwards.
const scaleFactor = 1

const decimals = !isNaN(process.env.DECIMALS) === 'undefined' ? 4 : Number(process.env.DECIMALS)

module.exports = geoJsonFileFormVoronoiDiagram

function geoJsonFileFormVoronoiDiagram(voronoiDiagram) {
  return new Promise(resolve => resolve(voronoiDiagram))
    .then(voronoiDiagramToGroupedMultipolygons)
    .then(intersectWithLand)
    .then(groupedMultipolygonsToSingleFeatureCollection)
    .then(scaleMultipolygonFeatureCollectionDown)
    .then(roundMultiPolygonFeatureColletion)
    .then(saveGeojson)
}

function voronoiDiagramToGroupedMultipolygons(diagram) {
  console.log('Grouping diagram cells of the same language into GeoJson multipolygons... This might take a while.')
  const progressBar = new ProgressBar(':languageCode :bar :percent | :current/:total | ETA: :etas', {
    complete: '█',
    incomplete: '░',
    total: diagram.cells.length
  })
  const cellGroups = {}
  for (const cell of diagram.cells) {
    const languageCode = cell.site.language
    if (!cellGroups.hasOwnProperty(languageCode)) {
      cellGroups[languageCode] = new Set()
    }
    cellGroups[languageCode].add(cell)
  }
  const polygonGroups = {}
  let nPolygons = 0
  for (const key in cellGroups) {
    const cellGroup = cellGroups[key]
    const polygons = []
    const cells = cellGroup.values()
    for (const cell of cells) {
      polygons.push(voronoiCellToGeojsonPolygon(cell))
      nPolygons += 1
    }
    let union
    for (const polygon of polygons) {
      if (union) {
        union = polygonUnion(union, polygon)
      } else {
        union = polygon
      }
    }
    progressBar.tick(polygons.length, {
      languageCode: key
    })
    polygonGroups[key] = union
  }
  return polygonGroups
}

function intersectWithLand(polygonGroups) {
  console.log('The map will contain', Object.keys(polygonGroups).length.toLocaleString(), 'different languages.')
  console.log("Cutting off the sea from the land for each language multipolygon...")
  const scaledUpLand = scaleMultiPolygon(land, scaleFactor)
  const progressBar = new ProgressBar(':languageCode :bar :percent | :current/:total | ETA: :etas', {
    complete: '█',
    incomplete: '░',
    total: Object.keys(polygonGroups).length
  })
  const keys = Object.keys(polygonGroups)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const multiPolygon = polygonGroups[key]
    let newPolygon
    try {
      newPolygon = intersect(multiPolygon, scaledUpLand)
    } catch (e) {
      console.warn('There was a problem with a polygon of this language:', key)
      jsonfile.writeFile('./output/error-intersect-' + key + '.json', multiPolygon, {spaces: 2})
      jsonfile.writeFile('./output/error-intersect-new-polygon-' + key + '.json', newPolygon, {spaces: 2})
      console.error(e)
      newPolygon = multiPolygon
    }
    try {
      if(false && key !== 'ms' && key !== 'ar' && key !== 'fr') {
        newPolygon = difference(newPolygon, sea)
      }
    } catch (e) {
      console.warn('There was a problem with a polygon of this language:', key)
      jsonfile.writeFile('./output/error-difference-' + key + '.json', multiPolygon, {spaces: 2})
      fs.writeFileSync('./output/error-difference-new-polygon-' + key + '.json', newPolygon)
      console.error(e)
    }
    if (newPolygon) {
      polygonGroups[key] = newPolygon
    } else {
      // All in the sea?
      delete polygonGroups[key]
    }
    progressBar.tick({
      languageCode: i < keys.length - 1 ? keys[i + 1] : key
    })
  }
  return polygonGroups
}

function voronoiCellToGeojsonPolygon(cell) {
  const rawPoints = []
  for (const halfEdge of cell.halfedges) {
    rawPoints.push(pointFromHalfEdge(halfEdge))
  }
  // We need to add the initial point again as last point
  // for Turf to create the polygon
  rawPoints.push(pointFromHalfEdge(cell.halfedges[0]))
  return turf.polygon([rawPoints])
}

function pointFromHalfEdge(halfEdge) {
  const vertex = halfEdge.getStartpoint()
  return [vertex.x, vertex.y]
}

function groupedMultipolygonsToSingleFeatureCollection(groups) {
  const features = []
  for (const key in groups) {
    const feature = groups[key]
    if (typeof feature.properties !== 'object') {
      feature.properties = {}
    }
    feature.properties.language = key
    features.push(feature)
  }
  return {
    type: 'FeatureCollection',
    features
  }
}

function roundMultiPolygonFeatureColletion(featureCollection, decimals) {
  for (const multiPolygon of featureCollection.features) {
    roundMultiPolygon(multiPolygon, decimals)
  }
  return featureCollection
}

function scaleMultipolygonFeatureCollection(featureCollection, factor = scaleFactor) {
  for (const multipolygon of featureCollection.features) {
    scaleMultiPolygon(multipolygon, factor)
  }
  return featureCollection
}

function scaleMultipolygonFeatureCollectionDown(geoJson) {
  return scaleMultipolygonFeatureCollection(geoJson, 1 / scaleFactor)
}

function saveGeojson(geoJson) {
  return jsonfile.writeFile('./output/language-areas.json', geoJson)
}

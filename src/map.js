require('dotenv').config()

const {connectToDatabase, finish, handleRejection} = require('./common.js')
const {doInBatches} = require('./db')
const {getLanguageFences} = require('./fences')
const land = require('./geojson/land')
const sea = require('./geojson/sea')
const jsonfile = require('jsonfile')
const parseArgs = require('minimist')
const ProgressBar = require('progress')
const {scaleMultiPolygon} = require('./scale')
const pointInPolygon = require('@turf/boolean-point-in-polygon').default
const turf = require('@turf/helpers')
const difference = require('@turf/difference')
const intersect = require('@turf/intersect').default
const polygonUnion = require('@turf/union').default
const Voronoi = require('voronoi')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)

// Minimum tweets collected per location in order to include it in the map
const minTweets = 3
// Minimum number of tweets in relation to number of languages for each location
const minTweetsPerNumberOfLanguages = 1.5

// We scale coordinates up before performing calculations
// in order to prevent precision-related errors,
// and scale them back down afterwards.
const scaleFactor = 1

let excludedLanguages

const languageIdentificationEngine = 'cld'

connectToDatabase()
  .catch(handleRejection)
  .then(getCollection)
  .then(addVoronoiSites)
  .then(scaleVoronoiSitesUp)
  .then(computeVoronoiDiagram)
  .then(voronoiDiagramToGroupedMultipolygons)
  .then(intersectWithLand)
  .then(groupedMultipolygonsToSingleFeatureCollection)
  .then(scaleMultipolygonFeatureCollectionDown)
  .then(saveGeojson)
  .then(finish)

function getCollection(db) {
  const excludedLanguagesStr = parseArgs(process.argv.slice(2)).exclude || process.env.EXCLUDE_LANGUAGES
  if (excludedLanguagesStr) {
    excludedLanguages = excludedLanguagesStr.split(',')
    if (excludedLanguages && excludedLanguages.length) {
      console.log('Excluding languages:', excludedLanguages.join(', '))
    }
  }
  console.log('Connected to the database')
  return db.collection(process.env.COLLECTION_LOCATIONS)
}

function addVoronoiSites(collection) {
  const sites = []
  return doInBatches(({record}) => {
    addVoronoiSite(sites, record)
  }, {collection, batchSize, limit, message: 'Retrieving records...'})
    .then(() => {
      console.log('Added', sites.length.toLocaleString(), 'Voronoi sites.')
      return sites
    })
}

function scaleVoronoiSitesUp(sites, factor = scaleFactor) {
  for (const site of sites) {
    site.x *= factor
    site.y *= factor
  }
  return sites
}

function addVoronoiSite(sites, item) {
  const coordinates = getRecordMiddlePointCoordinate(item)
  return getLanguage(item)
    .then(languageCode => {
      if (languageCode) {
        sites.push({
          x: coordinates.lng,
          y: coordinates.lat,
          language: languageCode
        })
      }
      return sites
    })
    .catch(() => {
      return sites
    })
}

function computeVoronoiDiagram(sites) {
  console.log('Computing Voronoi diagram...')
  const boundingBox = {
    xl: -180 * scaleFactor,
    xr: 180 * scaleFactor,
    yt: -90 * scaleFactor,
    yb: 90 * scaleFactor
  }
  const voronoi = new Voronoi()
  const diagram = voronoi.compute(sites, boundingBox)
  console.log('Computed Voronoi diagram in', diagram.execTime.toLocaleString(), 'milliseconds.')
  console.log('Computed', diagram.vertices.length.toLocaleString(), 'vertices,', diagram.edges.length.toLocaleString(), 'edges and', diagram.cells.length.toLocaleString(), 'cells.')
  return diagram
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
      if(key !== 'ms' && key !== 'ar' && key !== 'fr') {
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
  return jsonfile.writeFile('./output/language-areas.json', geoJson, {spaces: 2})
}

function getLanguage(record) {
  if (!hasEnoughData(record)) return new Promise((resolve) => resolve())
  const languageData = record.languageData[languageIdentificationEngine]
  const mainLanguage = getRecordMainLanguage(record)
  const coordinateLatLng = getRecordMiddlePointCoordinate(record)
  const coordinateXY = [coordinateLatLng.lng, coordinateLatLng.lat]
  return isOutsideItsFences(coordinateXY, mainLanguage)
    .then(isOutside => {
      if (!isExcluded(mainLanguage) && !isOutside) {
        return mainLanguage
      } else {
        // Find an alternative language from the list of detected
        // languages for this location
        const languagesObj = languageData.languages
        // Sort them by score and return the first viable one
        const languageCodesSorted = Object.keys(languagesObj).sort((key1, key2) => languagesObj[key2].score - languagesObj[key1].score)
        return getAlternativeLanguage({coordinateXY, languageCodes: languageCodesSorted})
      }
    })
}

function getAlternativeLanguage({coordinateXY, languageCodes, index = 0}) {
  const languageCode = languageCodes[index]
  if (languageCodes.length <= index) {
    // No viable alternative was found
    return
  }
  if (isExcluded(languageCode)) {
    // Try the next one
    return getAlternativeLanguage({coordinateXY, languageCodes, index: index + 1})
  } else {
    return isOutsideItsFences(coordinateXY, languageCode)
      .then(isOutside => {
        if (isOutside) {
          // Try the next one
          return getAlternativeLanguage({coordinateXY, languageCodes, index: index + 1})
        } else {
          // Good alternative
          return languageCode
        }
      })
  }
}

function getRecordBoundingBox(dbRecord) {
  const array = dbRecord.boundingBoxId.split(',').map(str => Number(str))
  const matrix = [[array[0], array[1]], [array[2], array[3]], [array[4], array[5]], [array[6], array[7]]]
  return matrix
}

function getRecordMiddlePointCoordinate(dbRecord) {
  const boundingBox = getRecordBoundingBox(dbRecord)
  if (!boundingBox) return
  const lng = (boundingBox[0][0] + boundingBox[2][0]) / 2
  const lat = (boundingBox[0][1] + boundingBox[2][1]) / 2
  return {lat, lng}
}

function hasEnoughData(record) {
  if (!record.nTweets || record.nTweets >= minTweets) return true
  else if (record.nTweets === minTweets) {
    const languageData = record.languageData[languageIdentificationEngine]
    const languagesObj = languageData.languages
    const languageKeys = Object.keys(languagesObj)
    return record.nTweets > 1 && record.nTweets / languageKeys.length > minTweetsPerNumberOfLanguages
  }
  return false
}

function isOutsideItsFences(coordinate, languageCode) {
  return getLanguageFences(languageCode)
    .then(fences => {
      for (const feature of fences.features) {
        const point = turf.point(coordinate)
        if (feature.geometry && feature.geometry.type === 'Polygon' && pointInPolygon(point, feature)) {
          return false
        }
      }
      return true
    })
    .catch((err) => {
      return false
    })
}

function getRecordMainLanguage(record) {
  return record.languageData[languageIdentificationEngine].mainLanguage
}

function isExcluded(language) {
  return excludedLanguages && excludedLanguages.length && excludedLanguages.indexOf(language) !== -1
}

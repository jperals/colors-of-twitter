require('dotenv').config()
const {doInBatches} = require('./db')
const {getLanguageFences} = require('./fences')
const parseArgs = require('minimist')
const pointInPolygon = require('@turf/boolean-point-in-polygon').default
const turf = require('@turf/helpers')
const Voronoi = require('voronoi')
const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)

// Minimum tweets collected per location in order to include it in the map
const minTweets = Number(process.env.MIN_TWEETS) || 0

// We might scale coordinates up before performing calculations
// in order to prevent precision-related errors,
// and scale them back down afterwards.
// This seems to prevent this error:
// https://github.com/gorhill/Javascript-Voronoi/issues/15
// https://github.com/gorhill/Javascript-Voronoi/issues/27
const scaleFactor = Number(process.env.SCALE_FACTOR) || 1e6

const languageDetectionEngine = 'cld'

// 👇 Possible values for `mainLanguageCriterion`: 'times' or 'score'
// 'times' refers to how many times a language was detected for each location;
// 'score' is the aggregated score of the language in that location.
const mainLanguageCriterion = 'times'

const { excludedLanguages, isExcluded } = require('./languages')
if (excludedLanguages && excludedLanguages.length) {
  console.log('Excluding languages:', excludedLanguages.join(', '))
}

const args = parseArgs(process.argv.slice(2))

const ignoreFences = Boolean(args.raw)

module.exports = generateVoronoiMap

function getCollection(db) {
  return db.collection(process.env.COLLECTION_LOCATIONS)
}

function generateVoronoiMap(collections) {
  return new Promise((resolve) => resolve(collections))
    .then(getCollection)
    .then(addVoronoiSites)
    .then(scaleVoronoiSitesUp)
    .then(computeVoronoiDiagram)
    .then(scaleVoronoiDiagramDown)
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

function scaleVoronoiDiagramDown(diagram, factor = scaleFactor) {
  const set = new Set()
  for(cell of diagram.cells) {
    for(halfEdge of cell.halfedges) {
      set.add(halfEdge.site)
      set.add(halfEdge.edge.va)
      set.add(halfEdge.edge.vb)
      set.add(halfEdge.getStartpoint())
    }
  }
  for(object of Array.from(set)) {
    object.x /= scaleFactor
    object.y /= scaleFactor
  }
  return diagram
}

function addVoronoiSite(sites, item) {
  const coordinates = getRecordMiddlePointCoordinate(item)
  return getMainLanguage(item)
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

function getMainLanguage(record) {
  if (!hasEnoughData(record)) return new Promise((resolve) => resolve())
  const languageData = record.languageData[languageDetectionEngine]
  const languagesObj = languageData.languages
  // Sort them by our main language criterion (time or score)
  const languageCodesSorted = Object.keys(languagesObj).sort((key1, key2) => languagesObj[key2][mainLanguageCriterion] - languagesObj[key1][mainLanguageCriterion])
  const coordinateLatLng = getRecordMiddlePointCoordinate(record)
  const coordinateXY = [coordinateLatLng.lng, coordinateLatLng.lat]
  return getMainLanguageRefined({coordinateXY, languageCodes: languageCodesSorted})
}

function getMainLanguageRefined({coordinateXY, languageCodes, index = 0}) {
  const languageCode = languageCodes[index]
  if (languageCodes.length <= index) {
    // No viable alternative was found
    return new Promise((resolve) => resolve())
  }
  if (isExcluded(languageCode)) {
    // Try the next one
    return getMainLanguageRefined({coordinateXY, languageCodes, index: index + 1})
  } else {
    return isOutsideItsFences(coordinateXY, languageCode)
      .then(isOutside => {
        if (isOutside) {
          // Try the next one
          return getMainLanguageRefined({coordinateXY, languageCodes, index: index + 1})
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
  return record.nTweets >= minTweets
}

function isOutsideItsFences(coordinate, languageCode) {
  if (ignoreFences) {
    return new Promise(resolve => resolve(false))
  }
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

const {doInBatches} = require('./db')
const {getLanguageFences} = require('./fences')
const parseArgs = require('minimist')
const pointInPolygon = require('@turf/boolean-point-in-polygon').default
const turf = require('@turf/helpers')
const Voronoi = require('voronoi')
const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)

// Minimum tweets collected per location in order to include it in the map
const minTweets = 500
// Minimum number of tweets in relation to number of languages for each location
const minTweetsPerNumberOfLanguages = 1.5

// We might scale coordinates up before performing calculations
// in order to prevent precision-related errors,
// and scale them back down afterwards.
const scaleFactor = 1

const languageDetectionEngine = 'cld'

let excludedLanguages

module.exports = generateVoronoiMap

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

function generateVoronoiMap(collections) {
  return new Promise((resolve) => resolve(collections))
    .then(getCollection)
    .then(addVoronoiSites)
    .then(scaleVoronoiSitesUp)
    .then(computeVoronoiDiagram)
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

function getLanguage(record) {
  if (!hasEnoughData(record)) return new Promise((resolve) => resolve())
  const languageData = record.languageData[languageDetectionEngine]
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
    const languageData = record.languageData[languageDetectionEngine]
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
  return record.languageData[languageDetectionEngine].mainLanguage
}

function isExcluded(language) {
  return excludedLanguages && excludedLanguages.length && excludedLanguages.indexOf(language) !== -1
}


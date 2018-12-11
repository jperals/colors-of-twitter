require('dotenv').config()

const {createCanvas} = require('canvas')
const {connectToDatabase, finish, handleRejection} = require('./common.js')
const {doInBatches} = require('./db')
const {getLanguageFences} = require('./fences')
const fs = require('fs')
const languageColor = require('./language-color')
const leftPad = require('left-pad')
const parseArgs = require('minimist')
const pointInPolygon = require('@turf/boolean-point-in-polygon').default
const turf = require('@turf/helpers')
const Voronoi = require('voronoi')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)
// Minimum tweets collected per location in order to include it in the map
const minTweets = 2
// Minimum number of tweets in relation to number of languages for each location
const minTweetsPerNumberOfLanguages = 1.5
const width = Number(process.env.WIDTH)
const height = Number(process.env.HEIGHT)
let excludedLanguages

const canvas = createCanvas(width, height)
const languageIdentificationEngine = 'cld'
let drawnItems = 0

connectToDatabase()
  .catch(handleRejection)
  .then(getCollection)
  .then(addPoints)
  .then(computeVoronoiDiagram)
  .then(drawToCanvas)
  .then(exportPng)
  .then(finish)

function getCollection(client) {
  const db = client.db(process.env.DATABASE_NAME)
  const excludedLanguagesStr = parseArgs(process.argv.slice(2)).exclude
  if (excludedLanguagesStr) {
    excludedLanguages = excludedLanguagesStr.split(',')
    if (excludedLanguages && excludedLanguages.length) {
      console.log('Excluding languages:', excludedLanguages.join(', '))
    }
  }
  console.log('Connected to the database')
  return db.collection(process.env.COLLECTION_LOCATIONS)
}

function addPoints(collection) {
  const sites = []
  return doInBatches(({record}) => {
    addVoronoiSite(sites, record)
  }, {collection, batchSize, limit, message: 'Retrieving records...'})
    .then(() => {
      console.log('Added', sites.length, 'Voronoi sites.')
      return sites
    })
}

function addVoronoiSite(sites, item) {
  const coordinates = getRecordMiddlePointCoordinate(item)
  return getColor(item)
    .then(color => {
      if (color) {
        sites.push({
          x: coordinates.lng,
          y: coordinates.lat,
          color
        })
        drawnItems += 1
      }
      return sites
    })
}

function computeVoronoiDiagram(sites) {
  console.log('Computing Voronoi diagram...')
  const boundingBox = {
    xl: -180,
    xr: 180,
    yt: -90,
    yb: 90
  }
  const voronoi = new Voronoi()
  const diagram = voronoi.compute(sites, boundingBox)
  console.log('Computed Voronoi diagram in', diagram.execTime, 'milliseconds.')
  console.log('Computed', diagram.vertices.length, 'vertices,', diagram.edges.length, 'edges and', diagram.cells.length, 'cells.')
  return diagram
}

function drawToCanvas(diagram) {
  const ctx = canvas.getContext('2d')
  const factorX = width / 360
  const factorY = height / 180
  for (const cell of diagram.cells) {
    if (!cell.halfedges.length) continue
    ctx.fillStyle = cell.site.color
    ctx.beginPath()
    const firstVertex = cell.halfedges[0].getStartpoint()
    ctx.moveTo((firstVertex.x + 180) * factorX, height - (firstVertex.y + 90) * factorY)
    for (let i = 1; i < cell.halfedges.length; i++) {
      const halfEdge = cell.halfedges[i]
      const vertex = halfEdge.getStartpoint()
      ctx.lineTo((vertex.x + 180) * factorX, height - (vertex.y + 90) * factorY)
    }
    ctx.closePath()
    ctx.fill()
  }
  return diagram
}

function exportPng(diagram) {
  const nPoints = diagram.cells.length
  return new Promise((resolve, reject) => {
    const fileName = getFileName(nPoints)
    console.log('Drawing to file:', fileName)
    const out = fs.createWriteStream(fileName)
    const stream = canvas.createPNGStream()
    stream.pipe(out)
    out.on('finish', resolve)
  })
}

function getFileName(nPoints) {
  const now = new Date()
  let fileName = now.getFullYear() + '' + leftPad((now.getMonth() + 1), 2, '0') + '' + leftPad(now.getDate(), 2, '0') + '-' + now.getTime()
  if (typeof nPoints !== 'undefined') {
    fileName += '-' + nPoints + 'points'
  }
  return './output/map-' + fileName + '.png'
}

function getColor(record) {
  return getLanguage(record)
    .then(languageCode => {
      if (!languageCode) return
      return languageColor(languageCode)
    })
    .catch((err) => {
      return
    })
}

function getLanguage(record) {
  if (!hasEnoughData(record)) return new Promise((resolve) => resolve())
  const languageData = record.languageData[languageIdentificationEngine]
  const mainLanguage = languageData.mainLanguage
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

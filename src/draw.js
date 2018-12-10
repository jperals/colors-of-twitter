require('dotenv').config()

const {createCanvas} = require('canvas')
const {doInBatches} = require('./db')
const {connectToDatabase, finish, handleRejection} = require('./common.js')
const fs = require('fs')
const languageColor = require('./language-color')
const leftPad = require('left-pad')
const parseArgs = require('minimist')
const Voronoi = require('voronoi')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)
// Minimum tweets collected per location in order to include it in the map
const minTweets = 0
// Mininum number of tweets in relation of number of languages for each location
const minTweetsPerNumberOfLanguages = 1.5
const width = Number(process.env.WIDTH)
const height = Number(process.env.HEIGHT)
let excludedLanguages

const canvas = createCanvas(width, height)
const ctx = canvas.getContext('2d')
const languageIdentificationEngine = 'cld'
let drawnItems = 0

connectToDatabase()
  .catch(handleRejection)
  .then(generateVoronoiDiagram)
  .then(drawToFile)
  .then(finish)

function generateVoronoiDiagram(client) {
  const db = client.db(process.env.DATABASE_NAME)
  const excludedLanguagesStr = parseArgs(process.argv.slice(2)).exclude
  if (excludedLanguagesStr) {
    excludedLanguages = excludedLanguagesStr.split(',')
    if (excludedLanguages && excludedLanguages.length) {
      console.log('Excluding languages:', excludedLanguages.join(', '))
    }
  }
  console.log('Connected to the database')
  const collection = db.collection(process.env.COLLECTION_LOCATIONS)
  return addVoronoiSites({collection, ctx, batchSize, limit})
}

function addVoronoiSites({collection, batchSize, limit}) {
  const sites = []
  return new Promise((resolve) => {
    doInBatches(({record}) => {
      addVoronoiSite(sites, record)
    }, {collection, batchSize, limit, message: 'Retrieving records...'})
      .then(() => {
        resolve(sites)
      })
  })
}

function addVoronoiSite(sites, item) {
  const coordinates = getRecordMiddlePointCoordinate(item)
  const color = getColor(item)
  if (color) {
    sites.push({
      x: coordinates.lng,
      y: coordinates.lat,
      color
    })
    drawnItems += 1
  }
  return sites
}

function drawToFile(voronoiSites) {
  console.log('Added', voronoiSites.length, 'Voronoi sites.')
  console.log('Computing Voronoi diagram...')
  const diagram = computeVoronoiDiagram(voronoiSites)
  console.log('Computing Voronoi diagram in', diagram.execTime, 'milliseconds.')
  console.log('Computed', diagram.vertices.length, 'vertices,', diagram.edges.length, 'edges and', diagram.cells.length, 'cells.')
  drawVoronoiDiagram(ctx, diagram)
  return exportPng(canvas, voronoiSites.length)
}

function computeVoronoiDiagram(sites) {
  const boundingBox = {
    xl: -180,
    xr: 180,
    yt: -90,
    yb: 90
  }
  const voronoi = new Voronoi()
  const diagram = voronoi.compute(sites, boundingBox)
  return diagram
}

function drawVoronoiDiagram(ctx, diagram) {
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
}

function exportPng(canvas, nPoints) {
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
  try {
    const languageCode = getLanguage(record)
    if (!languageCode) return
    return languageColor(languageCode)
  } catch (e) {
    return
  }
}

function getLanguage(record) {
  if(!hasEnoughData(record)) return
  const languageData = record.languageData[languageIdentificationEngine]
  const mainLanguage = languageData.mainLanguage
  if (excludedLanguages && excludedLanguages.length && excludedLanguages.indexOf(mainLanguage) !== -1) {
    const languagesObj = languageData.languages
    const languageCodesSorted = Object.keys(languagesObj).sort((key1, key2) => languagesObj[key2].score - languagesObj[key1].score)
    for (const languageCode of languageCodesSorted) {
      if (excludedLanguages.indexOf(languageCode) === -1) {
        return languageCode
      }
    }
    return
  } else {
    return mainLanguage
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

function getRecordPixelPosition(dbRecord) {
  const coords = getRecordMiddlePointCoordinate(dbRecord)
  if (!coords) return
  const x = (width / 2) + (width / 2) * coords.lng / 180
  const y = (height / 2) - (height / 2) * coords.lat / 90
  return {x, y}
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
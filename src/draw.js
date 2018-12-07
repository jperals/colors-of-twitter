require('dotenv').config()

const {createCanvas} = require('canvas')
const {connectToDatabase, finish, handleRejection} = require('./common.js')
const fs = require('fs')
const languageColor = require('./language-color')
const leftPad = require('left-pad')
const parseArgs = require('minimist')
const Voronoi = require('voronoi')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)
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
  {
    const db = client.db(process.env.DATABASE_NAME)
    const excludedLanguagesStr = parseArgs(process.argv.slice(2)).exclude
    if (excludedLanguagesStr) {
      excludedLanguages = excludedLanguagesStr.split(',')
      if (excludedLanguages && excludedLanguages.length) {
        console.log('Excluding languages:', excludedLanguages.join(', '))
      }
    }
    console.log('Connected to the database')
    console.log('Retrieving and drawing records...')
    const collection = db.collection(process.env.COLLECTION_LOCATIONS)
    return addVoronoiSites({collection, ctx, batchSize, limit})
  }
}

function addVoronoiSites({collection, batchSize, limit, added = 0, sites = [], startFromId}) {
  return new Promise((resolve, reject) => {
    getRecordBatch({collection, id: startFromId, batchSize})
      .catch(err => {
        reject(err)
      })
      .then(batchItems => {
        addVoronoiSiteBatch(sites, batchItems)
        added += batchItems.length
        if (batchItems.length && added < limit) {
          const startFromId = batchItems[batchItems.length - 1]._id
          resolve(addVoronoiSites({collection, batchSize, limit, added, startFromId, sites}))
        } else {
          resolve(sites)
        }
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
}

function addVoronoiSiteBatch(sites, items) {
  process.stdout.write('.')
  for (const item of items) {
    addVoronoiSite(sites, item)
  }
}

function drawToFile(voronoiSites) {
  {
    console.log('\nAdded', voronoiSites.length, 'Voronoi sites.')
    const diagram = computeVoronoiDiagram(voronoiSites)
    console.log('Calculated Voronoi diagram in', diagram.execTime, 'milliseconds.')
    console.log('Computed', diagram.vertices.length, 'vertices,', diagram.edges.length, 'edges and', diagram.cells.length, 'cells.')
    drawVoronoiDiagram(ctx, diagram)
    return exportPng(canvas, voronoiSites.length)
  }
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

function draw(ctx, items) {
  for (const item of items) {
    try {
      const pixelPosition = getRecordPixelPosition(item)
      const color = getColor(item)
      if (!pixelPosition || !color) continue
      ctx.fillStyle = color
      ctx.fillRect(pixelPosition.x, pixelPosition.y, 1, 1)
      drawnItems += 1
    } catch (e) {
      console.error(e)
    }
  }
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

function getRecordBatch({collection, id, batchSize}) {
  return new Promise((resolve, reject) => {
    const queryString = typeof id === 'undefined' ? {} : {
      _id: {
        '$gt': id
      },
    }
    collection.find(
      queryString,
      {
        limit: batchSize,
        sort: {
          _id: 1
        }
      },
      (err, items) => {
        if (err) {
          reject(err)
        } else {
          resolve(items.toArray())
        }
      })
  })
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

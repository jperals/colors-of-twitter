require('dotenv').config()

const {createCanvas} = require('canvas')
const fs = require('fs')
const languageColor = require('./language-color')
const leftPad = require('left-pad')
const MongoClient = require('mongodb').MongoClient
const Voronoi = require('voronoi')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)
const width = Number(process.env.WIDTH)
const height = Number(process.env.HEIGHT)

const canvas = createCanvas(width, height)
const ctx = canvas.getContext('2d')

let drawnItems = 0

connectToDatabase()
  .catch(handleRejection)
  .then(generateVoronoiDiagram)
  .then(drawToFile)
  .then(finish)

function connectToDatabase() {
  return MongoClient.connect(process.env.DATABASE_URL, {useNewUrlParser: true})
}

function handleRejection(error) {
  console.error(error)
  process.exit(1)
}

function generateVoronoiDiagram(client) {
  {
    const db = client.db(process.env.DATABASE_NAME)
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
  sites.push({
    x: coordinates.lng,
    y: coordinates.lat,
    color
  })
}

function addVoronoiSiteBatch(sites, items) {
  process.stdout.write('.')
  for (const item of items) {
    addVoronoiSite(sites, item)
    drawnItems += 1
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
  }}

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

function finish () {
  console.log('Done.')
  process.exit(0)
}

function drawRecords({collection, ctx, id, batchSize, limit, drawn = 0}) {
  return new Promise((resolve, reject) => {
    getRecordBatch({collection, id, batchSize})
      .catch(err => {
        reject(err)
      })
      .then(pageItems => {
        draw(ctx, pageItems)
        drawn += pageItems.length
        if (pageItems.length && drawn < limit) {
          const lastId = pageItems[pageItems.length - 1]._id
          resolve(drawRecords({collection, ctx, id: lastId, batchSize, limit, drawn}))
        } else {
          resolve(drawn)
        }
      })
  })
}

function drawVoronoiDiagram (ctx, diagram) {
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
  if(typeof nPoints !== 'undefined') {
    fileName += '-' + nPoints + 'points'
  }
  return './output/map-' + fileName + '.png'
}

function getColor(record) {
  try {
    const languageCode = record.languageData.cld.mainLanguage
    if(!languageCode) return
    return languageColor(languageCode)
  } catch (e) {
    return
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

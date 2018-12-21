require('dotenv').config()

const {createCanvas} = require('canvas')
const fs = require('fs')
const languageColor = require('./language-color')
const leftPad = require('left-pad')
const width = Number(process.env.WIDTH)
const height = Number(process.env.HEIGHT)

const canvas = createCanvas(width, height)

module.exports = function(voronoiDiagram) {
  return new Promise((resolve) => resolve(voronoiDiagram))
    .then(drawToCanvas)
    .then(exportPng)
}

function drawToCanvas(diagram) {
  const ctx = canvas.getContext('2d')
  const factorX = width / 360
  const factorY = height / 180
  for (const cell of diagram.cells) {
    if (!cell.halfedges.length) continue
    ctx.fillStyle = getColor(cell.site.language)
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

function getColor(languageCode) {
  return languageColor(languageCode)
}

require('dotenv').config()

const boxAliases = require('./bounding-boxes')
const {createCanvas, loadImage} = require('canvas')
const fs = require('fs')
const languageColor = require('./language-color')
const leftPad = require('left-pad')
const parseArgs = require('minimist')
const path = require('path')

let width
let height
let left
let top
let right
let bottom
const args = parseArgs(process.argv.slice(2))
const boundingBoxStr = args.box
if(boundingBoxStr) {
  if(boxAliases[boundingBoxStr]) {
    [left, top, right, bottom] = boxAliases[boundingBoxStr]
  }
  else {
    [left, top, right, bottom] = boundingBoxStr.split(',').map(str => Number(str))
  }
} else {
  left = -180
  right = 180
  top = 90
  bottom = -90
}
if(args.width) {
  width = Math.abs(args.width)
  height = Math.abs(width * (top - bottom) / (right - left))
} else {
  width = Number(process.env.WIDTH)
  height = Number(process.env.HEIGHT)
}
const factorX = width / (right - left)
const factorY = height / (top - bottom)

const canvas = createCanvas(width, height)

module.exports = function (voronoiDiagram) {
  return new Promise((resolve) => resolve(voronoiDiagram))
    .then(drawDiagram)
    .then(drawSea)
    .then(exportPng)
}

function drawDiagram(diagram) {
  console.log('Drawing diagram to canvas...')
  const ctx = canvas.getContext('2d')
  ctx.lineWidth = .5
  for (const cell of diagram.cells) {
    if (!cell.halfedges.length) continue
    const color = getColor(cell.site.language)
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.beginPath()
    const firstVertex = cell.halfedges[0].getStartpoint()
    const {x, y} = projectPoint(firstVertex)
    ctx.moveTo(x, y)
    for (let i = 1; i < cell.halfedges.length; i++) {
      const halfEdge = cell.halfedges[i]
      const vertex = halfEdge.getStartpoint()
      const {x, y} = projectPoint(vertex)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    ctx.closePath()
    ctx.fill()
  }
  return diagram
}

function drawSea(diagram) {
  return loadImage(path.join(__dirname, 'sea.png'))
    .then(image => {
      const ctx = canvas.getContext('2d')
      const topLeft = projectPoint({x: -180, y: 90})
      const relativeBottomRight = projectPoint({x: 180, y: -90})
      const bottomRight = {x: relativeBottomRight.x - topLeft.x, y: relativeBottomRight.y - topLeft.y}
      ctx.drawImage(image, topLeft.x, topLeft.y, bottomRight.x, bottomRight.y)
      return diagram
    })
}

function exportPng(diagram) {
  const nPoints = diagram.cells.length
  return new Promise((resolve, reject) => {
    const fileName = getFileName(nPoints)
    console.log('Writing to file:', fileName)
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
  return path.join(__dirname, '../output/map-' + fileName + '.png')
}

function getColor(languageCode) {
  return languageColor(languageCode)
}

function projectPoint(originalPoint) {
  const x = (originalPoint.x - left) * factorX
  const y = (top - originalPoint.y) * factorY
  return {x, y}
}

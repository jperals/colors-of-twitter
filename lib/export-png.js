require('dotenv').config()

const Canvas = require('canvas')
const {createCanvas, loadImage} = Canvas
const fs = require('fs')
const languageColor = require('./language-color')
const languageName = require('./language-name')
const leftPad = require('left-pad')
const maps = require('./maps')
const parseArgs = require('minimist')
const path = require('path')

const fallbackColor = '#BFBFBF'
const legendWidth = 200
let width
let height
let left
let top
let right
let bottom
const args = parseArgs(process.argv.slice(2))
const boundingBoxStr = args.box
if(boundingBoxStr) {
  if(maps[boundingBoxStr] && maps[boundingBoxStr].boundingBox) {
    [left, top, right, bottom] = maps[boundingBoxStr].boundingBox
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
} else {
  width = Number(process.env.WIDTH)
  height = Number(process.env.HEIGHT)
}
if(shouldDrawLegend()) {
  width -= legendWidth
}
if(args.width) {
  height = Math.abs(width * (top - bottom) / (right - left))
}

const factorX = width / (right - left)
const factorY = height / (top - bottom)

const canvasWidth = shouldDrawLegend() ? width + legendWidth : width
const canvas = createCanvas(canvasWidth, height)

module.exports = function (voronoiDiagram) {
  return new Promise((resolve) => resolve(voronoiDiagram))
    .then(drawDiagram)
    .then(drawSea)
    .then(drawLegend)
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
  console.log('Drawing the sea on top...')
  return loadImage(path.join(__dirname, 'water-mask.png'))
    .then(image => {
      const ctx = canvas.getContext('2d')
      const sourceCropTopLeft = coordToPx({lng: left, lat: top}, image)
      const sourceCropBottomRight = coordToPx({lng: right, lat: bottom}, image)
      const sourceSize = {width: sourceCropBottomRight.x - sourceCropTopLeft.x, height: sourceCropBottomRight.y - sourceCropTopLeft.y}
      const targetSize = {width, height}
      const targetTopLeft = {x: 0, y: 0}
      ctx.drawImage(image, sourceCropTopLeft.x, sourceCropTopLeft.y, sourceSize.width, sourceSize.height, targetTopLeft.x, targetTopLeft.y, targetSize.width, targetSize.height)
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
  const fileName = [
    "map",
    args.box,
    [
      now.getFullYear(),
      leftPad((now.getMonth() + 1), 2, '0'),
      leftPad(now.getDate(), 2, '0'),
      now.getTime()
    ].join("."),
    Number(nPoints) + "points"
  ].filter(Boolean).join("-") + ".png"
  return path.join(__dirname, '../output/' + fileName)
}

function getColor(languageCode) {
  if(shouldDrawLegend() && maps[boundingBoxStr].languages.indexOf(languageCode) === -1) {
    return fallbackColor
  }
  return languageColor(languageCode)
}

function projectPoint(originalPoint) {
  const x = (originalPoint.x - left) * factorX
  const y = (top - originalPoint.y) * factorY
  return {x, y}
}

function coordToPx(point, image) {
  return {
    x: (180 + point.lng)*(image.width/360),
    y: (90 - point.lat)*(image.height/180)
  }
}

function drawLegend(diagram) {
  if(shouldDrawLegend()) {
    console.log('Drawing the legend...')
    Canvas.registerFont(fontPath('Fira_Sans/FiraSans-Light.ttf'), {family: 'Fira Sans'})
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgb(240, 242, 245)'
    ctx.fillRect(width, 0, legendWidth, height)
    ctx.font = 'normal 14px Fira Sans'
    const languages = maps[boundingBoxStr].languages.sort((a, b) => {
      const nameA = languageName(a)
      const nameB = languageName(b)
      if(nameA < nameB) return -1
      if(nameB < nameA) return 1
      return 0
    })
    let offsetY = 10
    for(const languageCode of languages) {
      drawLegendLanguage({ctx, languageCode, offsetY})
      offsetY += 36
    }
    drawLegendLanguage({ctx, languageCode: 'other', offsetY})
  }
  return diagram
}

function drawLegendLanguage({ctx, languageCode, offsetY}) {
  const offsetX = width + 10
  const color = languageColor(languageCode)
  ctx.fillStyle = color
  ctx.fillRect(offsetX, offsetY, 36, 24)
  const name = languageName(languageCode)
  ctx.fillStyle = '#444'
  ctx.fillText(name, offsetX + 42, offsetY + 18)
}

function shouldDrawLegend() {
  return boundingBoxStr && maps[boundingBoxStr] && maps[boundingBoxStr].languages
}

function fontPath(name) {
  return path.join(__dirname, 'fonts', name)
}

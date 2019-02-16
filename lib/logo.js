const Canvas = require('canvas')
const {connectToDatabase, finish, handleRejection} = require('./common.js')
const fs = require('fs')
const languageColor = require('./language-color')
const {list: languageList} = require('./languages')
const {getLanguageStats} = require('./stats')

const {createCanvas} = Canvas

const side = 3
const exportSize = 128
const scale = exportSize / side

connectToDatabase()
  .catch(handleRejection)
  .then(getLanguageStats)
  .then(drawLogo)
  .then(exportPng)
  .then(finish)

function drawLogo(stats) {
  const canvas = createCanvas(side * scale, side * scale)
  const context = canvas.getContext('2d')
  const totalCount = stats.reduce((accumulator, language) => accumulator + language.count, 0)
  const nPixels = side * side
  const totalLength = nPixels - 1
  let from = 0
  for (const language of stats) {
    const proportion = language.count / totalCount
    const length = totalLength * proportion
    const to = from + length
    drawSegment({context, from: Math.floor(from), languageCode: language.code, to: Math.ceil(to)})
    from = to
  }
  return new Promise((resolve) => {
    resolve(canvas)
  })
}

function drawSegment({context, from, languageCode, to}) {
  for (let i = from; i < to; i++) {
    const x = i % side
    const y = Math.floor(i / side)
    const color = languageColor(languageCode)
    context.fillStyle = color
    // console.log(x, y)
    context.fillRect(x * scale, y * scale, scale, scale)
  }
}

function exportPng(canvas) {
  return new Promise((resolve, reject) => {
    const fileName = 'output/logo.png'
    console.log('Writing to file:', fileName)
    const out = fs.createWriteStream(fileName)
    const stream = canvas.createPNGStream()
    stream.pipe(out)
    out.on('finish', resolve)
  })
}

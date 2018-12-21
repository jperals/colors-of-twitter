require('dotenv').config()

const {connectToDatabase, finish, handleRejection} = require('./common.js')
const exportGeoJson = require('./export-geojson.js')
const exportPng = require('./export-png.js')
const parseArgs = require('minimist')
const generateVoronoiDiagram = require('./voronoi-map')

connectToDatabase()
  .catch(handleRejection)
  .then(generateVoronoiDiagram)
  .then(exportMap)
  .then(finish)

function exportMap(voronoiDiagram) {
  const args = parseArgs(process.argv.slice(2))
  const isPng = Boolean(args.png)
  const isGeoJson = Boolean(args.geojson)
  const promises = []
  if (isPng) {
    promises.push(exportPng(voronoiDiagram))
  }
  if (isGeoJson) {
    promises.push(exportGeoJson(voronoiDiagram))
  }
  if (!promises.length) {
    throw new Error('Please specify which kind of file you want to generate with either argument --png or --geojson (or both).')
  }
  return Promise.all(promises)
}

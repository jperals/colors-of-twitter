const worldGeoJson = require('./geojson/ne_110m_land')
const jsonfile = require('jsonfile')
const cliProgress = require('cli-progress')

let progressBar

const multiPolygon = polygonCollectionToMultiPolygon(worldGeoJson, itemCallback)
if (progressBar) {
  progressBar.stop()
  delete ProgressBar
}
jsonfile.writeFile(__dirname + '/land.geojson', multiPolygon, {spaces: 2})

function itemCallback(i, total) {
  if (progressBar && total <= i) {
    progressBar.stop()
    delete ProgressBar
  }
  else if (!progressBar && i < total) {
    progressBar = new cliProgress.Bar({}, cliProgress.Presets.shades_classic)
    progressBar.start(total, i)
  }
  if (progressBar) {
    progressBar.update(i)
  }
}

function polygonCollectionToMultiPolygon(polygonCollection, itemCallback) {
  const polygons = polygonCollection.features
  let multiPolygon
  console.log(polygons.length)
  const total = polygons.length
  for(let i = 0; i < polygons.length; i++) {
    const polygon = polygons[i]
    if(typeof itemCallback === 'function') {
      itemCallback(i, total)
    }
    if(!multiPolygon) {
      multiPolygon = polygon
    }
    else {
      multiPolygon = polygonUnion(multiPolygon, polygon)
    }
  }
  return multiPolygon
}

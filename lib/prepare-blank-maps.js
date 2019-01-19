const worldGeoJson = require('./geojson/natural-earth/ne_50m_land')
const jsonfile = require('jsonfile')
const path = require('path')
const ProgressBar = require('progress')
const polygonUnion = require('@turf/union').default
const turf = require('@turf/helpers')

const progressBar = new ProgressBar(':bar :percent | :current/:total | ETA: :etas', {
  complete: '█',
  incomplete: '░',
  total: worldGeoJson.features.length
})

const all = polygonCollectionToMultiPolygon(worldGeoJson, itemCallback)
const {land, sea} = separateSeaFromLand(all)
writeToDisk({land, sea})

function itemCallback(i, total) {
  if (progressBar) {
    progressBar.update((i+1)/total)
  }
}

function polygonCollectionToMultiPolygon(polygonCollection, itemCallback) {
  console.log('Converting polygon collection into multipolygon...')
  const polygons = polygonCollection.features
  let multiPolygon
  const total = polygons.length
  for(let i = 0; i < polygons.length; i++) {
    let polygon = polygons[i]
    if(!multiPolygon) {
      multiPolygon = polygon
    }
    else {
      multiPolygon = polygonUnion(multiPolygon, polygon)
    }
    if(typeof itemCallback === 'function') {
      itemCallback(i, total)
    }
  }
  return multiPolygon
}

function separateSeaFromLand(multiPolygon) {
  console.log('Separating the sea from the land...')
  const polygons = multiPolygon.geometry.coordinates
  let sea
  for (const polygon of polygons) {
    if (polygon.length > 1) {
      console.log('Found some sea, separating it from the land.')
      sea = turf.polygon(polygon.splice(1))
    }
  }
  return {
    land: multiPolygon,
    sea: sea
  }
}

function writeToDisk({land, sea}) {
  console.log('Writing files to disk...')
  Promise.all([
    jsonfile.writeFile(path.join(__dirname, 'geojson/land.json'), land, {spaces: 2}),
    jsonfile.writeFile(path.join(__dirname, 'geojson/sea.json'), sea, {spaces: 2})
  ])
    .then(() => {
      console.log('Done.')
    })
}
require('dotenv').config()
const {doInBatches} = require('./db')
const { excludedLanguages, getMainLanguage, getRecordMiddlePointCoordinate } = require('./languages')
const Voronoi = require('voronoi')
const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)

// We might scale coordinates up before performing calculations
// in order to prevent precision-related errors,
// and scale them back down afterwards.
// This seems to prevent this error:
// https://github.com/gorhill/Javascript-Voronoi/issues/15
// https://github.com/gorhill/Javascript-Voronoi/issues/27
const scaleFactor = Number(process.env.SCALE_FACTOR) || 1e6

if (excludedLanguages && excludedLanguages.length) {
  console.log('Excluding languages:', excludedLanguages.join(', '))
}

module.exports = generateVoronoiMap

function getCollection(db) {
  return db.collection(process.env.COLLECTION_LOCATIONS)
}

function generateVoronoiMap(collections) {
  return new Promise((resolve) => resolve(collections))
    .then(getCollection)
    .then(addVoronoiSites)
    .then(scaleVoronoiSitesUp)
    .then(computeVoronoiDiagram)
    .then(scaleVoronoiDiagramDown)
}

function addVoronoiSites(collection) {
  const sites = []
  return doInBatches(({record}) => {
    addVoronoiSite(sites, record)
  }, {collection, batchSize, limit, message: 'Retrieving records...'})
    .then(() => {
      console.log('Added', sites.length.toLocaleString(), 'Voronoi sites.')
      return sites
    })
}

function scaleVoronoiSitesUp(sites, factor = scaleFactor) {
  for (const site of sites) {
    site.x *= factor
    site.y *= factor
  }
  return sites
}

function scaleVoronoiDiagramDown(diagram, factor = scaleFactor) {
  const set = new Set()
  for(cell of diagram.cells) {
    for(halfEdge of cell.halfedges) {
      set.add(halfEdge.site)
      set.add(halfEdge.edge.va)
      set.add(halfEdge.edge.vb)
      set.add(halfEdge.getStartpoint())
    }
  }
  for(object of Array.from(set)) {
    object.x /= scaleFactor
    object.y /= scaleFactor
  }
  return diagram
}

function addVoronoiSite(sites, item) {
  const coordinates = getRecordMiddlePointCoordinate(item)
  return getMainLanguage(item)
    .then(languageCode => {
      if (languageCode) {
        sites.push({
          x: coordinates.lng,
          y: coordinates.lat,
          language: languageCode
        })
      }
      return sites
    })
    .catch(() => {
      return sites
    })
}

function computeVoronoiDiagram(sites) {
  console.log('Computing Voronoi diagram...')
  const boundingBox = {
    xl: -180 * scaleFactor,
    xr: 180 * scaleFactor,
    yt: -90 * scaleFactor,
    yb: 90 * scaleFactor
  }
  const voronoi = new Voronoi()
  const diagram = voronoi.compute(sites, boundingBox)
  console.log('Computed Voronoi diagram in', diagram.execTime.toLocaleString(), 'milliseconds.')
  console.log('Computed', diagram.vertices.length.toLocaleString(), 'vertices,', diagram.edges.length.toLocaleString(), 'edges and', diagram.cells.length.toLocaleString(), 'cells.')
  return diagram
}

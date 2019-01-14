// Process already collected data

require('dotenv').config()

const {collectLocation, initTargetCollection} = require('./process-data.js')
const {connectToDatabase, finish, handleRejection} = require('./common.js')
const {doInBatches} = require('./db.js')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)

let db
let targetCollection

connectToDatabase()
  .catch(handleRejection)
  .then(initTargetCollection)
  .then(assignGlobal)
  .then(collectLocations)
  .then(reportCount)
  .then(finish)

function assignGlobal() {
  const targetCollectionName = process.env.COLLECTION_LOCATIONS
  targetCollection = db.collection(targetCollectionName)
}

function collectLocations(targetCollection) {
  const srcCollectionName = process.env.COLLECTION_TWEETS
  console.log('Reading from collection', srcCollectionName)
  const srcCollection = db.collection(srcCollectionName)
  return doInBatches(({record}) => {
    collectLocation({record, targetCollection})
  }, {
    collection: srcCollection,
    limit,
    batchSize,
    message: 'Aggregating tweet data into unique locations data...',
    inSequence: true
  })
}

function reportCount(inspected) {
  console.log('Inspected', inspected, 'tweets.')
  return targetCollection.countDocuments()
}

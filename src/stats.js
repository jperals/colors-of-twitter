const {connectToDatabase, finish, handleRejection} = require('./common.js')

connectToDatabase()
  .catch(handleRejection)
  .then(getAllStats)
  .then(printStats)
  .then(finish)

function getAllStats(db) {
  return Promise.all([
    getLocationStats(db),
    getTweetsStats(db)
  ])
    .then(([locationStats, tweetStats]) => {
      return {locationStats, tweetStats}
    })
}

function getLocationStats(db) {
  const collection = db.collection(process.env.COLLECTION_LOCATIONS)
  return collection.estimatedDocumentCount()
    .then(result => {
      return {
        totalSize: result
      }
    })
}

function getTweetsStats(db) {
  return db.listCollections().toArray()
    .then(collectionsData => {
      const filteredCollectionNames = collectionsData.filter((item) => item.name.startsWith('tweets_with_geolocation'))
      const collections = filteredCollectionNames.map(collectionData => db.collection(collectionData.name))
      return Promise.all(collections.map(collection => collection.estimatedDocumentCount()))
    })
    .then(results => {
      return {
        totalSize: results.reduce((totalSize, collectionSize) => totalSize + collectionSize)
      }
    })
}

function printStats({locationStats, tweetStats}) {
  console.log('Tweets collected:', tweetStats.totalSize.toLocaleString())
  console.log('Unique locations:', locationStats.totalSize.toLocaleString())
}

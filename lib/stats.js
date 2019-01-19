const {connectToDatabase, finish, handleRejection} = require('./common.js')
const {doInBatches} = require('./db')

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
  const collection = db.collection(process.env.COLLECTION_LOCATIONS)
  let nTweets = 0
  return doInBatches(({record}) => {
      nTweets += record.nTweets
    },
    {collection})
    .then(() => {
      return {
        totalSize: nTweets
      }
    })
}

function printStats({locationStats, tweetStats}) {
  console.log('Tweets collected:', tweetStats.totalSize.toLocaleString())
  console.log('Unique locations:', locationStats.totalSize.toLocaleString())
}

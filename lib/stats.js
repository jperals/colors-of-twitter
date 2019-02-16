const {doInBatches} = require('./db')
const {getMainLanguage} = require('./languages')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)

function getAllStats(db) {
  return Promise.all([
    getLanguageStats(db),
    getLocationStats(db),
    getTweetsStats(db)
  ])
    .then(([languageStats, locationStats, tweetStats]) => {
      return {languageStats, locationStats, tweetStats}
    })
}

function getLanguageStats(db) {
  const statsObject = {}
  const collection = db.collection(process.env.COLLECTION_LOCATIONS)
  return doInBatches(({record}) => {
    return getMainLanguage(record)
      .then(languageCode => {
        if (typeof statsObject[languageCode] === 'number') {
          statsObject[languageCode] += 1
        } else {
          statsObject[languageCode] = 1
        }
      })
  }, {collection, batchSize, limit})
    .then(() => {
      const sortedCodes = Object.keys(statsObject).sort((a, b) => statsObject[b] - statsObject[a])
      const statsSorted = []
      for(const code of sortedCodes) {
        statsSorted.push({
          code,
          count: statsObject[code]
        })
      }
      return statsSorted
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
    {collection, batchSize, limit})
    .then(() => {
      return {
        totalSize: nTweets
      }
    })
}

module.exports = {
  getAllStats,
  getLanguageStats,
  getLocationStats,
  getTweetsStats
}
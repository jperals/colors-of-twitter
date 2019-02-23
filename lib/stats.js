const {doInBatches} = require('./db')
const {getRecordLanguageStats} = require('./languages')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)

function getAllStats(db) {
  const collection = db.collection(process.env.COLLECTION_LOCATIONS)
  const statsObject = {}
  let totalLocations = 0
  let totalTweets = 0
  return doInBatches(({record}) => {
    const languageStats = getRecordLanguageStats(record)
    for (const languageCode in languageStats) {
      if (!(languageStats.hasOwnProperty(languageCode))) {
        continue
      }
      const n = languageStats[languageCode].times
      if(typeof n !== 'number') {
        continue
      }
      if (typeof statsObject[languageCode] === 'number') {
        statsObject[languageCode] += n
      } else {
        statsObject[languageCode] = n
      }
      totalTweets += n
    }
    totalLocations += 1
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
      return {
        languageStats: statsSorted,
        locationStats: {
          totalSize: totalLocations
        },
        tweetStats: {
          totalSize: totalTweets
        }
      }
    })
}

function getLanguageStats(db) {
  const collection = db.collection(process.env.COLLECTION_LOCATIONS)
  const statsObject = {}
  return doInBatches(({record}) => {
    const languageStats = getRecordLanguageStats(record)
    for (const languageCode in languageStats) {
      const n = languageStats[languageCode]
      if (typeof statsObject[languageCode] === 'number') {
        statsObject[languageCode] += n
      } else {
        statsObject[languageCode] = n
      }
    }
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
require('dotenv').config()

const cld = require('cld')
const MongoClient = require('mongodb').MongoClient
const {doInBatches} = require('./db.js')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)
const minTweetLength = Number(process.env.MIN_TWEET_LENGTH)

let db
let srcCollection
let targetCollection

connectToDatabase()
  .catch(handleError)
  .then(initCollections)
  .then(initTargetCollection)
  .then(collectLocations)
  .then(reportCount)
  .then(calculateMainLanguages)
  .then(finish)

function connectToDatabase() {
  return MongoClient.connect(process.env.DATABASE_URL, {useNewUrlParser: true})
}

function handleError(error) {
  console.error(error)
  process.exit(1)
}

function initCollections(client) {
  db = client.db(process.env.DATABASE_NAME)
  console.log('Connected to the database')
  srcCollection = db.collection(process.env.COLLECTION_TWEETS)
  targetCollection = db.collection(process.env.COLLECTION_LOCATIONS)
  console.log('Cleaning up locations first...')
  return targetCollection.deleteMany({})
}

function initTargetCollection() {
  targetCollection = db.collection(process.env.COLLECTION_LOCATIONS)
  return targetCollection.createIndex({'boundingBoxId': 1}, {unique: true})
}

function collectLocations() {
  return doInBatches(collectLocation, {
    collection: srcCollection,
    limit,
    batchSize,
    message: 'Collecting unique locations...',
    inSequence: true
  })
}

function reportCount(inspected) {
  console.log('Inspected', inspected, 'tweets.')
  return targetCollection.countDocuments()
}

function calculateMainLanguages(nDocuments) {
  console.log('Found ' + nDocuments + ' unique locations.')
  return doInBatches(calculateMainLanguage, {
    collection: targetCollection,
    batchSize,
    limit: Math.min(limit, nDocuments),
    message: 'Calculating main language for each location...'
  })
}

function finish() {
  console.log('Done.')
  process.exit(0)
}

function collectLocation({record}) {
  return new Promise((resolve, reject) => {
    const boundingBoxId = getBoundingBoxId(record)
    if (boundingBoxId && record.tweet.text.length >= minTweetLength) {
      Promise.all([
        targetCollection.findOne({
          boundingBoxId
        }),
        detectLanguage(record.tweet.text)
      ])
        .then(([foundRecord, languageData]) => {
          let languages
          if (foundRecord) {
            languages = combineLanguageData(foundRecord.languageData.cld.languages, languageData)
          } else {
            languages = arrayToObject(languageData.languages, {key: 'code'})
          }
          resolve(targetCollection.findOneAndUpdate({
              boundingBoxId
            },
            {
              "$set": {
                boundingBoxId,
                languageData: {
                  cld: {
                    languages
                  }
                }
              }
            },
            {
              returnNewDocument: true,
              upsert: true
            })
          )
        })
        .catch(resolve)
    } else {
      resolve()
    }
  })
}

function arrayToObject(array, {key}) {
  const obj = {}
  for (const item of array) {
    obj[item[key]] = item
  }
  return obj
}

function calculateMainLanguage({collection, record}) {
  const mainLanguage = getMainLanguage(record.languageData.cld.languages)
  return collection.findOneAndUpdate({
      '_id': record._id
    },
    {
      '$set': {
        languageData: {
          cld: Object.assign(record.languageData.cld, {mainLanguage})
        }
      }
    })
}

function combineLanguageData(existingData, newData) {
  const combinedData = {}
  for (const languageCode in existingData) {
    combinedData[languageCode].score = existingData[languageCode].score
  }
  for (const dataSet of newData.languages) {
    combinedData[dataSet.code].score = dataSet.score
    if (existingData[dataSet.code]) {
      combinedData[dataSet.code].score += existingData[dataSet.code].score
    }
  }
  return combinedData
}

// Promise wrapper for cld.detect
function detectLanguage(text) {
  return new Promise((resolve, reject) => {
    cld.detect(text, (err, result) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
}

function getBoundingBoxId(record) {
  try {
    return record.tweet.place.bounding_box.coordinates[0] + ''
  } catch (e) {
    return
  }
}

function getMainLanguage(languageData) {
  return Object.keys(languageData).sort((key1, key2) => languageData[key2].score - languageData[key1].score)[0]
}

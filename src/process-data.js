require('dotenv').config()

const cld = require('cld')
const parseArgs = require('minimist')
const MongoClient = require('mongodb').MongoClient
const {doInBatches} = require('./db.js')

const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)
const minTweetLength = Number(process.env.MIN_TWEET_LENGTH)

let db
let targetCollection

connectToDatabase()
  .catch(handleRejection)
  .then(initTargetCollection)
  .then(assignGlobal)
  .then(collectLocations)
  .then(reportCount)
  .then(calculateMainLanguages)
  .then(finish)

function connectToDatabase() {
  return MongoClient.connect(process.env.DATABASE_URL, {useNewUrlParser: true})
}

function handleRejection(error) {
  console.error(error)
  process.exit(1)
}

function initTargetCollection(client) {
  db = client.db(process.env.DATABASE_NAME)
  console.log('Connected to the database')
  const collectionName = process.env.COLLECTION_LOCATIONS
  return db.listCollections({name: collectionName}).hasNext()
    .then(exists => {
      if (exists) {
        const collection = db.collection(collectionName)
        if (cleanParam()) {
          // If a `clean` argument was passed, clean up the database (empty it) before adding the new records
          console.log('Cleaning up locations first...')
          return collection.deleteMany({})
        } else {
          return collection
        }
      } else {
        console.log('Creating collection ' + collectionName + '...')
        return db.collection(collectionName)
          .createIndex({'boundingBoxId': 1}, {unique: true})
      }
    })
}

function assignGlobal() {
  const targetCollectionName = process.env.COLLECTION_LOCATIONS
  targetCollection = db.collection(targetCollectionName)
}

function collectLocations() {
  const srcCollectionName = process.env.COLLECTION_TWEETS
  console.log('Reading from collection', srcCollectionName)
  const srcCollection = db.collection(srcCollectionName)
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
          if(!languageData) {
            resolve()
            return
          }
          let setObj
          if(foundRecord) {
            setObj = {
              languageData: {
                cld: {
                  languages: combineLanguageData(foundRecord.languageData.cld.languages, languageData)
                }
              }
            }
          } else {
            setObj = {
              languageData: {
                cld: {
                  languages: arrayToObject(languageData.languages, {key: 'code'})
                }
              },
              placeName: record.tweet.place.full_name
            }
          }
          resolve(targetCollection.findOneAndUpdate({
              boundingBoxId
            },
            {
              $set: setObj,
              $inc: {
                nTweets: 1
              }
            },
            {
              returnNewDocument: true,
              upsert: true
            })
          )
        })
        .catch((error) => {
          console.error(error)
          resolve()
        })
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
  try {
    // Manual shallow copy, but just interested in the `score` field of each data set
    for (const languageCode of Object.keys(existingData)) {
      combinedData[languageCode] = {
        score: existingData[languageCode].score
      }
    }
    for (const dataSet of newData.languages) {
      if (existingData[dataSet.code]) {
        combinedData[dataSet.code].score += dataSet.score
      } else {
        combinedData[dataSet.code] = {
          score: dataSet.score
        }
      }
    }
  } catch(err) {
    console.log(err)
  }
  return combinedData
}

// Promise wrapper for cld.detect
function detectLanguage(text) {
  return new Promise((resolve, reject) => {
    cld.detect(text, (err, result) => {
      // Also resolve on error because we don't want to log an error
      // every time the translation fails. That's okay.
      resolve(result)
      if (err) {
        resolve()
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

// Wether a `clean` parameter was passed, indicating that the collection
// should be cleaned (emptied) before adding new records
function cleanParam() {
  return parseArgs(process.argv.slice(2)).clean
}

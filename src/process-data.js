require('dotenv').config()

const cld = require('cld')
const parseArgs = require('minimist')

const minTweetLength = Number(process.env.MIN_TWEET_LENGTH)

let db

function initTargetCollection(_db) {
  db = _db
  const collectionName = process.env.COLLECTION_LOCATIONS
  return db.listCollections({name: collectionName}).hasNext()
    .then(exists => {
      if (exists) {
        const collection = db.collection(collectionName)
        if (cleanParam()) {
          // If a `clean` argument was passed, clean up the database (empty it) before adding the new records
          console.log('Cleaning up locations first...')
          return collection.deleteMany({})
            .then(() => db.collection(collectionName))
        } else {
          return collection
        }
      } else {
        console.log('Creating collection ' + collectionName + '...')
        return db.collection(collectionName)
          .createIndex({'boundingBoxId': 1}, {unique: true})
          .then(() => db.collection(collectionName))
      }
    })
}

function collectLocation({targetCollection, record}) {
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
          if (!languageData) {
            resolve()
            return
          }
          let setObj
          if (foundRecord) {
            const languagesData = combineLanguageData(foundRecord.languageData.cld.languages, languageData)
            setObj = {
              languageData: {
                cld: {
                  languages: languagesData,
                  mainLanguage: getMainLanguage(languagesData)
                }
              }
            }
          } else {
            const languagesData = arrayToObject(languageData.languages, {key: 'code'})
            const detectedLanguage = getMainLanguage(languagesData)
            languagesData[detectedLanguage].times = 1
            setObj = {
              languageData: {
                cld: {
                  languages: languagesData,
                  mainLanguage: detectedLanguage
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

function combineLanguageData(existingData, newData) {
  const combinedData = {}
  try {
    // Manual shallow copy, but just interested in the `score` and `times` fields of each data set
    for (const languageCode of Object.keys(existingData)) {
      combinedData[languageCode] = {
        score: existingData[languageCode].score,
        times: existingData[languageCode].times || 0
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
    const detectedLanguage = newData.languages.sort((a, b) => a.score - b.score)[0].code
    combinedData[detectedLanguage].times = (combinedData[detectedLanguage].times || 0) + 1
  } catch (err) {
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

// Wether a `clean` parameter was passed, indicating that the collection
// should be cleaned (emptied) before adding new records
function cleanParam() {
  return parseArgs(process.argv.slice(2)).clean
}

function getMainLanguage(languageData) {
  return Object.keys(languageData).sort((key1, key2) => languageData[key2].score - languageData[key1].score)[0]
}

module.exports = {
  collectLocation,
  initTargetCollection
}

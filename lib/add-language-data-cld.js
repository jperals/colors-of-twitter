require('dotenv').config()
const MongoClient = require('mongodb').MongoClient
const {doInBatches} = require('./db.js')
const limit = Number(process.env.LIMIT)
const batchSize = Number(process.env.BATCH_SIZE)
const cld = require('cld')

const startTime = new Date()

MongoClient.connect(process.env.DATABASE_URL, {useNewUrlParser: true})
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .then(client => {
    const db = client.db(process.env.DATABASE_NAME)
    const collection = db.collection(process.env.COLLECTION_TWEETS)
    return doInBatches(processTweet, {
      collection,
      limit,
      batchSize,
      message: 'Identifying the language of each tweet...'
    })
  })
  .then(doneCount => {
    const elapsed = new Date() - startTime
    console.log('Processed', doneCount, 'records in', elapsed/1000 + 's')
    process.exit(0)
  })

function processTweet({record, collection}) {
  return new Promise((resolve, reject) => {
    cld.detect(record.tweet.text, (err, result) => {
      if (err) {
        resolve()
      } else {
        resolve(collection.findOneAndUpdate({
            _id: record._id
          },
          {
            $set: {
              languageData: {
                cld: result
              }
            }
          }))
      }
    })
  })
}

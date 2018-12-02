require('dotenv').config()
const MongoClient = require('mongodb').MongoClient
const {doInBatches} = require('./db.js')
const limit = Number(process.env.LIMIT)
const batchSize = Number(process.env.BATCH_SIZE)

MongoClient.connect(process.env.DATABASE_URL, {useNewUrlParser: true})
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .then(client => {
    const db = client.db(process.env.DATABASE_NAME)
    const collection = db.collection(process.env.COLLECTION_TWEETS)
    return doInBatches(processTweet, {collection, limit, batchSize, message: 'Adding bounding box information to every tweet...'})
  })
  .then(doneCount => {
    console.log('Processed', doneCount, 'records')
    process.exit(0)
  })

function processTweet({record, collection}) {
  const boundingBoxId = getBoundingBoxId(record)
  return collection.findOneAndUpdate({
      _id: record._id
    },
    {
      "$set": {
        boundingBoxId
      }
    },
    {
      returnNewDocument: true
    })
}

function getBoundingBoxId(record) {
  try {
    return record.tweet.place.bounding_box.coordinates[0] + ''
  } catch (e) {
    return
  }
}

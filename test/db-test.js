require('dotenv').config()
const assert = require('assert')
const MongoClient = require('mongodb').MongoClient
const {doInBatches} = require('../src/db.js')

describe('doInBatches', () => {
  it('should be able to execute a function for each database record', done => {
    const limit = 10000
    const batchSize = 1000
    let doneCount = 0

    function countUp() {
      return new Promise((resolve, reject) => {
        doneCount += 1
        resolve(doneCount)
      })
    }

    MongoClient.connect(process.env.DATABASE_URL, {useNewUrlParser: true})
      .catch(err => {
        done(err)
      })
      .then(client => {
        const db = client.db(process.env.DATABASE_NAME)
        const collection = db.collection(process.env.COLLECTION_TWEETS)
        return doInBatches(countUp, {collection, limit, batchSize})
      })
      .then(count => {
        assert.equal(count, limit)
        done()
      })
  })
})

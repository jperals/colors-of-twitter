require('dotenv').config()
const assert = require('assert')
const MongoClient = require('mongodb').MongoClient
const {doInBatches} = require('../src/db.js')

describe('doInBatches', () => {
  it('should be able to execute a function for each database record', done => {
    const limit = 1000
    const batchSize = 100
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
  }).timeout(5000)
  it('should be able to process records in the right sequence', done => {
    const limit = 100
    const batchSize = 20
    const ids = []
    function collectId({record}) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          ids.push(record._id)
          resolve(ids.length)
        }, Math.random() * 100)
      })
    }
    MongoClient.connect(process.env.DATABASE_URL, {useNewUrlParser: true})
      .catch(err => {
        done(err)
      })
      .then(client => {
        const db = client.db(process.env.DATABASE_NAME)
        const collection = db.collection(process.env.COLLECTION_TWEETS)
        return doInBatches(collectId, {collection, limit, batchSize, inSequence: true})
      })
      .then(count => {
        let sorted = true
        for(let i = 1; i < ids.length; i++) {
          sorted = sorted && ids[i] > ids[i - 1]
        }
        assert(sorted)
        done()
      })
  }).timeout(10000)
})

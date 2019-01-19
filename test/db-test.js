require('dotenv').config()
const assert = require('assert')
const args = require('minimist')(process.argv.slice(2))
const MongoClient = require('mongodb').MongoClient
const {doInBatches} = require('../lib/db.js')

const reportProgress = Boolean(args.verbose)
console.log('reportProgress:', reportProgress)

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

    MongoClient.connect(process.env.DATABASE_URL_TEST, {useNewUrlParser: true})
      .catch(err => {
        done(err)
      })
      .then(client => {
        const db = client.db(process.env.DATABASE_NAME_TEST)
        const collection = db.collection(process.env.COLLECTION_TEST)
        return doInBatches(countUp, {collection, limit, batchSize, reportProgress})
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

    MongoClient.connect(process.env.DATABASE_URL_TEST, {useNewUrlParser: true})
      .catch(err => {
        done(err)
      })
      .then(client => {
        const db = client.db(process.env.DATABASE_NAME_TEST)
        const collection = db.collection(process.env.COLLECTION_TEST)
        return doInBatches(collectId, {collection, limit, batchSize, inSequence: true, reportProgress})
      })
      .then(count => {
        let sorted = true
        for (let i = 1; i < ids.length; i++) {
          sorted = sorted && ids[i] > ids[i - 1]
        }
        assert(sorted)
        done()
      })
  }).timeout(10000)
  it('should run synchronous functions as well', done => {
    const limit = 100
    const batchSize = 20
    let count = 0
    function countUpSync() {
      count += 1
    }
    MongoClient.connect(process.env.DATABASE_URL_TEST, {useNewUrlParser: true})
      .catch(err => {
        done(err)
      })
      .then(client => {
        const db = client.db(process.env.DATABASE_NAME_TEST)
        const collection = db.collection(process.env.COLLECTION_TEST)
        return doInBatches(countUpSync, {collection, limit, batchSize, reportProgress})
      })
      .then(count => {
        assert.equal(count, limit)
        done()
      })
  }).timeout(5000)
})

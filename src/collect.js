// Collect live data and optionally process it

const {connectToDatabase, handleRejection} = require('./common.js')
const leftPad = require('left-pad')
const {nDecimals} = require('./math')
const parseArgs = require('minimist')
const moment = require('moment')
const {collectLocation, initTargetCollection} = require('./process-data.js')
const {initStream, isTweet} = require('./twitter-stream')
let nRecords
let nRecordsOld
let nStarts = 0
let keepAliveInterval
let reportInterval

start()

function start() {
  nRecords = 0
  nRecordsOld = 0
  nStarts += 1
  initStreamAndDatabase()
    .catch(handleRejection)
    .then(collectTweets)
    .then(keepAlive)
    .then(report)
}

function initStreamAndDatabase() {
  return Promise.all([
    connectToDatabase(),
    initStream()
  ])
}

function collectTweets([db, stream]) {
  const args = parseArgs(process.argv.slice(2))
  if (args.raw) {
    const collectionName = getCollectionName()
    console.log('Writing to collection', collectionName)
    console.log('Collecting tweets...')
    const collection = db.collection(collectionName)
    stream.on('data', function (event) {
      try {
        if (isTweet(event)) {
          collection.insertOne({
            tweet: event
          })
            .then(() => {
              nRecords += 1
            })
        }
      } catch (error) {
        console.error(error)
      }
    })
  } else {
    initTargetCollection(db)
      .then(targetCollection => {
        stream.on('data', function (event) {
          try {
            if (isTweet(event)) {
              collectLocation({
                targetCollection,
                record: {
                  tweet: event
                }
              })
                .then(collected => {
                  if(collected) {
                    nRecords += 1
                  }
                })
            }
          } catch (error) {
            console.error(error)
          }
        })
      })
  }
  stream.on('error', (error) => {
    console.error(error)
  })
  return stream
}

function getCollectionName() {
  const today = new Date()
  const todayStr = today.getFullYear() + '' + leftPad(today.getMonth() + 1, 2, '0') + '' + leftPad(today.getDate(), 2, '0')
  return 'tweets_with_geolocation_' + todayStr
}

function printProgress({initialTime, nRecords}) {
  const nStr = nRecords.toLocaleString()
  const now = moment()
  const elapsedTimeStr = now.from(initialTime)
  const elapsedTimeMs = now - initialTime
  const tweetsPerSecond = nRecords / (elapsedTimeMs / 1000)
  if (process && process.stdout && typeof process.stdout.clearLine === 'function') {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write('Collected ' + nStr + ' tweets ' + elapsedTimeStr + ' (' + nDecimals(tweetsPerSecond, 2) + ' tweets per second).')
  }
}

function keepAlive() {
  clearInterval(keepAliveInterval)
  keepAliveInterval = setInterval(() => {
    if (nRecords <= nRecordsOld) {
      console.log('It seems that either the Twitter stream or database connection got stuck. Restarting both...')
      console.log('Number of restarts so far:', nStarts)
      start()
    }
    nRecordsOld = nRecords
  }, 10000)
}

function report() {
  const initialTime = moment()
  clearInterval(reportInterval)
  reportInterval = setInterval(() => {
    printProgress({initialTime, nRecords})
  }, 1000)
}

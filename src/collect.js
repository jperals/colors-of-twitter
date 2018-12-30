// Collect live data and optionally process it

require('dotenv').config()

const leftPad = require('left-pad')
const moment = require('moment')
const parseArgs = require('minimist')
const {collectLocation, initTargetCollection} = require('./process-data.js')
const Twitter = require('twitter')
const {connectToDatabase, handleRejection} = require('./common.js')
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

function initStream() {
  const twitterClient = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_TOKEN,
    access_token_secret: process.env.TWITTER_TOKEN_SECRET
  })

  const stream = twitterClient.stream('statuses/filter', {
    locations: '-180,-90,180,90'
  })

  return stream
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
                .then(() => {
                  nRecords += 1
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

function isTweet(event) {
  return event && typeof event.text === 'string'
}

function printProgress({initialTime, nRecords}) {
  const nStr = nRecords.toLocaleString()
  const now = moment()
  const elapsedTimeStr = now.from(initialTime)
  const elapedTimeMs = now - initialTime
  const tweetsPerSecond = nRecords / (elapedTimeMs / 1000)
  if (process && process.stdout && typeof process.stdout.clearLine === 'function') {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write('Collected ' + nStr + ' tweets ' + elapsedTimeStr + ' (' + nDecimals(tweetsPerSecond, 2) + ' tweets per second).')
  }
}

function nDecimals(n, decimals = 2) {
  if (typeof n !== 'number') return n
  const factor = Math.pow(10, decimals)
  return Math.round(n * factor) / factor
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

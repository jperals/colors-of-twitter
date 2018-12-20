require('dotenv').config()

const leftPad = require('left-pad')
const moment = require('moment')
const Twitter = require('twitter')
const {connectToDatabase, handleRejection} = require('./common.js')

initStreamAndDatabase()
  .catch(handleRejection)
  .then(collectTweets)

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
  let nRecords = 0
  const collectionName = getCollectionName()
  console.log('Writing to collection', collectionName)
  console.log('Collecting tweets...')
  const collection = db.collection(collectionName)
  stream.on('data', function (event) {
    try {
      if(isTweet(event)) {
        collection.insertOne({
          tweet: event
        })
          .then(() => {
            nRecords += 1
          })
      }
    } catch(error) {
      console.error(error)
    }
  })
  stream.on('error', (error) => {
    console.error(error)
  })
  const initialTime = moment()
  setInterval(() => {
    printProgress({initialTime, nRecords})
  }, 1000)
}

function getCollectionName() {
  const today = new Date()
  const todayStr = today.getFullYear() + '' + leftPad(today.getMonth() + 1, 2, '0') + '' + leftPad(today.getDate(), 2, '0')
  return 'tweets_with_geolocation_' + todayStr
}

function isTweet(event) {
  return event && typeof event.text === 'string'
}

function printProgress({initialTime, nRecords}){
  const nStr = nRecords.toLocaleString()
  const now = moment()
  const elapsedTimeStr = now.from(initialTime)
  const elapedTimeMs = now - initialTime
  const tweetsPerSecond = nRecords / (elapedTimeMs/1000)
  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  process.stdout.write('Collected ' + nStr + ' tweets ' + elapsedTimeStr + ' (' + nDecimals(tweetsPerSecond, 2) + ' tweets per second).')
}

function nDecimals (n, decimals = 2) {
  if (typeof n !== 'number') return n
  const factor = Math.pow(10, decimals)
  return Math.round(n * factor) / factor
}

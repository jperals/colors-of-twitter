require('dotenv').config()

const leftPad = require('left-pad')
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

function collectTweets([dbClient, stream]) {
  const db = dbClient.db(process.env.DATABASE_NAME)
  console.log('Connected to database')
  const collectionName = getCollectionName()
  console.log('Using collection', collectionName)
  console.log('Collecting tweets...')
  const collection = db.collection(collectionName)
  stream.on('data', function (event) {
    try {
      if(isTweet(event)) {
        collection.insertOne({
          tweet: event
        })
      }
    } catch(error) {
      console.error(error)
    }
  })
  stream.on('error', (error) => {
    console.error(error)
  })
}

function getCollectionName() {
  const today = new Date()
  const todayStr = today.getFullYear() + '' + leftPad(today.getMonth() + 1, 2, '0') + '' + leftPad(today.getDate(), 2, '0')
  return 'tweets_with_geolocation_' + todayStr
}

function isTweet(event) {
  return event && typeof event.text === 'string'
}

require('dotenv').config()

const Twitter = require('twitter')

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

function isTweet(event) {
  return event && typeof event.text === 'string'
}

module.exports = {
  initStream,
  isTweet
}
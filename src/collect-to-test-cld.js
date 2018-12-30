// Collects a sample of tweets for CLD to test against

const {initStream, isTweet} = require('./twitter-stream')
const jsonfile = require('jsonfile')
const path = require('path')

const parseArgs = require('minimist')

const limit = Number(parseArgs(process.argv.slice(2)).n) || 100

const stream = initStream()

let nTweets = 0
const sample = []

stream.on('data', function(event) {
  if(!isTweet(event)) {
    return
  }
  sample.push({
    text: event.text,
    lang: ""
  })
  nTweets += 1
  if(limit <= nTweets) {
    const filePath = path.join(__dirname, '..', 'test/cld_sample.json')
    jsonfile.writeFile(filePath, sample, {spaces: 2})
      .then(() => {
        process.exit(0)
      })
  }
})

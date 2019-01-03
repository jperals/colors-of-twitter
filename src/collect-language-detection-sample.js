// Collects a sample of tweets for CLD to test against

const path = require('path')
const filePath = path.join(__dirname, '..', 'test/language-detection-sample.json')

const {initStream, isTweet} = require('./twitter-stream')
const jsonfile = require('jsonfile')
const ProgressBar = require('progress')

let sample
try {
  sample = require(filePath)
} catch(e) {
  sample = []
}

const parseArgs = require('minimist')

const limit = Number(parseArgs(process.argv.slice(2)).n) || 100
const stream = initStream()

let nTweets = 0

const progressBar = new ProgressBar(':bar :percent | :current/:total | ETA: :etas', {
  complete: '█',
  incomplete: '░',
  total: limit
})

stream.on('data', function(event) {
  if(!isTweet(event)) {
    return
  }
  sample.push({
    index: nTweets,
    text: event.text,
    placeName: event.place.full_name,
    lang: ""
  })
  nTweets += 1
  progressBar.tick()
  if(limit <= nTweets) {
    jsonfile.writeFile(filePath, sample, {spaces: 2})
      .then(() => {
        process.exit(0)
      })
  }
})

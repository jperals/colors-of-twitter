require('dotenv').config()
const assert = require('assert')
const {nDecimals} = require('../lib/math')
const {cleanUp} = require('../lib/clean-up-text')
const detectLanguage = require('../lib/detect-language')
const sample = require('./language-detection-sample')
const args = require('minimist')(process.argv.slice(2))
const beVerbose = Boolean(args.verbose)
const minimumTweetLength = Number(process.env.MIN_TWEET_LENGTH) || 0

describe('The language detection mechanism', () => {
  it('should detect the language correctly with less than 3% of mistakes', done => {
    const promises = []
    for (const dataSet of sample) {
      promises.push(detectLanguage(dataSet.text))
    }
    Promise.all(promises)
      .then(results => {
        let badDetections = 0
        let discarded = 0
        let notDetected = 0
        let report = ''
        for (const [index, result] of results.entries()) {
          const expected = sample[index].lang
          const returned = result && result.languages ? result.languages[0].code : ''
          const matches = returned == expected || expected instanceof Array && expected.indexOf(returned) !== -1
          const tooShort = cleanUp(sample[index].text).length < minimumTweetLength
          if (tooShort) {
            discarded += 1
          }
          const passes = matches || tooShort
          if (!passes) {
            report += '\nReturned value is not as expected for text at index ' + index + ':\n' + sample[index].text + '\nCleaned up text:\n' + cleanUp(sample[index].text) + '\nExpected: ' + expected + '\nReturned: ' + returned + '\n'
            if(returned) {
              badDetections += 1
            } else {
              notDetected += 1
            }
          }
        }
        const attempted = results.length - discarded
        const goodDetections = attempted - badDetections - notDetected
        if(beVerbose) {
          console.log(report)
          console.log('Discarded:', discarded + '/' + results.length + ' (' + nDecimals(100 * discarded / results.length, 2) + '%)')
          console.log('Attempted:', attempted + '/' + results.length + ' (' + nDecimals(100 * attempted / results.length, 2) + '%)')
          console.log('Good detections:', goodDetections + '/' + attempted + ' (' + nDecimals(100 * goodDetections / attempted, 2) + '%)')
          console.log('Bad detections:', badDetections + '/' + attempted + ' (' + nDecimals(100 * badDetections / attempted, 2) + '%)')
          console.log('Not detected:', notDetected + '/' + attempted + ' (' + nDecimals(100 * notDetected / attempted, 2) + '%)')
        }
        const failsOk = badDetections / attempted <= 0.03
        assert(failsOk)
        done()
      })
  })
})

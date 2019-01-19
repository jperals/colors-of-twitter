require('dotenv').config()
const assert = require('assert')
const {nDecimals} = require('../lib/math')
const {cleanUp} = require('../lib/clean-up-text')
const detectLanguage = require('../lib/detect-language')
const sample = require('./language-detection-sample')
const minimumTweetLength = Number(process.env.MIN_TWEET_LENGTH) || 0

describe('The language detection mechanism', () => {
  it('should produce the expected results for our given sample', done => {
    const promises = []
    for (const dataSet of sample) {
      promises.push(detectLanguage(dataSet.text))
    }
    Promise.all(promises)
      .then(results => {
        let fails = 0
        let discarded = 0
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
            fails += 1
          }
        }
        console.log(report)
        console.log('Discarded:', discarded + '/' + results.length + ' (' + nDecimals(100 * discarded / results.length, 2) + '%)')
        const translated = results.length - discarded
        console.log('Bad detections:', fails + '/' + translated + ' (' + nDecimals(100 * fails / translated, 2) + '%)')
        const discardedOk = discarded / results.length <= 0.65
        const failsOk = fails / translated <= 0.05
        assert(discardedOk && failsOk)
        done()
      })
  })
})

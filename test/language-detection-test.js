require('dotenv').config()
const assert = require('assert')
const detectLanguage = require('../src/detect-language')
const sample = require('./language-detection-sample')
const minimumTweetLength = Number(process.env.MIN_TWEET_LENGTH) || 0

describe('The language detection mechanism', () => {
  it('should produce the expected results for our given sample', done => {
    const promises = []
    for(const dataSet of sample) {
      promises.push(detectLanguage(dataSet.text))
    }
    Promise.all(promises)
      .then(results => {
        for(const [index, result] of results.entries()) {
          const expected = sample[index].lang
          const returned = result.languages[0].code
          if(expected != returned) {
            console.warn('Returned value is not as expected for text at index ' + index + ':')
            console.log(sample[index].text)
            console.log('Expected:', expected)
            console.log('Returned:', returned)
            console.log(sample[index].text.length)
          }
          assert(returned == expected || sample[index].text.length < minimumTweetLength)
        }
        done()
      })
  })
})
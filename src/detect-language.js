const {cleanUp} = require('./clean-up-text')
const cld = require('cld')

// Promise wrapper for cld.detect
function detectLanguage(text) {
  return new Promise((resolve, reject) => {
    const cleanText = cleanUp(text)
    cld.detect(cleanText, (err, result) => {
      // Also resolve on error because we don't want to log an error
      // every time the translation fails. That's okay.
      resolve(result)
      if (err) {
        resolve()
      } else {
        resolve(result)
      }
    })
  })
}

module.exports = detectLanguage

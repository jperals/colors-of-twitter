require('dotenv').config()
const cld = require('cld')
const parseArgs = require('minimist')

const args = parseArgs(process.argv.slice(2))
let excludedLanguages = []

const excludedLanguagesStr = args.exclude || process.env.EXCLUDE_LANGUAGES
if (excludedLanguagesStr) {
  excludedLanguages = excludedLanguagesStr.split(',')
}

const list = cld.DETECTED_LANGUAGES.map(languageName => {
  const obj = {}
  const languageCode = cld.LANGUAGES[languageName]
  obj.code = languageCode
  obj.name = languageName
  return obj
}).filter(language => !isExcluded(language.code)).sort((a,b) => {
  if(a.code < b.code) {
    return -1
  } else if(b.code < a.code) {
    return 1
  }
  return 0
})

function isExcluded(language) {
  return excludedLanguages && excludedLanguages.length && excludedLanguages.indexOf(language) !== -1
}

module.exports = {
  excludedLanguages,
  isExcluded,
  list
}

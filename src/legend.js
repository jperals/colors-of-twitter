// Generates the map legend

require('dotenv').config()

const chalk = require('chalk')
const cld = require('cld')
const {finish, handleRejection} = require('./common.js')
const jsonfile = require('jsonfile')
const languageColor = require('./language-color')
const languageName = require('./language-name')
const parseArgs = require('minimist')

getLanguages()
  .catch(handleRejection)
  .then(printLegend)
  .then(finish)

function getLanguages() {
  return new Promise((resolve, reject) => {
    const languages = {}
    // Reverse key-value relationship
    for (const name of cld.DETECTED_LANGUAGES) {
      const languageCode = cld.LANGUAGES[name]
      const prettyLanguageName = languageName(languageCode)
      languages[languageCode] = {
        code: languageCode,
        color: languageColor(languageCode),
        name: prettyLanguageName
      }
    }
    resolve(languages)
  })
}

function printLegend(languageData) {
  const args = parseArgs(process.argv.slice(2))
  if (args.json) {
    return jsonfile.writeFile('./output/legend.json', languageData, {spaces: 2})
  } else {
    for (const code in languageData) {
      const language = languageData[code]
      const color = language.color
      const name = language.name
      const colorize = chalk.hex(color)
      console.log(colorize('███'), name, '(' + code + '):', colorize(color))
    }
  }
}

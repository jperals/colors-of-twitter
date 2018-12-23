// Generates the map legend

require('dotenv').config()

const chalk = require('chalk')
const cld = require('cld')
const {finish, handleRejection} = require('./common.js')
const jsonfile = require('jsonfile')
const languageColor = require('./language-color')
const languageNames = require('./language-names')
const parseArgs = require('minimist')

getLanguages()
  .catch(handleRejection)
  .then(printLegend)
  .then(finish)

function getLanguages() {
  return new Promise((resolve, reject) => {
    const languages = {}
    // Reverse key-value relationship
    for (const languageName in cld.LANGUAGES) {
      const languageCode = cld.LANGUAGES[languageName]
      const prettyLanguageName = languageNames[languageCode] ? languageNames[languageCode] : capitalize(languageName)
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

// Transform only first letter of a string to uppercase and the rest to lowercase
// Based on
// https://github.com/grncdr/js-capitalize/blob/master/index.js
function capitalize(str) {
  try {
    str = str.toLowerCase()
    return str.charAt(0).toUpperCase() + str.substring(1)
  } catch (error) {
    return str
  }
}
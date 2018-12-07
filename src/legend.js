// Generates the map legend

require('dotenv').config()

const chalk = require('chalk')
const cld = require('cld')
const {connectToDatabase, finish, handleRejection} = require('./common.js')
const {doInBatches} = require('./db.js')
const languageColor = require('./language-color')
const batchSize = Number(process.env.BATCH_SIZE)
const limit = Number(process.env.LIMIT)
const languageIdentificationEngine = 'cld'
const languageCodes = new Set()

connectToDatabase()
  .catch(handleRejection)
  .then(getLanguages)
  .then(printLegend)
  .then(finish)

function getLanguages(dbClient) {
  const db = dbClient.db(process.env.DATABASE_NAME)
  console.log('Connected to database')
  const collection = db.collection(process.env.COLLECTION_LOCATIONS)
  console.log('Collecting languages in use...')
  return doInBatches(addLocationLanguage, {
    collection,
    batchSize,
    limit
  })
}

function addLocationLanguage ({record}) {
  try {
    const languageCode = record.languageData[languageIdentificationEngine].mainLanguage
    languageCodes.add(languageCode)
  } catch(error) {
    return
  }
}

function getLanguageName(languageCode) {
  const languages = cld.LANGUAGES
  const str = Object.keys(languages).find(key => languages[key] === languageCode)
  return capitalize(str)
}

function getLegend (languageCodes) {
  const languageColors = {}
  for (const languageCode of languageCodes) {
    languageColors[languageCode] = {
      color: languageColor(languageCode),
      name: getLanguageName(languageCode)
    }
  }
  return languageColors
}

function printLegend () {
  const languageData = getLegend(languageCodes)
  const sortedCodes = Array.from(languageCodes).sort()
  for(const code of sortedCodes) {
    const language = languageData[code]
    const color = language.color
    const name = language.name
    const colorize = chalk.hex(color)
    console.log(colorize('███'), name, '(' + code + '):', colorize(color))
  }
}

// Transform only first letter of a string to uppercase and the rest to lowercase
// Based on
// https://github.com/grncdr/js-capitalize/blob/master/index.js
function capitalize(str) {
  try {
    str = str.toLowerCase()
    return str.charAt(0).toUpperCase() + str.substring(1)
  } catch(error) {
    return str
  }
}
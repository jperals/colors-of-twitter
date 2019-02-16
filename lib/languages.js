require('dotenv').config()
const cld = require('cld')
const {getLanguageFences} = require('./fences')

const parseArgs = require('minimist')
const pointInPolygon = require('@turf/boolean-point-in-polygon').default
const turf = require('@turf/helpers')

const args = parseArgs(process.argv.slice(2))
let excludedLanguages = []
const ignoreFences = Boolean(args.raw)

// Minimum tweets collected per location in order to include it in the map

const minTweets = Number(process.env.MIN_TWEETS) || 0

const languageDetectionEngine = 'cld'

// 👇 Possible values for `mainLanguageCriterion`: 'times' or 'score'
// 'times' refers to how many times a language was detected for each location;
// 'score' is the aggregated score of the language in that location.
const mainLanguageCriterion = 'times'

const excludedLanguagesStr = args.exclude || process.env.EXCLUDE_LANGUAGES
if (excludedLanguagesStr) {
  excludedLanguages = excludedLanguagesStr.split(',')
}

function getMainLanguage(record) {
  if (!hasEnoughData(record)) return new Promise((resolve) => resolve())
  const languageData = record.languageData[languageDetectionEngine]
  const languagesObj = languageData.languages
  // Sort them by our main language criterion (time or score)
  const languageCodesSorted = Object.keys(languagesObj).sort((key1, key2) => languagesObj[key2][mainLanguageCriterion] - languagesObj[key1][mainLanguageCriterion])
  const coordinateLatLng = getRecordMiddlePointCoordinate(record)
  const coordinateXY = [coordinateLatLng.lng, coordinateLatLng.lat]
  return getMainLanguageRefined({coordinateXY, languageCodes: languageCodesSorted})
}

function getMainLanguageRefined({coordinateXY, languageCodes, index = 0}) {
  const languageCode = languageCodes[index]
  if (languageCodes.length <= index) {
    // No viable alternative was found
    return new Promise((resolve) => resolve())
  }
  if (isExcluded(languageCode)) {
    // Try the next one
    return getMainLanguageRefined({coordinateXY, languageCodes, index: index + 1})
  } else {
    return isOutsideItsFences(coordinateXY, languageCode)
      .then(isOutside => {
        if (isOutside) {
          // Try the next one
          return getMainLanguageRefined({coordinateXY, languageCodes, index: index + 1})
        } else {
          // Good alternative
          return languageCode
        }
      })
  }
}

function getRecordBoundingBox(dbRecord) {
  const array = dbRecord.boundingBoxId.split(',').map(str => Number(str))
  const matrix = [[array[0], array[1]], [array[2], array[3]], [array[4], array[5]], [array[6], array[7]]]
  return matrix
}

function getRecordMiddlePointCoordinate(dbRecord) {
  const boundingBox = getRecordBoundingBox(dbRecord)
  if (!boundingBox) return
  const lng = (boundingBox[0][0] + boundingBox[2][0]) / 2
  const lat = (boundingBox[0][1] + boundingBox[2][1]) / 2
  return {lat, lng}
}

function hasEnoughData(record) {
  return record.nTweets >= minTweets
}

function isOutsideItsFences(coordinate, languageCode) {
  if (ignoreFences) {
    return new Promise(resolve => resolve(false))
  }
  return getLanguageFences(languageCode)
    .then(fences => {
      for (const feature of fences.features) {
        const point = turf.point(coordinate)
        if (feature.geometry && feature.geometry.type === 'Polygon' && pointInPolygon(point, feature)) {
          return false
        }
      }
      return true
    })
    .catch((err) => {
      return false
    })
}

const list = cld.DETECTED_LANGUAGES.map(languageName => {
  const obj = {}
  const languageCode = cld.LANGUAGES[languageName]
  obj.code = languageCode
  obj.name = languageName
  return obj
}).filter(language => !isExcluded(language.code))
  .sort((a, b) => {
    if (a.code < b.code) {
      return -1
    }
    if (b.code < a.code) {
      return 1
    }
    return 0
  })

function isExcluded(language) {
  return excludedLanguages && excludedLanguages.length && excludedLanguages.indexOf(language) !== -1
}

module.exports = {
  excludedLanguages,
  getMainLanguage,
  getRecordMiddlePointCoordinate,
  list
}

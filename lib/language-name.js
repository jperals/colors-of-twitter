// Returns the nice language name that corresponds to a language code

const languageNameOverrides = require('./language-name-overrides')

const cld = require('cld')
const languagesByCode = {}

for(const cldName in cld.LANGUAGES) {
  const code = cld.LANGUAGES[cldName]
  languagesByCode[code] = capitalize(cldName)
}

function languageName(languageCode) {
  const override = languageNameOverrides[languageCode]
  return override ? override : languagesByCode[languageCode]
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

module.exports = languageName

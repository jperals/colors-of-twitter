const ColorHash = require('color-hash')
const colorHash = new ColorHash()

function languageColor(languageCode) {
  return colorHash.hex(languageCode)
}

module.exports = languageColor

const languageOrder = require('./language-order.json')
const {list} = require('./languages.js')
const Palette = require('./palette.js')
const palette = new Palette({length: list.length}).scramble()
const colorByLanguage = {}
const fallbackColor = 'hsl(200, 0%, 70%)'

for(const languageCode of languageOrder) {
  const color = colorByLanguage[languageCode] || palette.pickNext()
  colorByLanguage[languageCode] = color
}

for (const i in list) {
  const language = list[i]
  if(!colorByLanguage[language.code]) {
    colorByLanguage[language.code] = palette.pickNext()
  }
}

function languageColor(languageCode) {
  return colorByLanguage[languageCode] || fallbackColor
}

module.exports = languageColor

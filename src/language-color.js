const cld = require('cld')
const chroma = require('chroma-js')
const {list} = require('./languages.js')
// Sort by language code
const length = list.length
const saturationArray = ['0.3', '0.8']
const ligthnessArray = ['0.4', '0.55', '0.7']

const scale = chroma.scale(['crimson', 'orange', 'limegreen', 'darkcyan', 'royalblue', 'mediumpurple', 'mediumorchid', 'darksalmon', 'chocolate'])
const palette = scale.colors(length)

for(let i = 0; i < length; i++) {
  const lightness = ligthnessArray[i % ligthnessArray.length]
  const saturation = saturationArray[i % saturationArray.length]
  palette[i] = chroma(palette[i]).set('hsl.s', saturation).set('hsl.l', lightness).hex()
}

const colorByLanguage = {}
const fallbackColor = 'hsl(200, 0%, 70%)'

for (const i in list) {
  const language = list[i]
  colorByLanguage[language.code] = palette[i]
}

function languageColor(languageCode) {
  return colorByLanguage[languageCode] || fallbackColor
}

module.exports = languageColor

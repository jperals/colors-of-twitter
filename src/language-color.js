const {list} = require('./languages.js')
const Palette = require('./palette.js')
const length = list.length
const palette = new Palette({length: list.length})
const colorByLanguage = {}
const fallbackColor = 'hsl(200, 0%, 70%)'
const optimized = optimizePaletteOrder(palette)

for (const i in list) {
  const language = list[i]
  colorByLanguage[language.code] = optimized[i]
}

function languageColor(languageCode) {
  return colorByLanguage[languageCode] || fallbackColor
}

function optimizePaletteOrder(palette) {
  const set = new Set(palette)
  const optimized = []
  let currentStep = 0
  for(let i = 0; i < length; i++) {
    const colorToAdd = Array.from(set)[currentStep]
    optimized.push(colorToAdd)
    set.delete(colorToAdd)
    const step = Math.round(set.size / palette.basePalette.length)
    currentStep += step + 2
    if(set.size <= currentStep) {
      currentStep = 0
    }
  }
  return optimized
}

module.exports = languageColor

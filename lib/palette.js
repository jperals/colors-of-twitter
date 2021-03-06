const chroma = require('chroma-js')
const defaultSaturationArray = ['0.4', '0.5', '0.65', '0.85']
const defaultLightnessArray = ['0.4', '0.55', '0.65']
const defaultBasePalette = ['crimson', 'orange', 'yellowgreen', 'darkcyan',  'royalblue', 'mediumpurple', 'red']

class Palette {
  constructor({
                length = 10,
                basePalette = defaultBasePalette,
                lightnessArray = defaultLightnessArray,
                saturationArray = defaultSaturationArray
              }) {
    this.baseColors = basePalette
    this.length = length
    this.lightnessArray = lightnessArray
    this.saturationArray = saturationArray
    this.buildColors()
  }

  buildColors() {
    this.colors = []
    const scale = chroma.scale(this.baseColors)
    const palette = scale.colors(this.length)
    for (let i = 0; i < this.length; i++) {
      const lightness = this.lightnessArray[i % this.lightnessArray.length]
      const saturation = this.saturationArray[i % this.saturationArray.length]
      this.colors[i] = chroma(palette[i]).set('hsl.s', saturation).set('hsl.l', lightness).hex()
    }
  }

  getMostDistantColor(color) {
    const reducer = (accumulator, currentValue) => {
      const currentDistance = chroma.distance(accumulator, color)
      const newDistance = chroma.distance(currentValue, color)
      if (currentDistance < newDistance) {
        return currentValue
      } else return accumulator
    }
    return this.colors.reduce(reducer, color)
  }

  scramble() {
    const set = new Set(this.colors)
    const scrambled = []
    let currentStep = Math.round(this.baseColors.length * 0.4)
    for(let i = 0; i < this.colors.length; i++) {
      const colorToAdd = Array.from(set)[currentStep]
      scrambled.push(colorToAdd)
      set.delete(colorToAdd)
      const step = Math.round(1.3 * set.size / this.baseColors.length)
      currentStep = (currentStep + step) % set.size
    }
    this.colors = scrambled
    return this
  }

  pick(colorOrIndex) {
    const isIndex = typeof colorOrIndex === 'number'
    const index = isIndex ? colorOrIndex : this.colors.indexOf(colorOrIndex)
    if (index !== -1) {
      const color = this.colors[index]
      this.colors.splice(index, 1)
      return color
    }
  }

  pickMostDistantColor(color) {
    return this.pick(this.getMostDistantColor(color))
  }

  pickNext() {
    return this.pick(0)
  }

  randomColor() {
    const index = Math.min(0, Math.floor(Math.random() * this.colors.length))
    return this.colors[index]
  }

  reset() {
    this.buildColors()
  }
}

module.exports = Palette

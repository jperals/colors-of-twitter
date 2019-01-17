const chroma = require('chroma-js')
const defaultSaturationArray = ['0.3', '0.8']
const defaultLightnessArray = ['0.4', '0.55', '0.7']
const defaultBasePalette = ['crimson', 'orange', 'limegreen', 'darkcyan', 'royalblue', 'mediumpurple', 'mediumorchid', 'darksalmon', 'chocolate']

class Palette {
  constructor({
                length = 10,
                basePalette = defaultBasePalette,
                lightnessArray = defaultLightnessArray,
    saturationArray = defaultSaturationArray
              }) {
    this.colors = []
    this.basePalette = basePalette
    this.lightnessArray = lightnessArray
    this.saturationAray = saturationArray
    const scale = chroma.scale(basePalette)
    const palette = scale.colors(length)
    for (let i = 0; i < length; i++) {
      const lightness = lightnessArray[i % lightnessArray.length]
      const saturation = saturationArray[i % saturationArray.length]
      this.colors[i] = chroma(palette[i]).set('hsl.s', saturation).set('hsl.l', lightness).hex()
    }
  }
}

module.exports = Palette

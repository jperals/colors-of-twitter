const ColorHash = require('color-hash')
const chroma = require('chroma-js')
const colorHash = new ColorHash()
const minLuminance = 0.3
const maxLuminance = 0.6
const minSaturation = 0.4
const maxSaturation = 0.6

function languageColor(languageCode) {
  const hashColor = colorHash.hex(languageCode)
  const chromaColor = chroma(hashColor)
  const saturation = chromaColor.get('hsv.s')
  if(saturation < minSaturation) {
    chromaColor.set('hsv.s', minSaturation)
  } else if(maxSaturation < saturation) {
    chromaColor.set('hsv.s', maxSaturation)
  }
  const luminance = chromaColor.get('lab.l')
  if(luminance < minLuminance) {
    chromaColor.set('lab.l', minLuminance)
  } else if(maxLuminance < luminance) {
    chromaColor.set('lab.l', maxLuminance)
  }
  return chromaColor.hex()
}

module.exports = languageColor

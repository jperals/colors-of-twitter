const chalk = require('chalk')
const {list} = require('../src/languages.js')
const length = list.length
const Palette = require('../src/palette.js')
const palette = new Palette({length})

describe('The palette', () => {
  it('should contain distinct colors', () => {
    console.log('Full palette:')
    printEvery(1)
    console.log('Same saturation factor, varying lightness factor:')
    printEvery(palette.saturationAray.length)
    console.log('Same lightness factor, varying saturation factor:')
    printEvery(palette.lightnessArray.length)
    console.log('Same saturation factor, same lightness factor:')
    printEvery(palette.saturationAray.length*palette.lightnessArray.length)
  })
})

function printEvery(n) {
  for(let initialIndex = 0; initialIndex < n; initialIndex++) {
    for(let index = initialIndex; index < length; index += n) {
      const color = palette.colors[index]
      const colorize = chalk.hex(color)
      process.stdout.write(colorize('█'))
    }
    process.stdout.write('\n')
  }
}

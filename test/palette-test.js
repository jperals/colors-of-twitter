const chalk = require('chalk')
const {list} = require('../lib/languages.js')
const length = list.length
const Palette = require('../lib/palette.js')
const palette = new Palette({length})

describe('The palette', () => {
  it('should contain distinct colors', () => {
    console.log('Full palette:')
    printEvery(1)
    console.log('Same saturation factor, varying lightness factor:')
    printEvery(palette.saturationArray.length)
    console.log('Same lightness factor, varying saturation factor:')
    printEvery(palette.lightnessArray.length)
    console.log('Same saturation factor, same lightness factor:')
    printEvery(palette.saturationArray.length*palette.lightnessArray.length)
    console.log('Scrambled palette:')
    palette.scramble()
    printEvery(1)
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

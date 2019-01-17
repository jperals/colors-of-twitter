const chalk = require('chalk')
const {list} = require('../src/languages.js')
const Palette = require('../src/palette.js')
const palette = new Palette({length: list.length})

describe('The palette', () => {
  it('should contain distinct colors', () => {
    console.log('Full palette:')
    printEvery(1)
    console.log('Same saturation factor, varying lightness factor:')
    printEvery(palette.lightnessArray.length)
    console.log('Same lightness factor, varying saturation factor:')
    printEvery(palette.saturationAray.length)
  })
})

function printEvery(n) {
  for(let initialIndex = 0; initialIndex < n; initialIndex++) {
    for(let index = initialIndex; index < list.length; index += n) {
      const color = palette.colors[index]
      const colorize = chalk.hex(color)
      process.stdout.write(colorize('█'))
    }
    process.stdout.write('\n')
  }
}

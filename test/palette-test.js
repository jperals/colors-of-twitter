const assert = require('assert')
const chalk = require('chalk')
const {list} = require('../lib/languages.js')
const length = list.length
const Palette = require('../lib/palette.js')
const args = require('minimist')(process.argv.slice(2))

const beVerbose = Boolean(args.verbose)

describe('The palette generator', () => {
  it('should generate distinct colors', () => {
    const length = 180
    const palette = new Palette({length})
    if(beVerbose) {
      console.log('Full palette:')
      printEvery(palette, 1)
      console.log('Same saturation factor, varying lightness factor:')
      printEvery(palette, palette.saturationArray.length)
      console.log('Same lightness factor, varying saturation factor:')
      printEvery(palette, palette.lightnessArray.length)
      console.log('Same saturation factor, same lightness factor:')
      printEvery(palette, palette.saturationArray.length*palette.lightnessArray.length)
      console.log('Scrambled palette:')
      palette.scramble()
      printEvery(palette, 1)
    }
    // It's hard to tell whether the colors are perceptually different
    // (for this, add the `verbose` argument to see them by yourself)
    // but we can at least assert that they are unique.
    const set = new Set(palette.colors)
    const allUnique = set.size === palette.colors.length
    assert(allUnique)
  })
})

function printEvery(palette, n) {
  for(let initialIndex = 0; initialIndex < n; initialIndex++) {
    for(let index = initialIndex; index < length; index += n) {
      const color = palette.colors[index]
      const colorize = chalk.hex(color)
      process.stdout.write(colorize('█'))
    }
    process.stdout.write('\n')
  }
}

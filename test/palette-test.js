const chalk = require('chalk')
const languageColor = require('../src/language-color')
const {list} = require('../src/languages.js')

describe('The palette', () => {
  it('should contain distinct colors', () => {
    console.log('Full palette:')
    printEvery(1)
    console.log('Same saturation factor, varying lightness factor:')
    printEvery(2)
    console.log('Same lightness factor, varying saturation factor:')
    printEvery(3)
  })
})

function printEvery(n) {
  for(let initialIndex = 0; initialIndex < n; initialIndex++) {
    for(let index = initialIndex; index < list.length; index += n) {
      const {code} = list[index]
      const color = languageColor(code)
      const colorize = chalk.hex(color)
      process.stdout.write(colorize('█'))
    }
    process.stdout.write('\n')
  }
}

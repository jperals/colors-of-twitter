const assert = require('assert')
const {removeEmojis} = require('../src/clean-up-text')

describe('removeEmojis', () => {
  it('should remove one single emoji at the end of a text', () => {
    const originalText = "@vitoriafsantoss Vem pra gp 😊"
    const expectedResult = "@vitoriafsantoss Vem pra gp "
    const result = removeEmojis(originalText)
    assert.equal(result, expectedResult)
  })
  it('should remove one single emoji in the middle of a text', () => {
    const originalText = "@normornormor แกกลับจริงดิ 😭 ยังไม่เจอหน้าเลย"
    const expectedResult = "@normornormor แกกลับจริงดิ  ยังไม่เจอหน้าเลย"
    const result = removeEmojis(originalText)
    assert.equal(result, expectedResult)
  })
  it('should remove several instances of the same emoji', () => {
    const originalText = "🤣🤣🤣🤣🤣🤣🤣🤣 \nSe merecem!!!"
    const expectedResult = " \nSe merecem!!!"
    const result = removeEmojis(originalText)
    assert.equal(result, expectedResult)
  })
  it('should remove different emojis', () => {
    const originalText = "I see ya mel ‼️🏆🙏🏽"
    const expectedResult = "I see ya mel "
    const result = removeEmojis(originalText)
    assert.equal(result, expectedResult)
  })
  it('should remove different emojis in different places', () => {
    const originalText = "‘If it’s meant to be, it shall be’ 💕 last Long Sister 🤩 I’m so happy you stayed so strong all these while with so m… https://t.co/BuTufYvx41"
    const expectedResult = "‘If it’s meant to be, it shall be’  last Long Sister  I’m so happy you stayed so strong all these while with so m… https://t.co/BuTufYvx41"
    const result = removeEmojis(originalText)
    assert.equal(result, expectedResult)
  })
})

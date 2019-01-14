const assert = require('assert')
const {removeEmojis, removeHashtags, removeUrls, removeUserMentions} = require('../src/clean-up-text')

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

describe('removeHashtags', () => {
  it('should remove hashtags', () => {
    const originalText = 'Colston DiBlasi in the hole on mat 1 #BeUncommon'
    const expectedResult = 'Colston DiBlasi in the hole on mat 1 '
    const result = removeHashtags(originalText)
    assert.equal(result, expectedResult)
  })
})

describe('removeUrls', () => {
  it('should convert a text that consists of only a Twitter URL into an empty string', () => {
    const originalText = 'https://t.co/oZq3LeSw6K'
    const expectedResult = ''
    const result = removeUrls(originalText)
    assert.equal(result, expectedResult)
  })
  it('should remove a URL from the end of a string', () => {
    const originalText = '@ZoeKirkwood This is your actual hard drive 🙈 https://t.co/kyKrfEdtV4'
    const expectedResult = '@ZoeKirkwood This is your actual hard drive 🙈 '
    const result = removeUrls(originalText)
    assert.equal(result, expectedResult)
  })
})

describe('removeUserMentions', () => {
  it('should remove a user mention from a string', () => {
    const originalText = '@ZoeKirkwood This is your actual hard drive 🙈 https://t.co/kyKrfEdtV4'
    const expectedResult = ' This is your actual hard drive 🙈 https://t.co/kyKrfEdtV4'
    const result = removeUserMentions(originalText)
    assert.equal(result, expectedResult)
  })
})


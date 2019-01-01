const emojiRegex = require('emoji-regex')

function cleanUp(str) {
  return removeEmojis(removeUrls(str))
}

function removeEmojis(str) {
  let match
  while(match = emojiRegex().exec(str)) {
    const emoji = match[0]
    const index = match.index
    const length = emoji.length
    const part1 = str.substr(0, index)
    const part2 = str.substr(index + length)
    str = part1.concat(part2)
  }
  return str
}

function removeUrls(str) {
  return str
}

module.exports = {
  cleanUp,
  removeEmojis,
  removeUrls
}

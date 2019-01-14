const emojiRegex = require('emoji-regex')
const hashtagRegex = require('hashtag-regex')

// Twitter username mention regex
// https://stackoverflow.com/questions/8650007/regular-expression-for-twitter-username
const userMentionRegex = /(^|[^@\w])@(\w{1,15})\b/g
// URL regex
// https://knowledge.safe.com/questions/29604/regex-to-extract-url-from-tweet.html
const urlRegex = /(https?:\/\/)(\s)?(www\.)?(\s?)(\w+\.)*([\w\-\s]+\/)*([\w-]+)\/?/

function cleanUp(str) {
  return removeWhiteSpace(removeEmojis(removeHashtags(removeUrls(removeUserMentions(str)))))
}

function removeEmojis(str) {
  return removeByRegex(str, emojiRegex())
}

function removeHashtags(str) {
  return removeByRegex(str, hashtagRegex())
}

function removeByRegex(str, regex) {
  return str.replace(regex, '')
}

function removeUrls(str) {
  return removeByRegex(str, urlRegex)
}

function removeUserMentions(str) {
  return removeByRegex(str, userMentionRegex)
}

function removeWhiteSpace(str) {
  return str.replace(/\s\s+/g, ' ').trim()
}

module.exports = {
  cleanUp,
  removeEmojis,
  removeHashtags,
  removeUrls,
  removeUserMentions
}

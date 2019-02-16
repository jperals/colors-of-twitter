const {connectToDatabase, finish, handleRejection} = require('./common.js')
const languageName = require('./language-name')
const {nDecimals} = require('./math')
const {getAllStats} = require('./stats.js')

connectToDatabase()
  .catch(handleRejection)
  .then(getAllStats)
  .then(printStats)
  .then(finish)

function printStats({languageStats, locationStats, tweetStats}) {
  printTweetStats(tweetStats)
  printLocationStats(locationStats)
  printLanguageStats(languageStats, locationStats)
}

function printLanguageStats(languageStats, locationStats) {
  const strStats = []
  const limit = 15
  let added = 0
  for(let i = 0; i < languageStats.length && added < limit; i++) {
    const languageCount = languageStats[i]
    const name = languageName(languageCount.code)
    if(name) {
      const percentage = languageCount.count * 100 / locationStats.totalSize
      const rounded = nDecimals(percentage, 2)
      strStats.push(name + ': ' + rounded + '%')
      added++
    }
    i++
  }
  console.log('Language statistics:', strStats.join(', '))
}

function printLocationStats(stats) {
  console.log('Unique locations:', stats.totalSize.toLocaleString())
}

function printTweetStats(stats) {
  console.log('Tweets collected:', stats.totalSize.toLocaleString())
}

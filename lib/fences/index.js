const fs = require('fs')
const jsonfile = require('jsonfile')
const path = require('path')

const cache = {
  dirContents: null,
  fences: {}
}

function getLanguageFences(languageCode) {
  return new Promise((resolve, reject) => {
    if (cache.fences[languageCode]) {
      resolve(cache.fences[languageCode])
    } else {
      const filename = getFilenameFromLanguageCode(languageCode)
      jsonfile.readFile(path.join(__dirname, filename))
        .then(content => {
          cache.fences[languageCode] = content
          resolve(content)
        })
        .catch(err => reject(err))
    }
  })
}

function getAllFences() {
  return getFenceFiles()
    .then(filenames => {
      Promise.all(filenames.map((filename) => [filename, jsonfile(filename)]))
    })
    .then(results => {
      for (let [filename, content] of results) {
        const languageCode = getLanguageCodeFromFilename(filename)
        cache.fences[languageCode] = content
      }
    })
}

function getFenceFiles() {
  return new Promise((resolve, reject) => {
    if (cache.dirContents) {
      resolve(cache.dirContents)
    } else {
      fs.readdir(__dirname, (err, filenames) => {
        if (err) {
          reject(err)
        } else {
          cache.dirContents = filenames.filter(filename => filename !== path.basename(__filename))
          resolve(cache.dirContents)
        }
      })
    }
  })
}

function getFilenameFromLanguageCode(languageCode) {
  return languageCode + '.json'
}

function getLanguageCodeFromFilename(filename) {
  try {
    return filename.split('.')[0]
  } catch (err) {
    return
  }
}

module.exports = {
  getLanguageFences
}

// Apply manually made territorial limits to specific languages

require('dotenv').config()
const fs = require('fs')
const jsonfile = require('jsonfile')
const parseArgs = require('minimist')
const path = require('path')

const args = parseArgs(process.argv.slice(2))
let fencesStr = args.fences || process.env.FENCES
if(typeof fencesStr === 'undefined' && (args.hasOwnProperty('fences') || process.env.hasOwnProperty('fences'))) {
  fencesStr = ''
}

// By default, apply this technique to the English language only.
const fences = typeof fencesStr === 'string' ? fencesStr.split(',') : ['en']

const cache = {
  dirContents: null,
  fences: {}
}

function getLanguageFences(languageCode) {
  return new Promise((resolve, reject) => {
    if (fences.indexOf(languageCode) === -1) {
      reject()
    }
    else if (cache.fences[languageCode]) {
      resolve(cache.fences[languageCode])
    }
    else {
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

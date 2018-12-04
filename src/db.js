const cliProgress = require('cli-progress')

let progressBar

function doInBatches(callbackFunction, {collection, startFromId, batchSize, limit, doneCount = 0, query = {}, batchCallBack, message, inSequence = false}) {
  if(message) {
    console.log(message)
  }
  return new Promise((resolve, reject) => {
    getRecordBatch({collection, startFromId, batchSize, query})
      .catch(err => {
        endUpdate()
        reject(err)
      })
      .then(batchItems => {
        if (batchItems.length) {
          doneCount += batchItems.length
          if (batchCallBack) {
            batchCallBack(doneCount)
          }
          startFromId = batchItems[batchItems.length - 1]._id
          if (inSequence) {
            return runInSequence({callbackFunction, collection, batchItems})
          } else {
            const promises = []
            for (const record of batchItems) {
              promises.push(callbackFunction({record, collection}))
            }
            return Promise.all(promises)
          }
        } else {
          endUpdate()
          resolve(doneCount)
        }
      })
      .then(() => {
        reportUpdate({doneCount, limit})
        if (doneCount < limit) {
          resolve(doInBatches(callbackFunction, {
            collection,
            startFromId,
            doneCount,
            batchSize,
            limit,
            query,
            batchCallBack,
            inSequence
          }))
        } else {
          endUpdate()
          resolve(doneCount)
        }
      })
  })
}

function endUpdate() {
  if (progressBar) {
    progressBar.stop()
  }
  progressBar = undefined
}

function getRecordBatch({collection, startFromId, batchSize, query = {}}) {
  if (typeof query === 'undefined') {
    query = {}
  }
  if (typeof startFromId !== 'undefined') {
    Object.assign(query, {
      _id: {
        '$gt': startFromId
      }
    })
  }
  return collection.find(
    query,
    {
      limit: batchSize,
      sort: {
        _id: 1
      }
    }).toArray()
}

function reportUpdate({doneCount, limit}) {
  if (!progressBar) {
    progressBar = new cliProgress.Bar({}, cliProgress.Presets.shades_classic)
    progressBar.start(limit, 0)
  }
  progressBar.update(doneCount)
}

function runInSequence({callbackFunction, collection, batchItems, startFromIndex: index = 0}) {
  return new Promise((resolve, reject) => {
    if (batchItems.length > index) {
      callbackFunction({record: batchItems[index], collection})
        .catch(error => {
          console.error(error)
          resolve(runInSequence({callbackFunction, batchItems, startFromIndex: index + 1}))
        })
        .then(() => {
          resolve(runInSequence({callbackFunction, batchItems, startFromIndex: index + 1}))
        })
    } else {
      resolve(index)
    }
  })
}

module.exports = {
  doInBatches
}

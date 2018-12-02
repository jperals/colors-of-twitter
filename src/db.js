const cliProgress = require('cli-progress')

let progressBar

function doInBatches(callbackFunction, {collection, startFromId, batchSize, limit, doneCount = 0, query = {}, batchCallBack, message}) {
  return new Promise((resolve, reject) => {
    getRecordBatch({collection, startFromId, batchSize, query})
      .catch(err => {
        endUpdate()
        reject(err)
      })
      .then(batchItems => {
        if (batchItems.length) {
          doneCount += batchItems.length
          const promises = []
          if (batchCallBack) {
            batchCallBack(doneCount)
          }
          reportUpdate({doneCount, limit})
          for (const record of batchItems) {
            promises.push(callbackFunction({record, collection}))
          }
          startFromId = batchItems[batchItems.length - 1]._id
          return Promise.all(promises)
        } else {
          endUpdate()
          resolve(doneCount)
        }
      })
      .then(() => {
        if (doneCount < limit) {
          resolve(doInBatches(callbackFunction, {
            collection,
            startFromId,
            doneCount,
            batchSize,
            limit,
            query,
            batchCallBack
          }))
        } else {
          endUpdate()
          resolve(doneCount)
        }
      })
  })
}

function endUpdate() {
  progressBar.stop()
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

module.exports = {
  doInBatches
}

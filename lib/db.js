const ProgressBar = require('progress')

let progressBar

function doInBatches(callbackFunction, {collection, startFromId, batchSize = 1000, limit = Infinity, doneCount = 0, query = {}, batchCallBack, message, inSequence = false, firstCall = true, live = false, estimatedCount, reportProgress = true}) {
  if (message) {
    console.log(message)
  }
  return new Promise((resolve, reject) => {
    if (firstCall && !live) {
      // If the collection is shorter than the limit,
      // adapt the limit so we can report accordingly.
      // If you want to avoid this behavior because the database might be updating
      // while retrieving documents or whatever reason, pass the `live` argument as true.
      collection.estimatedDocumentCount()
        .then(nDocuments => {
          estimatedCount = Math.min(limit, nDocuments)
          resolve(doInBatches(callbackFunction, {
            collection,
            startFromId,
            batchSize,
            limit,
            doneCount,
            query,
            batchCallBack,
            inSequence,
            firstCall: false,
            estimatedCount,
            reportProgress
          }))
        })
      return
    }
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
            const calls = []
            for (const record of batchItems) {
              calls.push(callbackFunction({record, collection}))
            }
            if (calls.length && calls[0] && typeof calls[0].then === 'function') {
              return Promise.all(calls)
            } else {
              return calls[calls.length - 1]
            }
          }
        } else {
          endUpdate()
          resolve(doneCount)
        }
      })
      .then(result => {
        if (reportProgress) {
          reportUpdate({doneCount, estimatedCount})
        }
        if (doneCount < limit) {
          resolve(doInBatches(callbackFunction, {
            collection,
            startFromId,
            doneCount,
            batchSize,
            limit,
            query,
            batchCallBack,
            inSequence,
            firstCall: false,
            estimatedCount,
            reportProgress
          }))
        } else {
          endUpdate()
          resolve(doneCount)
        }
      })
  })
}

function endUpdate() {
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

function reportUpdate({doneCount, estimatedCount}) {
  if (!progressBar && doneCount < estimatedCount) {
    progressBar = new ProgressBar(':bar :percent | :current/:total | ETA: :etas', {
      complete: '█',
      incomplete: '░',
      total: estimatedCount
    })
  }
  if (progressBar) {
    progressBar.update(doneCount/estimatedCount)
  }
}

function runInSequence({callbackFunction, collection, batchItems, startFromIndex}) {
  const index = typeof startFromIndex === 'undefined' ? 0 : startFromIndex
  return new Promise((resolve, reject) => {
    if (batchItems.length > index) {
      const record = batchItems[index]
      callbackFunction({record, collection})
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

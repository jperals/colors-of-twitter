function doInBatches({collection, callbackFunction, startFromId, batchSize, limit, doneCount = 0, query = {}}) {
  return new Promise((resolve, reject) => {
    getRecordBatch({collection, startFromId, batchSize, query})
      .catch(err => {
        reject(err)
      })
      .then(batchItems => {
        doneCount += batchItems.length
        callbackFunction({collection, records: batchItems})
        if (batchItems.length && doneCount < limit) {
          const startFromId = batchItems[batchItems.length - 1]._id
          resolve(doInBatches({collection, callbackFunction, startFromId, doneCount, batchSize, limit, query}))
        } else {
          resolve(doneCount)
        }
      })
  })
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

module.exports = {
  doInBatches
}

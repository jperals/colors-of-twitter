function doInBatches(callbackFunction, {collection, startFromId, batchSize, limit, doneCount = 0, query = {}}) {
  return new Promise((resolve, reject) => {
    getRecordBatch({collection, startFromId, batchSize, query})
      .catch(err => {
        reject(err)
      })
      .then(batchItems => {
        if (batchItems.length) {
          doneCount += batchItems.length
          const promises = []
          for (const record of batchItems) {
            promises.push(callbackFunction({record, collection}))
          }
          startFromId = batchItems[batchItems.length - 1]._id
          return Promise.all(promises)
        } else {
          resolve(doneCount)
        }
      })
      .then(() => {
        if (doneCount < limit) {
          resolve(doInBatches(callbackFunction, {collection, startFromId, doneCount, batchSize, limit, query}))
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

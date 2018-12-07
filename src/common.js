const MongoClient = require('mongodb').MongoClient

function connectToDatabase() {
  return MongoClient.connect(process.env.DATABASE_URL, {useNewUrlParser: true})
}

function finish() {
  console.log('Done.')
  process.exit(0)
}

function handleRejection(error) {
  console.error(error)
  process.exit(1)
}

module.exports = {
  connectToDatabase,
  finish,
  handleRejection
}

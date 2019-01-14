require('dotenv').config()
const MongoClient = require('mongodb').MongoClient

function connectToDatabase() {
  return MongoClient.connect(process.env.DATABASE_URL, {useNewUrlParser: true})
    .then(client => {
      const db = client.db(process.env.DATABASE_NAME)
      console.log('Connected to the database')
      return db
    })
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

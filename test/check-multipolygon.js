const jsonfile = require('jsonfile')
const parseArgs = require('minimist')

const filename = parseArgs(process.argv.slice(2)).file
if(filename) {
  jsonfile.readFile(filename)
    .then(geojson => {
      for(const p of geojson.geometry.coordinates) {
        for(const l of p) {
          // console.log(p.length)
          if(l.length < 4) {
            console.log('!')
          }
        }
      }
    })
}

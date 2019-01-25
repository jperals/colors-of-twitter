const map = L.map('map').setView([25, 2], 2)

L.tileLayer('https://api.mapbox.com/styles/v1/jperals/cjppwqrjc0c302rmls938rydi/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoianBlcmFscyIsImEiOiJjajR4NnhwazUwcGdvMzNxbnMzY3Qza3BvIn0.Ae2Eze-ABuDGlilGHthLXQ', {
  attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Background map imagery © <a href="https://www.mapbox.com/">Mapbox</a>, Land and sea profile <a href="http://naturalearthdata.com/">Natural Earth</a>',
  maxZoom: 18,
  id: 'mapbox.satellite',
  accessToken: 'pk.eyJ1IjoianBlcmFscyIsImEiOiJjajR4NnhwazUwcGdvMzNxbnMzY3Qza3BvIn0.Ae2Eze-ABuDGlilGHthLXQ'
}).addTo(map)

Promise.all([
  fetch('./data/language-areas.json')
  .then(buffer => buffer.text())
  .then(text => JSON.parse(text)),
  fetch('./data/legend.json')
  .then(buffer => buffer.text())
  .then(text => JSON.parse(text))
])
  .then(([geojson, legend]) => {
    L.geoJSON(geojson, {
      style: function (feature) {
        return {
          fillColor: languageColor(feature.properties.language, legend),
          fillOpacity: 0.6,
          weight: 0
        }
      },
      onEachFeature: (feature, layer) => {
        const langName = languageName(layer.feature.properties.language, legend)
        const articleName = langName + '_language'
        layer.on({
          click: () => {
            window.open('https://en.wikipedia.org/wiki/' + articleName, '_blank')
          }
        })
    }
    }).bindTooltip(function(layer) {
      return languageName(layer.feature.properties.language, legend)
    }, {
      sticky: true
    })
      .addTo(map)
  })

function languageColor(languageCode, legend) {
  if(legend[languageCode]) {
    return legend[languageCode].color
  }
}

function languageName(languageCode, legend) {
  if(legend[languageCode]) {
    return legend[languageCode].name
  }
  return '(' + languageCode + ')'
}
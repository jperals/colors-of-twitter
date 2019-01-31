const map = L.map('map', {
  attributionControl: false
}).setView([25, 2], 2)

map.createPane('political-layer')
// map.getPane('political-layer').style.zIndex = 1000
map.getPane('political-layer').style.pointerEvents = 'none'

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
      }
    }).bindTooltip(function (layer) {
      return languageName(layer.feature.properties.language, legend)
    }, {
      pane: 'political-layer',
      sticky: true
    })
      .addTo(map)
    L.tileLayer('https://api.mapbox.com/styles/v1/jperals/cjri9ka986il62to7wcwj3xbs/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoianBlcmFscyIsImEiOiJjajR4NnhwazUwcGdvMzNxbnMzY3Qza3BvIn0.Ae2Eze-ABuDGlilGHthLXQ', {
      maxZoom: 18,
      id: 'mapbox.satellite',
      accessToken: 'pk.eyJ1IjoianBlcmFscyIsImEiOiJjajR4NnhwazUwcGdvMzNxbnMzY3Qza3BvIn0.Ae2Eze-ABuDGlilGHthLXQ',
      opacity: 0.8,
      // pane: 'political-layer'
    }).addTo(map)

  })

L.control.attribution({
  prefix: false
}).addAttribution('&copy; <a href="https://perals.io">Joan Perals</a> 2019 | Using <a href="https://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> | Background map imagery © <a href="https://www.mapbox.com/">Mapbox</a>').addTo(map)

function languageColor(languageCode, legend) {
  if (legend[languageCode]) {
    return legend[languageCode].color
  }
}

function languageName(languageCode, legend) {
  if (legend[languageCode]) {
    return legend[languageCode].name
  }
  return '(' + languageCode + ')'
}
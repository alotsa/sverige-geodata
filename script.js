// Global variabel för GeoJSON-lagret
let geojsonLayer;

// Initialize a Leaflet map
const map = L.map('map').setView([62.0, 15.0], 5);

// Add a tile layer (background map)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Fetch and display the GeoJSON file med click events på varje feature
fetch('data/your-data.geojson')
  .then(response => response.json())
  .then(geojsonData => {
    // Skapa GeoJSON-lagret med click events
    geojsonLayer = L.geoJSON(geojsonData, {
      onEachFeature: function(feature, layer) {
        layer.on('click', function(e) {
          // Stoppa bubbla så att globalt klick inte triggas
          L.DomEvent.stopPropagation(e);
          fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
            .then(response => response.json())
            .then(data => {
              const county = data.address.county || "Okänt län";
              const municipality = data.address.municipality || data.address.town || "Okänd kommun";
              const popupContent = `
                <p>
                  Landskap: ${feature.properties.landskap}<br>
                  Län: ${county}<br>
                  Kommun: ${municipality}
                </p>
              `;
              L.popup()
                .setLatLng(e.latlng)
                .setContent(popupContent)
                .openOn(map);
            })
            .catch(error => console.error('Error during reverse geocoding:', error));
        });
      }
    });
    
    // Skapa ett overlay-objekt för lagerkontrollen
    var overlayMaps = {
      "Landskap": geojsonLayer
    };
    
    // Lägg till lagerkontrollen på kartan
    L.control.layers(null, overlayMaps, {collapsed: false}).addTo(map);
    
    // Lägg till GeoJSON-lagret på kartan så att det visas från början
    map.addLayer(geojsonLayer);
  })
  .catch(error => console.error('Error loading GeoJSON:', error));


// Globalt klick på kartan (för klick utanför polygoner)
map.on('click', function(e) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.latlng.lat}&lon=${e.latlng.lng}`)
    .then(response => response.json())
    .then(data => {
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<p>${data.display_name}</p>`)
        .openOn(map);
    })
    .catch(error => console.error('Error during reverse geocoding:', error));
});


// Sökfunktion för koordinater
document.getElementById('searchButton').addEventListener('click', function() {
  const lat = parseFloat(document.getElementById('latitude').value);
  const lng = parseFloat(document.getElementById('longitude').value);
  
  if (isNaN(lat) || isNaN(lng)) {
    alert('Ange giltiga koordinater.');
    return;
  }
  
  // Flytta kartan till den sökta positionen med en passande zoomnivå
  map.setView([lat, lng], 10);
  
  // Använd reverse geocoding för att hämta län och kommun
  fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
    .then(response => response.json())
    .then(data => {
      const county = data.address.county || "Okänt län";
      const municipality = data.address.municipality || data.address.town || "Okänd kommun";
      
      // Försök hitta om den sökta punkten ligger inom ett landskap
      let foundLandskap = "Okänt landskap";
      if (geojsonLayer) {
        geojsonLayer.eachLayer(function(layer) {
          if (layer.feature && layer.feature.geometry) {
            const pt = turf.point([lng, lat]); // Turf.js använder [lng, lat]
            const poly = layer.feature;
            if (turf.booleanPointInPolygon(pt, poly)) {
              foundLandskap = poly.properties.landskap;
            }
          }
        });
      }
      
      const popupContent = `
        <p>
          Landskap: ${foundLandskap}<br>
          Län: ${county}<br>
          Kommun: ${municipality}
        </p>
      `;
      
      L.marker([lat, lng]).addTo(map)
        .bindPopup(popupContent)
        .openPopup();
    })
    .catch(error => console.error('Error during reverse geocoding:', error));
});


// Sökfunktion för platser med lista på resultat
document.getElementById('searchPlaceButton').addEventListener('click', function() {
  const query = document.getElementById('placeName').value.trim();
  
  if (query === '') {
    alert("Ange ett platsnamn att söka efter.");
    return;
  }
  
  // Rensa tidigare resultat
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = "";
  
  // Skicka en förfrågan till Nominatim för att söka efter platsen
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      if (data && data.length > 0) {
        // Skapa en lista med resultat
        const ul = document.createElement('ul');
        data.forEach(result => {
          const li = document.createElement('li');
          li.textContent = result.display_name;
          li.style.cursor = "pointer";
          li.addEventListener('click', function() {
            // När ett resultat klickas på, rensa listan och processa resultatet
            resultsContainer.innerHTML = "";
            processSelectedResult(result);
          });
          ul.appendChild(li);
        });
        resultsContainer.appendChild(ul);
      } else {
        alert("Inga resultat hittades för: " + query);
      }
    })
    .catch(error => {
      console.error('Fel vid plats-sökning:', error);
      alert("Något gick fel vid sökningen.");
    });
});


// Funktion för att bearbeta det valda resultatet
function processSelectedResult(result) {
  const lat = parseFloat(result.lat);
  const lon = parseFloat(result.lon);
  
  // Flytta kartan till den sökta platsen
  map.setView([lat, lon], 10);
  
  // Använd reverse geocoding för att hämta kommun och län
  fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`)
    .then(response => response.json())
    .then(addressData => {
      const county = addressData.address.county || "Okänt län";
      const municipality = addressData.address.municipality || addressData.address.town || "Okänd kommun";
      
      // Försök att hitta om den sökta punkten ligger inom ett landskap från din GeoJSON-fil
      let foundLandskap = "Okänt landskap";
      if (geojsonLayer) {
        geojsonLayer.eachLayer(function(layer) {
          if (layer.feature && layer.feature.geometry) {
            // Observera: Turf.js använder koordinatordningen [lng, lat]
            const pt = turf.point([lon, lat]);
            if (turf.booleanPointInPolygon(pt, layer.feature)) {
              foundLandskap = layer.feature.properties.landskap;
            }
          }
        });
      }
      
      // Skapa popup-innehåll med all information
      const popupContent = `
        <p>
          Namn: ${result.display_name} <br>
          Koordinat: ${lat.toFixed(4)}, ${lon.toFixed(4)} <br>
          Kommun: ${municipality} <br>
          Län: ${county} <br>
          Landskap: ${foundLandskap}
        </p>
      `;
      
      // Lägg till en markör på den sökta platsen och visa popupen
      L.marker([lat, lon]).addTo(map)
        .bindPopup(popupContent)
        .openPopup();
    })
    .catch(error => console.error('Error during reverse geocoding:', error));
}

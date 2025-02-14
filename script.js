/****************************************************
 * SVERIGEKARTAN + EXCEL-BEARBETNING
 ****************************************************/

/**
 * -----------------------------------------
 * 1. GLOBALA VARIABLER OCH INLADDNING AV GEOJSON
 * -----------------------------------------
 */

// Variabler för att spara GeoJSON-data
let geojsonLan, geojsonKommun, geojsonLandskap;

/**
 * När sidan laddats: Hämta GeoJSON-lager (Län, Kommun, Landskap).
 * Dessa ska användas för både kartvisning och punkt-i-polygon-analyser.
 */
window.addEventListener('load', () => {
  Promise.all([
    fetch('data/lan.geojson').then(r => r.json()),
    fetch('data/kommun.geojson').then(r => r.json()),
    fetch('data/landskap-lappmark.geojson').then(r => r.json())
  ])
  .then(([lanData, kommunData, landskapData]) => {
    geojsonLan = lanData;
    geojsonKommun = kommunData;
    geojsonLandskap = landskapData;
    
    // Debug: Kontrollera att data laddats
    console.log("Län GeoJSON:", geojsonLan);
    console.log("Kommun GeoJSON:", geojsonKommun);
    console.log("Landskap GeoJSON:", geojsonLandskap);
    console.log("GeoJSON-lager inlästa och redo för användning!");
  })
  .catch(err => console.error("Fel vid inläsning av GeoJSON:", err));
});


/****************************************************
 * 2. EXCEL-BEARBETNING VIA SHEETJS
 ****************************************************/

/**
 * readAndProcessExcel(file):
 *  Läser en Excel-fil med FileReader + SheetJS,
 *  konverterar data till JSON och anropar processRows().
 */
function readAndProcessExcel(file) {
  const reader = new FileReader();

  reader.onload = function(e) {
    // Konvertera binärdata till en Uint8Array
    const data = new Uint8Array(e.target.result);
    // Läs Excel-filen som ett workbook-objekt
    const workbook = XLSX.read(data, { type: "array" });
    
    // Ta det första bladet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Konvertera bladet till en JSON-array
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    console.log("✅ Excel-data inläst:", jsonData);
    
    // Bearbeta raderna för geokoppling
    processRows(jsonData);
  };

  // Läser filen som en ArrayBuffer
  reader.readAsArrayBuffer(file);
}

/**
 * När man klickar på knappen "Bearbeta Excel":
 *  - Kollar att en fil är vald
 *  - Anropar readAndProcessExcel() med vald fil
 */
document.getElementById('processBtn').addEventListener('click', () => {
  const fileInput = document.getElementById('excelFile');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Välj en Excel-fil först!");
    return;
  }
  const file = fileInput.files[0];
  
  // Anropa funktionen readAndProcessExcel(file)
  readAndProcessExcel(file);
});


/**
 * processRows(rows):
 *  Går igenom varje rad, tolkar lat/lon, gör punkt-i-polygon mot geojson-lager.
 *  Lägger till nya kolumner (lan, kommun, landskap).
 *  Därefter skapar en ny Excel-fil via generateAndDownloadExcel().
 */
function processRows(rows) {
  console.log("🔍 Startar bearbetning av rader...");

  for (let row of rows) {
    const lat = parseFloat(row.lat);
    const lon = parseFloat(row.lon);

    if (isNaN(lat) || isNaN(lon)) {
      console.warn("⚠️ Ogiltiga koordinater i rad:", row);
      row.lan = "";
      row.kommun = "";
      row.landskap = "";
      continue;
    }

    // Punkt-i-polygon för varje GeoJSON-lager
    let foundLan = polygonLookup(lon, lat, geojsonLan, "lan");
    let foundKommun = polygonLookup(lon, lat, geojsonKommun, "kommun");
    let foundLandskap = polygonLookup(lon, lat, geojsonLandskap, "Landskap-lappmark");

    console.log(`🗺️ Koordinater: ${lat}, ${lon}`);
    console.log(`   ➡️ Län: ${foundLan}`);
    console.log(`   ➡️ Kommun: ${foundKommun}`);
    console.log(`   ➡️ Landskap: ${foundLandskap}`);

    // Spara resultaten i raden
    row.lan = foundLan || "";
    row.kommun = foundKommun || "";
    row.landskap = foundLandskap || "";
  }

  console.log("✅ Färdig med bearbetning. Raderna ser ut så här:", rows);

  // Skapa och ladda ner Excel
  generateAndDownloadExcel(rows);
}


/**
 * polygonLookup(lon, lat, geojson, propertyName):
 *  Loopar igenom features i en GeoJSON-fil och kollar om en punkt (lon, lat)
 *  ligger i en polygon. Returnerar propertyName, t.ex. lan, kommun, landskap.
 */
function polygonLookup(lon, lat, geojson, propertyName) {
  if (!geojson || !geojson.features) {
    console.log(`❌ Inget GeoJSON hittades för ${propertyName}`);
    return null;
  }

  const pt = turf.point([lon, lat]); // Turf.js använder [lon, lat]
  console.log(`🔍 Söker efter ${propertyName} för koordinater: ${lon}, ${lat}`);

  for (let feature of geojson.features) {
    if (!feature.geometry) continue;

    if (turf.booleanPointInPolygon(pt, feature)) {
      console.log(`✅ Träff i ${propertyName}:`, feature.properties[propertyName]);
      return feature.properties[propertyName];
    }
  }

  console.log(`❌ Ingen träff i ${propertyName} för koordinater: ${lon}, ${lat}`);
  return null;
}


/**
 * generateAndDownloadExcel(rows):
 *  Skapar en ny Excel-fil (xlsx) från raderna och erbjuder filen som nedladdning.
 */
function generateAndDownloadExcel(rows) {
  // 1) Skapa en ny workbook
  const wb = XLSX.utils.book_new();
  
  // 2) Gör ett worksheet från våra rader
  const ws = XLSX.utils.json_to_sheet(rows);
  
  // 3) Lägg in worksheet i workbook
  XLSX.utils.book_append_sheet(wb, ws, "Resultat");
  
  // 4) Konvertera workbook till binär data
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  
  // 5) Skapa en blob av datan
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  
  // 6) Skapa en temporär länk som triggar nedladdning
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "geo-resultat.xlsx"; // Valfritt filnamn
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log("Excel-fil med geodata skapad och nedladdad!");
}


/****************************************************
 * 3. LEAFLET-KARTA MED OLIKA LAGER
 ****************************************************/

/**
 * overlayMaps: Samlar Leaflet-lager (Kommun, Län, Landskap).
 * Visas i en lagerkontroll för att tända/släcka olika lager.
 */
let overlayMaps = {};

/**
 * Skapar Leaflet-kartan och centrerar på [63.0, 15.0].
 * Du kan justera startkoordinater och zoom efter behov.
 */
const map = L.map('map').setView([63.0, 15.0], 5);

/**
 * OSM-bakgrundskarta.
 */
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);


/**
 * addGeoJsonLayer(url, layerName):
 *  Hämtar GeoJSON och skapar ett Leaflet-lager med en viss stil.
 *  Lägger sedan till lagret i overlayMaps och på kartan.
 */
function addGeoJsonLayer(url, layerName) {
  fetch(url)
    .then(response => response.json())
    .then(geojsonData => {
      let styleObj = {};

      switch (layerName) {
        case "Kommun":
          styleObj = { color: "green", weight: 1, fillColor: "green", fillOpacity: 0 };
          break;
        case "Län":
          styleObj = { color: "blue", weight: 2, fillColor: "blue", fillOpacity: 0 };
          break;
        case "Landskap":
          styleObj = { color: "purple", weight: 1, fillColor: "purple", fillOpacity: 0 };
          break;
        default:
          styleObj = { color: "red", weight: 1, fillColor: "none", fillOpacity: 0.0 };
          break;
      }

      const layer = L.geoJSON(geojsonData, { style: styleObj });
      overlayMaps[layerName] = layer;
      map.addLayer(layer);

      // När alla 3 lager är inladdade, skapa lagerkontroll
      if (Object.keys(overlayMaps).length === 3) {
        L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);
      }
    })
    .catch(err => console.error(`Error loading ${layerName}:`, err));
}

// Lägg in de tre lagren (kommun, län, landskap-lappmark)
addGeoJsonLayer('data/kommun.geojson', "Kommun");
addGeoJsonLayer('data/lan.geojson', "Län");
addGeoJsonLayer('data/landskap-lappmark.geojson', "Landskap");


/****************************************************
 * 4. GLOBALA KLICKS PÅ KARTAN, SÖKFUNKTIONER
 ****************************************************/

/**
 * showAllInfo(lat, lng):
 * 1) Gör reverse geocoding (Nominatim)
 * 2) Kollar polygonträff i aktiva lager
 * 3) Visar popup i kartan
 */
async function showAllInfo(lat, lng) {
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(nominatimUrl);
    const data = await response.json();

    const displayName = data.display_name || "Okänd plats";
    const county = data.address?.county || "Okänt län";
    const municipality = data.address?.municipality || data.address?.town || "Okänd kommun";

    let infoList = [];
    // Gå igenom aktiva lager i overlayMaps
    Object.entries(overlayMaps).forEach(([layerName, layer]) => {
      if (!map.hasLayer(layer)) return;

      layer.eachLayer(featureLayer => {
        const f = featureLayer.feature;
        if (f && f.geometry) {
          const pt = turf.point([lng, lat]);
          if (turf.booleanPointInPolygon(pt, f)) {
            const props = f.properties;
            const foundKommun = props?.kommun || "";
            const foundLan = props?.lan || "";
            const foundLappmark = props?.["Landskap-lappmark"] || "";

            let text = "";
            if (foundKommun)   text += `<strong>Kommun:</strong> ${foundKommun}<br>`;
            if (foundLan)      text += `<strong>Län:</strong> ${foundLan}<br>`;
            if (foundLappmark) text += `<strong>Landskap:</strong> ${foundLappmark}<br>`;

            infoList.push(text);
          }
        }
      });
    });

    let polygonText = "";
    if (infoList.length === 0) {
      polygonText = `<em>Ingen polygonträff i aktiva lager</em>`;
    } else {
      polygonText = infoList.join("");
      polygonText += `<br><strong>Källa:</strong> Lantmäteriet (aktiva polygonlager)`;
    }

    const popupHtml = `
      <strong>Adress:</strong> ${displayName}<br>
      <strong>Koordinater (WGS84):</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}<br>
      <strong>Län:</strong> ${county}<br>
      <strong>Kommun:</strong> ${municipality}<br>
      <br><strong>Källa:</strong> Nominatim/OpenStreetMap (bakgrundskarta)
      <hr>
      ${polygonText}
    `;

    // Visa popup
    L.popup()
      .setLatLng([lat, lng])
      .setContent(popupHtml)
      .openOn(map);

  } catch (error) {
    console.error("showAllInfo() failed:", error);
  }
}

/**
 * Global klickhändelse i kartan: visar info via showAllInfo(lat, lng).
 */
map.on('click', function(e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  showAllInfo(lat, lng);
});

/**
 * Koordinatsökning: Användaren skriver lat, lon -> anropa showAllInfo().
 */
document.getElementById('searchButton').addEventListener('click', function() {
  const lat = parseFloat(document.getElementById('latitude').value);
  const lng = parseFloat(document.getElementById('longitude').value);

  if (isNaN(lat) || isNaN(lng)) {
    alert("Ogiltiga koordinater.");
    return;
  }

  map.setView([lat, lng], 10);
  showAllInfo(lat, lng);
});

/**
 * Platssökning (t.ex. "Stockholm"): anropar Nominatim, visar lista med förslag,
 * låter användaren klicka på en träff. Sedan anropas showAllInfo(lat, lon).
 */
document.getElementById('searchPlaceButton').addEventListener('click', function() {
  const query = document.getElementById('placeName').value.trim();
  if (query === "") {
    alert("Ange ett platsnamn att söka efter.");
    return;
  }

  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = "";

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      if (data && data.length > 0) {
        const ul = document.createElement('ul');
        data.forEach(result => {
          const li = document.createElement('li');
          li.textContent = result.display_name;
          li.style.cursor = "pointer";
          li.addEventListener('click', function() {
            resultsContainer.innerHTML = "";
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);

            map.setView([lat, lon], 10);
            showAllInfo(lat, lon);
          });
          ul.appendChild(li);
        });
        resultsContainer.appendChild(ul);
      } else {
        alert("Inga resultat hittades för: " + query);
      }
    })
    .catch(error => {
      console.error("Fel vid plats-sökning:", error);
      alert("Ett fel uppstod vid sökningen.");
    });
});

/****************************************************
 * geoLocus + EXCEL-BEARBETNING
 ****************************************************/

/**
 * 1. GLOBALA VARIABLER & GEOJSON-INLADDNING
 */
let geojsonLan, geojsonKommun, geojsonLandskap;

// När sidan laddas, läs in Län, Kommun & Landskap (GeoJSON)
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
    
    console.log("Län GeoJSON:", geojsonLan);
    console.log("Kommun GeoJSON:", geojsonKommun);
    console.log("Landskap GeoJSON:", geojsonLandskap);
    console.log("GeoJSON-lager inlästa och redo för användning!");
  })
  .catch(err => console.error("Fel vid inläsning av GeoJSON:", err));
});

/****************************************************
 * 2. EXCEL-BEARBETNING (SheetJS)
 ****************************************************/
function readAndProcessExcel(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    console.log("✅ Excel-data inläst:", jsonData);

    processRows(jsonData);
  };
  reader.readAsArrayBuffer(file);
}

document.getElementById('processBtn').addEventListener('click', () => {
  const fileInput = document.getElementById('excelFile');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Välj en Excel-fil först!");
    return;
  }
  readAndProcessExcel(fileInput.files[0]);
});

// Visar valt filnamn
document.getElementById('excelFile').addEventListener('change', function(e) {
  const fileNameDisplay = document.getElementById('selectedFileName');
  fileNameDisplay.textContent = (e.target.files.length > 0)
    ? `Vald fil: ${e.target.files[0].name}`
    : '';
});


/****************************************************
 * 3. BEARBETNING AV EXCEL-RADER
 ****************************************************/
function processRows(rows) {
  console.log("🔍 Startar bearbetning av rader...");

  for (let row of rows) {
    const lat = parseFloat(row.lat);
    const lon = parseFloat(row.lon);

    let manuellKontroll = "";

    // Kolla om koordinaterna är inom Sveriges ungefärliga gränser
    if (isNaN(lat) || isNaN(lon) || lat < 55 || lat > 70 || lon < 10 || lon > 25) {
      console.warn("⚠️ Ogiltiga koordinater i rad:", row);
      row.lan = "";
      row.kommun = "";
      row.landskap = "";
      manuellKontroll = "Kontrollera koordinater (punkt utanför Sverige)";
    } else {
      // Punkt-i-polygon
      const foundLan = polygonLookup(lon, lat, geojsonLan, "lan");
      const foundKommun = polygonLookup(lon, lat, geojsonKommun, "kommun");
      const foundLandskap = polygonLookup(lon, lat, geojsonLandskap, "Landskap-lappmark");

      row.lan = foundLan || "";
      row.kommun = foundKommun || "";
      row.landskap = foundLandskap || "";

      if (!foundLan || !foundKommun || !foundLandskap) {
        manuellKontroll = "Ingen träff i polygondata";
      }
    }

    row.manuell_kontroll = manuellKontroll;
  }

  console.log("✅ Färdig med bearbetning. Rader:", rows);
  generateAndDownloadExcel(rows);
}


/****************************************************
 * 4. SÖK I POLYGONER (Turf.js)
 ****************************************************/
function polygonLookup(lon, lat, geojson, propertyName) {
  if (!geojson || !geojson.features) {
    console.log(`❌ Inget GeoJSON hittades för ${propertyName}`);
    return null;
  }

  const pt = turf.point([lon, lat]);
  for (let feature of geojson.features) {
    if (!feature.geometry) continue;
    if (turf.booleanPointInPolygon(pt, feature)) {
      return feature.properties[propertyName];
    }
  }
  return null;
}


/****************************************************
 * 5. GENERERA & LADDA NER EXCEL
 ****************************************************/
function generateAndDownloadExcel(rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  const headers = Object.keys(rows[0] || {});
  const wsHeaders = XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.sheet_add_json(wsHeaders, rows, { origin: "A2", skipHeader: true });

  XLSX.utils.book_append_sheet(wb, wsHeaders, "Resultat");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "geo-resultat.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log("✅ Excel-fil med geodata skapad och nedladdad!");
}


/****************************************************
 * 6. LEAFLET-KARTA MED OLIKA LAGER
 ****************************************************/
let overlayMaps = {};

const map = L.map('map', {
  center: [59.3690, 18.0540],
  zoom: 16
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  tileSize: 256,
  detectRetina: true,
  noWrap: true
}).addTo(map);

setTimeout(() => {
  map.invalidateSize();
}, 500);

function addGeoJsonLayer(url, layerName) {
  fetch(url)
    .then(response => response.json())
    .then(geojsonData => {
      let styleObj;
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
          styleObj = { color: "red", weight: 1, fillColor: "none", fillOpacity: 0 };
      }

      const layer = L.geoJSON(geojsonData, { style: styleObj });
      overlayMaps[layerName] = layer;
      map.addLayer(layer);

      if (Object.keys(overlayMaps).length === 3) {
        L.control.layers(null, overlayMaps, { collapsed: false, position: 'bottomright' }).addTo(map);
      }
    })
    .catch(err => console.error(`Error loading ${layerName}:`, err));
}

addGeoJsonLayer('data/kommun.geojson', "Kommun");
addGeoJsonLayer('data/lan.geojson', "Län");
addGeoJsonLayer('data/landskap-lappmark.geojson', "Landskap");


/****************************************************
 * 7. KLICKHÄNDELSER & POPUP (Nominatim + polygoner)
 ****************************************************/
async function showAllInfo(lat, lng) {
  try {
    // Reverse geocoding
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(nominatimUrl);
    const data = await response.json();

    // Hantera fullständig adress och vänd ordningen
    let fullAddress = data.display_name || "Okänd plats";
    let addressParts = fullAddress.split(", ");
    addressParts.reverse(); // Vänd ordningen så att större områden kommer först
    const formattedAddress = addressParts.join(", ");

    // Polygonträffar
    let infoList = [];
    Object.entries(overlayMaps).forEach(([layerName, layer]) => {
      if (!map.hasLayer(layer)) return;
      layer.eachLayer(featureLayer => {
        const f = featureLayer.feature;
        if (f?.geometry) {
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

    let polygonText = (infoList.length === 0)
      ? "<em>Ingen polygonträff i aktiva lager</em>"
      : infoList.join("") + "<br><strong>Källa:</strong> Lantmäteriet (aktiva polygonlager)";

    const popupHtml = `
      <strong>Koordinater (WGS84):</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}<br>
      <strong>Adress:</strong> ${formattedAddress}
      <br>
      <br><strong>Källa:</strong> Nominatim/OpenStreetMap
      <hr>
      ${polygonText}
    `;

    L.popup()
      .setLatLng([lat, lng])
      .setContent(popupHtml)
      .openOn(map);

  } catch (error) {
    console.error("showAllInfo() failed:", error);
  }
}

/****************************************************
 * 8. KARTKLICK OCH SÖKFUNKTIONER
 ****************************************************/
// Klick i kartan -> popup med info
map.on('click', function(e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  showAllInfo(lat, lng);
});

// Koordinatsök
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

// Platssök (Sverige, limit=10, prioriterar by/stad)
document.getElementById('searchPlaceButton').addEventListener('click', function() {
  searchPlace();
});

// ENTER i platsfältet
document.getElementById('placeName').addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    searchPlace();
  }
});

// Klick på Sök-knappen
document.getElementById('searchPlaceButton').addEventListener('click', function() {
  searchPlace();
});

// Nya searchPlace som visar upp till 10 träffar i en lista
function searchPlace() {
  const query = document.getElementById('placeName').value.trim();
  const resultsContainer = document.getElementById('results');

  resultsContainer.innerHTML = "";

  if (query === "") {
    alert("Ange ett platsnamn att söka efter.");
    return;
  }

  // Hämtar upp till 10 resultat
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=SE&limit=10&addressdetails=1`)
    .then(response => response.json())
    .then(data => {
      if (!data || data.length === 0) {
        resultsContainer.innerHTML = "<div class='no-results'>Inga resultat hittades.</div>";
        return;
      }

      // Skapa en lista av träffar
      const ul = document.createElement('ul');
      ul.classList.add("search-results-list");

      data.forEach(result => {
        const li = document.createElement('li');
        // Exempel: ta bort \", Sverige\" i slutet
        const displayName = result.display_name.replace(/, Sverige$/, "");
        li.textContent = displayName;
        li.addEventListener('click', () => {
          document.getElementById('placeName').value = displayName;
          resultsContainer.innerHTML = "";

          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);
          map.setView([lat, lon], 10);
          showAllInfo(lat, lon);
        });
        ul.appendChild(li);
      });

      resultsContainer.appendChild(ul);

      // **Beräkna var #results ska ligga i förhållande till #placeName**
      const placeNameInput = document.getElementById('placeName');
      const rect = placeNameInput.getBoundingClientRect();

      // Låt #results matcha input-bredden
      resultsContainer.style.width = rect.width + "px";

      // Placera listan precis under input (samma left)
      // Eftersom #place-search har position: relative
      const topPos = placeNameInput.offsetTop + placeNameInput.offsetHeight; 
      const leftPos = placeNameInput.offsetLeft; 
      
      resultsContainer.style.top = topPos + "px";
      resultsContainer.style.left = leftPos + "px";
    })
    .catch(error => {
      console.error("Fel vid plats-sökning:", error);
      alert("Ett fel uppstod vid sökningen.");
    });
}

// Dölj sökresultaten om användaren klickar utanför listan
document.addEventListener('click', function(event) {
  const resultsContainer = document.getElementById('results');
  const placeInput = document.getElementById('placeName');

  // Om klicket INTE är inom plats-input eller resultatlistan -> rensa listan
  if (!resultsContainer.contains(event.target) && !placeInput.contains(event.target)) {
    resultsContainer.innerHTML = "";
  }
});

// 🛠️ Definiera projektionerna korrekt för RT90, SWEREF99 TM och WGS84
proj4.defs([
  ["EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs"], // WGS84
  ["EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +datum=WGS84 +units=m +no_defs"], // SWEREF 99 TM
  ["EPSG:3847", "+proj=tmerc +lat_0=0 +lon_0=15.806284529 +k=1.00000561024 +x_0=1500064.274 +y_0=-667.711 +ellps=bessel +datum=WGS84 +units=m +towgs84=-414.1,41.3,603.1,0.855,2.141,7.023,0"] // RT90 2.5 gon V
]);

document.getElementById("convertButton").addEventListener("click", function() {
  let rt90Input = document.getElementById("rt90Input").value.trim();
  let swerefInput = document.getElementById("swerefInput").value.trim();
  let wgs84Input = document.getElementById("wgs84Input").value.trim();

  let rt90, sweref, wgs84;

  if (rt90Input) {
      let [y, x] = rt90Input.split(",").map(Number); // (N, E) → (Y, X) format
      wgs84 = proj4("EPSG:3847", "EPSG:4326", [x, y]);  // RT90 → WGS84 direkt
      sweref = proj4("EPSG:4326", "EPSG:3006", wgs84);   // WGS84 → SWEREF99
  } 
  else if (swerefInput) {
      let [y, x] = swerefInput.split(",").map(Number); // (N, E) → (Y, X) format
      wgs84 = proj4("EPSG:3006", "EPSG:4326", [x, y]);  // SWEREF99 → WGS84
      rt90 = proj4("EPSG:4326", "EPSG:3847", wgs84);    // WGS84 → RT90
  } 
  else if (wgs84Input) {
      let [lat, lon] = wgs84Input.split(",").map(Number);
      rt90 = proj4("EPSG:4326", "EPSG:3847", [lon, lat]); // WGS84 → RT90
      sweref = proj4("EPSG:4326", "EPSG:3006", [lon, lat]); // WGS84 → SWEREF99
  } else {
      alert("Ange minst en koordinat för att konvertera.");
      return;
  }

  // ✅ Fixat ordningen på WGS84 (Nu: Lat, Lon)
  document.getElementById("wgs84Result").textContent = wgs84 ? `${wgs84[1].toFixed(5)}, ${wgs84[0].toFixed(5)}` : "-";

  // ✅ Fixat RT90 & SWEREF ordning och rundat av till heltal
  document.getElementById("rt90Result").textContent = rt90 ? `${Math.round(rt90[1])}, ${Math.round(rt90[0])}` : "-";
  document.getElementById("swerefResult").textContent = sweref ? `${Math.round(sweref[1])}, ${Math.round(sweref[0])}` : "-";
});


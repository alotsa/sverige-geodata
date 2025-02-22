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

/**
 * 1) Skapa kartan
 */
const map = L.map('map', {
  center: [59.3690, 18.0540],
  zoom: 16,
  // Endast hela zoomsteg
  zoomSnap: 1,
  zoomDelta: 1,
  // Undvik att gå över OSM:s maxzoom
  minZoom: 0,
  maxZoom: 19
});

/**
 * 2) OpenStreetMap som förvalt baslager
 */
var osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  tileSize: 256,
  // Rekommenderas false om man inte får riktiga retina-tiles:
  detectRetina: false,
  // Avaktivera "wrapping" om du vill begränsa kartan inom [-180, 180]
  noWrap: true,
  // Samma maxZoom här för att inte skala upp
  maxZoom: 19
}).addTo(map); // Läggs till direkt → syns från start

/**
 * 3) Definiera Lantmäteriets WMS-lager som overlays
 *    (du kan justera maxZoom 17 vs. 19 beroende på vad Lantmäteriet levererar)
 */
var topowebb = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/topowebb/?', {
    layers: ['topowebbkartan'],
    format: 'image/png',
    transparent: false,
    maxZoom: 19,
    maxNativeZoom: 19
  }),
  topowebb_nedtonad = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/topowebb/?', {
    layers: ['topowebbkartan_nedtonad'],
    format: 'image/png',
    transparent: false,
    maxZoom: 17,
    maxNativeZoom: 17
  }),
  topowebb_grupperad = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/topowebb/?', {
    layers: ['topowebbkartan'],
    format: 'image/png',
    transparent: true,
    opacity: 0.75,
    maxZoom: 17,
    maxNativeZoom: 17
  }),
  ortofoto = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/ortofoto/?', {
    layers: ['Ortofoto_0.5', 'Ortofoto_0.4', 'Ortofoto_0.25', 'Ortofoto_0.16'],
    format: 'image/png',
    transparent: false,
    maxZoom: 17
  }),
  fastigheter_rod = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/fastighetsindelning/?', {
    layers: ['granser', 'text'],
    styles: ['ljusbakgrund', 'ljusbakgrund'],
    maxZoom: 17,
    transparent: true,
    format: 'image/png'
  }),
  hojdmodell = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/hojdmodell/?', {
    layers: ['terrangskuggning'],
    maxZoom: 17,
    transparent: true,
    format: 'image/png'
  }),
  hojdmodell_grupperad = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/hojdmodell/?', {
    layers: ['terrangskuggning'],
    maxZoom: 17,
    transparent: true,
    format: 'image/png'
  });

/**
 * 4) baseMaps & overlayMaps
 *    - baseMaps: just "OpenStreetMap" (OSM)
 *    - overlayMaps: alla Lantmäteriets lager
 */
let baseMaps = {
  "OpenStreetMap": osmBase
};

let overlayMaps = {
  "Topowebb": topowebb,
  "Topowebb + Terräng": L.layerGroup([hojdmodell_grupperad, topowebb_grupperad]),
  "Ortofoto": ortofoto,
  "Fastigheter": fastigheter_rod
};

/**
 * 5) Lagerkontroll
 */
let layerControl = L.control.layers(baseMaps, overlayMaps, {
  position: 'bottomright', // Flytta till nedre högra hörnet
  collapsed: true          // Menyn är hopfälld (”+” ikon)
}).addTo(map);


/**
 * 6) Skala + eventuellt invalidateSize()
 */
L.control.scale().addTo(map);

setTimeout(() => {
  map.invalidateSize();
}, 500);

/**
 * 7) Funktion för GeoJSON-lager
 */
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

      // Lägg till i overlayMaps
      overlayMaps[layerName] = layer;
      map.addLayer(layer);

      // Uppdatera lagerkontrollen
      layerControl.remove();
      layerControl = L.control.layers(baseMaps, overlayMaps, {
        position: 'bottomright', // Flytta till nedre högra hörnet
        collapsed: true          // Menyn är hopfälld (”+” ikon)
      }).addTo(map);      
    })
    .catch(err => console.error(`Error loading ${layerName}:`, err));
}

// Anropa GeoJSON-lagerinladdning om du vill
addGeoJsonLayer('data/kommun.geojson', "Kommun");
addGeoJsonLayer('data/lan.geojson', "Län");
addGeoJsonLayer('data/landskap-lappmark.geojson', "Landskap");


/****************************************************
 * 7. KLICKHÄNDELSER & POPUP (Nominatim + polygoner)
 ****************************************************/
async function showAllInfo(lat, lng) {
  try {
    // Reverse geocoding (Nominatim)
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(nominatimUrl);
    const data = await response.json();

    // Hantera fullständig adress och vänd ordningen
    let fullAddress = data.display_name || "Okänd plats";
    let addressParts = fullAddress.split(", ");
    addressParts.reverse(); // större områden först
    const formattedAddress = addressParts.join(", ");

    // Polygonträffar i aktiva lager
    let infoList = [];
    Object.entries(overlayMaps).forEach(([layerName, layer]) => {
      // Kolla om just detta lager är påslaget
      if (!map.hasLayer(layer)) return;

      // Gå igenom alla features i just detta GeoJSON-lager (om det är geoJSON-lager)
      if (layer.eachLayer) {
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
      }
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
// Klick i kartan -> popup
map.on('click', function(e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  showAllInfo(lat, lng);
});

// Kombinerad sökfunktion (platssök & koordinatsök)
document.getElementById('searchButton').addEventListener('click', performSearch);
document.getElementById('searchField').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    performSearch();
  }
});

function performSearch() {
  const query = document.getElementById('searchField').value.trim();
  if (query === "") {
    alert("Ange ett sökord eller koordinater.");
    return;
  }
  
  // Försök dela upp inmatningen med komma eller mellanslag
  const parts = query.split(/[,\s]+/);
  
  // Om det finns minst två delar och båda kan tolkas som nummer: anta koordinater
  if (parts.length >= 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    map.setView([lat, lng], 10);
    showAllInfo(lat, lng);
    // Töm resultatslistan
    document.getElementById('results').innerHTML = "";
  } else {
    // Annars, kör plats-sökning
    searchPlace(query);
  }
}

function searchPlace(queryParam) {
  const query = queryParam || document.getElementById('searchField').value.trim();
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = "";

  if (query === "") {
    alert("Ange ett platsnamn att söka efter.");
    return;
  }

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=SE&limit=10&addressdetails=1`)
    .then(response => response.json())
    .then(data => {
      if (!data || data.length === 0) {
        resultsContainer.innerHTML = "<div class='no-results'>Inga resultat hittades.</div>";
        return;
      }

      // Skapa en lista med träffar
      const ul = document.createElement('ul');
      ul.classList.add("search-results-list");

      data.forEach(result => {
        const li = document.createElement('li');
        const displayName = result.display_name.replace(/, Sverige$/, "");
        li.textContent = displayName;
        li.addEventListener('click', () => {
          document.getElementById('searchField').value = displayName;
          resultsContainer.innerHTML = "";
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          map.setView([lat, lng], 10);
          showAllInfo(lat, lng);
        });
        ul.appendChild(li);
      });

      resultsContainer.appendChild(ul);

      // Justera position för resultatslistan
      const searchInput = document.getElementById('searchField');
      const rect = searchInput.getBoundingClientRect();
      resultsContainer.style.width = rect.width + "px";
      const topPos = searchInput.offsetTop + searchInput.offsetHeight;
      const leftPos = searchInput.offsetLeft;
      resultsContainer.style.top = topPos + "px";
      resultsContainer.style.left = leftPos + "px";
    })
    .catch(error => {
      console.error("Fel vid plats-sökning:", error);
      alert("Ett fel uppstod vid sökningen.");
    });
}

// Dölj resultatslistan om användaren klickar utanför sökfältet
document.addEventListener('click', function(event) {
  const resultsContainer = document.getElementById('results');
  const searchInput = document.getElementById('searchField');
  if (!resultsContainer.contains(event.target) && !searchInput.contains(event.target)) {
    resultsContainer.innerHTML = "";
  }
});


// 🛠️ Definiera projektionerna för RT90, SWEREF99 TM och WGS84
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
    let [y, x] = rt90Input.split(",").map(Number);
    wgs84 = proj4("EPSG:3847", "EPSG:4326", [x, y]);  // RT90 → WGS84
    sweref = proj4("EPSG:4326", "EPSG:3006", wgs84);  // WGS84 → SWEREF99
  } 
  else if (swerefInput) {
    let [y, x] = swerefInput.split(",").map(Number);
    wgs84 = proj4("EPSG:3006", "EPSG:4326", [x, y]);  // SWEREF99 → WGS84
    rt90 = proj4("EPSG:4326", "EPSG:3847", wgs84);    // WGS84 → RT90
  } 
  else if (wgs84Input) {
    let [lat, lon] = wgs84Input.split(",").map(Number);
    rt90 = proj4("EPSG:4326", "EPSG:3847", [lon, lat]);   // WGS84 → RT90
    sweref = proj4("EPSG:4326", "EPSG:3006", [lon, lat]); // WGS84 → SWEREF99
    wgs84 = [lon, lat]; // Bara för att visa i result
  } else {
    alert("Ange minst en koordinat för att konvertera.");
    return;
  }

  document.getElementById("wgs84Result").textContent = wgs84
    ? `${wgs84[1].toFixed(5)}, ${wgs84[0].toFixed(5)}`
    : "-";

  document.getElementById("rt90Result").textContent = rt90
    ? `${Math.round(rt90[1])}, ${Math.round(rt90[0])}`
    : "-";

  document.getElementById("swerefResult").textContent = sweref
    ? `${Math.round(sweref[1])}, ${Math.round(sweref[0])}`
    : "-";
});

// Tabbar
document.addEventListener("DOMContentLoaded", function () {
  openTab('main'); // Visa huvudfliken från start
});

function openTab(tabId) {
  // Dölj alla tabbar
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.style.display = "none";
  });

  // Visa den valda tabben
  let activeTab = document.getElementById(tabId);
  activeTab.style.display = "block";

  // Om kartan finns i en flik, uppdatera den
  if (tabId === "main" && typeof map !== "undefined") {
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }
}

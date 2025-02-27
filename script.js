/****************************************************
 ********************* geoLOCUS  ********************
 ****************************************************/

/****************************************************
 * GLOBALA VARIABLER OCH GEOJSON-INLADDNING
 ****************************************************/
let geojsonLan, geojsonKommun, geojsonLandskap, geojsonSockenstad;

// När sidan laddas, läs in Län, Kommun, Landskap & Sockenstad (GeoJSON)
window.addEventListener('load', () => {
  Promise.all([
    fetch('data/lan.geojson').then(r => r.json()),
    fetch('data/kommun.geojson').then(r => r.json()),
    fetch('data/landskap-lappmark.geojson').then(r => r.json()),
    fetch('data/sockenstad_wgs84.geojson').then(r => r.json())
  ])
  .then(([lanData, kommunData, landskapData, sockenstadData]) => {
    geojsonLan = lanData;
    geojsonKommun = kommunData;
    geojsonLandskap = landskapData;
    geojsonSockenstad = sockenstadData;
    
    console.log("Län GeoJSON:", geojsonLan);
    console.log("Kommun GeoJSON:", geojsonKommun);
    console.log("Landskap GeoJSON:", geojsonLandskap);
    console.log("Sockenstad GeoJSON:", geojsonSockenstad);
    console.log("GeoJSON-lager inlästa och redo för användning!");
  })
  .catch(err => console.error("Fel vid inläsning av GeoJSON:", err));
});


/****************************************************
 * TABBSYSTEM FÖR GRÄNSSNITT
 ****************************************************/

/**
 * När sidan laddas, visa huvudfliken.
 */
document.addEventListener("DOMContentLoaded", function () {
  openTab('main'); // Huvudflik aktiveras
});

/**
 * Hanterar flikväxling i gränssnittet.
 * @param {string} tabId - ID för den flik som ska visas.
 */
function openTab(tabId) {
  // Dölj alla flikar
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.style.display = "none";
  });

  // Visa den valda fliken
  let activeTab = document.getElementById(tabId);
  activeTab.style.display = "block";

  // Om kartan finns i en flik, uppdatera storleken vid växling
  if (tabId === "main" && typeof map !== "undefined") {
    setTimeout(() => {
      map.invalidateSize();
    }, 300);
  }
}

/****************************************************
 * LEAFLET-KARTA MED LAGER
 ****************************************************/

/**
 * Skapa huvudkartan med standardinställningar
 */
const map = L.map('map', {
  center: [59.3690, 18.0540], // Startposition
  zoom: 16,                   // Startzoom
  zoomSnap: 1,                // Endast hela zoomsteg
  zoomDelta: 1,               // Endast hela zoomförändringar
  minZoom: 0,                 // Tillåt inzoomning på världsnivå
  maxZoom: 19                 // Maximal inzoomning (beroende på kartdata)
});

/**
 * Lägg till OpenStreetMap som förvalt baslager
 */
var osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  tileSize: 256,
  detectRetina: false,  // Avaktivera Retina om ej stöd för högupplösta tiles
  noWrap: true,         // Hindrar kartan från att "loopa" horisontellt
  maxZoom: 19
}).addTo(map); // Lägger till direkt → syns från start

/**
 * Definiera Lantmäteriets WMS-lager (kan tändas/släckas)
 */
var topowebb = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/topowebb/?', {
    layers: ['topowebbkartan'],
    format: 'image/png',
    transparent: false,
    maxZoom: 19
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
  });

/**
 * Definiera grundkartor och overlay-lager
 */
let baseMaps = {
  "OpenStreetMap": osmBase
};

let overlayMaps = {
  "Topowebb": topowebb,
  "Ortofoto": ortofoto,
  "Fastigheter": fastigheter_rod
};

/**
 * Lägg till lagerkontroll (låter användaren tända/släcka lager)
 */
let layerControl = L.control.layers(baseMaps, overlayMaps, {
  position: 'bottomright', // Placera lagervalet längst ner till höger
  collapsed: true          // Menyn är hopfälld från start
}).addTo(map);

/**
 * Lägg till en skala och säkerställ att kartan renderas korrekt
 */
L.control.scale().addTo(map);

// Säkerställer att kartan ritas om korrekt vid laddning
setTimeout(() => {
  map.invalidateSize();
}, 500);

/**
 * Funktion för att ladda in och lägga till GeoJSON-lager på kartan
 * @param {string} url - URL till GeoJSON-filen
 * @param {string} layerName - Namn på lagret (för overlayMaps)
 * @param {boolean} [visible=true] - Om lagret ska synas direkt (default: true)
 */
function addGeoJsonLayer(url, layerName, visible = true) {
  fetch(url)
    .then(response => response.json())
    .then(geojsonData => {
      // Definiera standardstil baserat på lager
      let styleObj = { color: "red", weight: 1, fillColor: "none", fillOpacity: 0 };
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
        case "Socknar":
          styleObj = { color: "black", weight: 2, fillColor: "none", fillOpacity: 0 };
          break;
      }

      const layer = L.geoJSON(geojsonData, { style: styleObj });

      // Lägg till i overlayMaps
      overlayMaps[layerName] = layer;
      layerControl.addOverlay(layer, layerName);

      // Lägg till på kartan endast om "visible" är true
      if (visible) {
        layer.addTo(map);
      }
    })
    .catch(err => console.error(`❌ Fel vid inläsning av ${layerName}:`, err));
}

/**
 * Lägg till koordinatvisning i kartan (längst ner till vänster)
 */
const coordinateDisplay = L.control({ position: "bottomleft" });

coordinateDisplay.onAdd = function(map) {
  const div = L.DomUtil.create("div", "coordinate-display");
  div.innerHTML = "Lat: --, Lon: --"; // Standardvärde innan musen rör sig
  return div;
};

// Lägg till koordinatdisplay i kartan
coordinateDisplay.addTo(map);

// Uppdatera koordinater dynamiskt när musen rör sig över kartan
map.on("mousemove", function(e) {
  document.querySelector(".coordinate-display").innerHTML = 
    `Lat: ${e.latlng.lat.toFixed(5)}, Lon: ${e.latlng.lng.toFixed(5)}`;
});

/**
 * Ladda in GeoJSON-lager vid start (socknar är släckta från start)
 */
addGeoJsonLayer('data/kommun.geojson', "Kommun");
addGeoJsonLayer('data/lan.geojson', "Län");
addGeoJsonLayer('data/landskap-lappmark.geojson', "Landskap");
addGeoJsonLayer('data/sockenstad_wgs84.geojson', "Socknar", false); // Släckt från start

/****************************************************
 * KLICKHÄNDELSER & POPUP (Nominatim + polygoner)
 ****************************************************/

/**
 * Hämtar information om en plats via omvänd geokodning och visar en popup.
 * 
 * @param {number} lat - Latitud (WGS84).
 * @param {number} lng - Longitud (WGS84).
 */
async function showAllInfo(lat, lng) {
  try {
    /**
     * Hämta adressinformation via Nominatim (OpenStreetMap)
     */
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(nominatimUrl);
    
    if (!response.ok) throw new Error("Fel vid hämtning från Nominatim API");

    const data = await response.json();
    const fullAddress = data.display_name || "Okänd plats";

    // Omvandla adressen så att större områden visas först
    const formattedAddress = fullAddress.split(", ").reverse().join(", ");

    /**
     * Sök efter polygonträffar i aktiva lager
     */
    let infoList = [];

    Object.entries(overlayMaps).forEach(([layerName, layer]) => {
      // Kontrollera om lagret är synligt
      if (!map.hasLayer(layer)) return;

      // Kontrollera varje polygon i lagret om den innehåller punkten
      if (layer.eachLayer) {
        layer.eachLayer(featureLayer => {
          const feature = featureLayer.feature;
          if (!feature?.geometry) return;

          const point = turf.point([lng, lat]);
          if (turf.booleanPointInPolygon(point, feature)) {
            const props = feature.properties;
            const foundKommun = props?.kommun || "";
            const foundLan = props?.lan || "";
            const foundLappmark = props?.["Landskap-lappmark"] || "";
            const foundSocken = props?.sockenstadnamn || ""; 

            let text = "";
            if (foundKommun) text += `<strong>Kommun:</strong> ${foundKommun}<br>`;
            if (foundLan) text += `<strong>Län:</strong> ${foundLan}<br>`;
            if (foundLappmark) text += `<strong>Landskap:</strong> ${foundLappmark}<br>`;
            if (foundSocken) text += `<strong>Socken:</strong> ${foundSocken}<br>`; // Visar socken om den finns
            infoList.push(text);
          }
        });
      }
    });

    /**
     * Bygg HTML-innehåll för popup
     */
    let polygonText = infoList.length === 0
      ? "<em>Ingen polygonträff i aktiva lager</em>"
      : infoList.join("") + "<br><strong>Källa:</strong> Lantmäteriet (aktiva polygonlager)";

    const popupHtml = `
      <strong>Koordinater (WGS84):</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}<br>
      <strong>Adress:</strong> ${formattedAddress}
      <br><br><strong>Källa:</strong> Nominatim/OpenStreetMap
      <hr>
      ${polygonText}
    `;

    /**
     * Visa popup på kartan vid klickad punkt
     */
    L.popup()
      .setLatLng([lat, lng])
      .setContent(popupHtml)
      .openOn(map);

  } catch (error) {
    console.error("Fel vid showAllInfo():", error);
  }
}

// Close the popup when clicking outside the map
document.addEventListener("click", function(event) {
  const mapContainer = document.getElementById("map"); // Adjust if your map has a different ID
  if (!mapContainer.contains(event.target)) {
    map.closePopup();
  }
});


/****************************************************
 * KARTKLICK OCH SÖKFUNKTIONER
 ****************************************************/

/**
 * När användaren klickar i kartan, hämta och visa information om platsen.
 */
map.on('click', function (e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  showAllInfo(lat, lng);
});

/**
 * Debounce-funktion för att minska antalet API-anrop vid textinmatning.
 * 
 * @param {Function} func - Funktionen som ska anropas.
 * @param {number} delay - Fördröjning i millisekunder.
 * @returns {Function} - En fördröjd version av den givna funktionen.
 */
function debounce(func, delay) {
  let debounceTimer;
  return function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(this, arguments), delay);
  };
}

// Variabel för att hålla reda på nuvarande marker-grupp
let currentMarkersGroup;

/**
 * Eventlyssnare för sökfält och sökknapp
 */
document.getElementById('searchField').addEventListener('input', debounce(handleAutocomplete, 300));
document.getElementById('searchButton').addEventListener('click', performSearch);
document.getElementById('searchField').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    performSearch();
  }
});

/**
 * Autokomplettering vid sökning i sökfältet.
 */
function handleAutocomplete() {
  const query = document.getElementById('searchField').value.trim();
  const resultsContainer = document.getElementById('results');
  const worldwideSearch = document.getElementById('worldwideToggle').checked;

  if (query.length < 3) {
    resultsContainer.innerHTML = "";
    return;
  }

  // API-anrop för platsnamn (Sverige som standard, men global sökning om aktiverad)
  const apiURL = worldwideSearch
    ? `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=50`
    : `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=SE&limit=50`;

  fetch(apiURL)
    .then(response => response.json())
    .then(data => {
      resultsContainer.innerHTML = "";
      if (data.length === 0) return;

      const ul = document.createElement('ul');
      ul.classList.add("search-results-list");

      data.forEach(result => {
        const li = document.createElement('li');
        const displayName = worldwideSearch ? result.display_name : result.display_name.replace(/, Sverige$/, "");
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

      // Anpassa positionen av resultatlistan
      const searchInput = document.getElementById('searchField');
      const rect = searchInput.getBoundingClientRect();
      resultsContainer.style.position = 'absolute';
      resultsContainer.style.width = rect.width + "px";
      resultsContainer.style.top = (rect.bottom + window.scrollY) + "px";
      resultsContainer.style.left = (rect.left + window.scrollX) + "px";
      resultsContainer.style.zIndex = "5000";
    })
    .catch(console.error);
}

/**
 * Kontrollerar om ett koordinatpar är troligtvis i WGS84-format.
 */
function isLikelyWGS84(coords) {
  return coords[0] > 50 && coords[0] < 70 && coords[1] > 5 && coords[1] < 30;
}

/**
 * Kontrollerar om ett koordinatpar är i RT90-format.
 */
function isLikelyRT90(coords) {
  return coords[0] > 6000000 && coords[0] < 7000000 && coords[1] > 1200000 && coords[1] < 1900000;
}

/**
 * Kontrollerar om ett koordinatpar är i SWEREF99-format.
 */
function isLikelySWEREF99(coords) {
  return coords[0] > 6100000 && coords[0] < 7750000 && coords[1] > 250000 && coords[1] < 950000;
}

/**
 * Utför en sökning baserat på input från sökfältet.
 */
function performSearch() {
  const query = document.getElementById('searchField').value.trim().toLowerCase();
  const worldwideSearch = document.getElementById('worldwideToggle').checked;

  if (query === "") {
    alert("Ange ett sökord eller koordinater.");
    return;
  }

  // Om sökningen innehåller ordet "socken" → sök i sockenpolygoner istället
  if (query.includes("socken")) {
    highlightSocken(query);
    return;
  }

  // Rensa tidigare markörer
  if (currentMarkersGroup) {
    map.removeLayer(currentMarkersGroup);
    currentMarkersGroup = null;
  }

  // Kolla om input är koordinater
  const parts = query.split(/[ ,]+/).map(num => parseFloat(num));

  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    let lat, lng;

    if (isLikelyWGS84(parts)) {
      lat = parts[0];
      lng = parts[1];
    } else if (isLikelyRT90(parts)) {
      [lng, lat] = proj4("EPSG:3847", "EPSG:4326", [parts[1], parts[0]]);
    } else if (isLikelySWEREF99(parts)) {
      [lng, lat] = proj4("EPSG:3006", "EPSG:4326", [parts[1], parts[0]]);
    } else {
      alert("Okänt koordinatformat. Ange WGS84, RT90 eller SWEREF 99 TM.");
      return;
    }

    map.setView([lat, lng], 10);
    showAllInfo(lat, lng);
    document.getElementById('results').innerHTML = "";
  } else {
    
    // API-anrop för att söka efter platsnamn via OpenStreetMap
    const apiURL = worldwideSearch
      ? `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=50`
      : `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=SE&limit=50`;

    fetch(apiURL)
      .then(response => response.json())
      .then(data => {
        if (data.length === 0) {
          alert("Inga resultat hittades.");
          return;
        }

        currentMarkersGroup = L.featureGroup();

        data.forEach(result => {
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          const marker = L.marker([lat, lng]).addTo(currentMarkersGroup);
          marker.on('click', () => showAllInfo(lat, lng));
        });

        currentMarkersGroup.addTo(map);
        map.fitBounds(currentMarkersGroup.getBounds());
      })
      .catch(console.error);

    document.getElementById('results').innerHTML = "";
  }
}

/**
 * Söker efter en socken och zoomar in på dess polygon.
 * @param {string} sockenQuery - Användarens inmatade sockennamn.
 */
function highlightSocken(sockenQuery) {
  if (!geojsonSockenstad) {
    console.error("Socken GeoJSON ej laddat");
    return;
  }

  // Ta bort "socken" från sökningen
  let sockenName = sockenQuery.replace(/\s?socken$/, "").trim().toLowerCase();

  // Hitta matchande socken i GeoJSON
  const matches = geojsonSockenstad.features.filter(f => 
    f.properties.sockenstadnamn.toLowerCase() === sockenName
  );

  if (matches.length === 0) {
    alert("Ingen socken hittades med det namnet.");
    return;
  }

  // Använd huvudområdet (huvudomrade = "J") om det finns, annars första matchningen
  let mainMatch = matches.find(m => m.properties.huvudomrade === "J") || matches[0];

  // Tänd sockenlagret om det är släckt
  if (!map.hasLayer(overlayMaps["Socknar"])) {
    overlayMaps["Socknar"].addTo(map);
  }

  // Zooma in på polygonen
  const bounds = L.geoJSON(mainMatch).getBounds();
  map.fitBounds(bounds);
}

/**
 * Dölj sökresultat när man klickar utanför.
 */
document.addEventListener('click', (event) => {
  const resultsContainer = document.getElementById('results');
  const searchInput = document.getElementById('searchField');
  if (!resultsContainer.contains(event.target) && !searchInput.contains(event.target)) {
    resultsContainer.innerHTML = "";
  }
});

/**
 * Rensa kartan från markörer.
 */
document.getElementById('clearPinsButton').addEventListener('click', function () {
  if (currentMarkersGroup) {
    map.removeLayer(currentMarkersGroup);
    currentMarkersGroup = null;
  }
});


/****************************************************
 * KOORDINATKONVERTERING
 ****************************************************/

/**
 * Definierar projektionerna för RT90, SWEREF99 TM och WGS84
 * Dessa används vid konvertering mellan olika koordinatsystem.
 */
proj4.defs([
  ["EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs"], // WGS84
  ["EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +datum=WGS84 +units=m +no_defs"], // SWEREF 99 TM
  ["EPSG:3847", "+proj=tmerc +lat_0=0 +lon_0=15.806284529 +k=1.00000561024 +x_0=1500064.274 +y_0=-667.711 +ellps=bessel +datum=WGS84 +units=m +towgs84=-414.1,41.3,603.1,0.855,2.141,7.023,0"] // RT90 2.5 gon V
]);

// Lyssna på klick på konverteringsknappen
document.getElementById("convertButton").addEventListener("click", convertCoordinates);

/**
 * Konverterar koordinater mellan WGS84, RT90 och SWEREF 99 TM.
 * Tar in en av koordinattyperna och räknar om till de övriga.
 */
function convertCoordinates() {
  // Hämtar inmatade koordinater
  let rt90Input = document.getElementById("rt90Input").value.trim();
  let swerefInput = document.getElementById("swerefInput").value.trim();
  let wgs84Input = document.getElementById("wgs84Input").value.trim();

  let rt90, sweref, wgs84;

  if (rt90Input) {
    // Om användaren matar in RT90-konvertera till WGS84 och SWEREF 99 TM
    let [y, x] = rt90Input.split(",").map(Number);
    wgs84 = proj4("EPSG:3847", "EPSG:4326", [x, y]);  // RT90 → WGS84
    sweref = proj4("EPSG:4326", "EPSG:3006", wgs84);  // WGS84 → SWEREF99
  } 
  else if (swerefInput) {
    // Om användaren matar in SWEREF 99 TM, konvertera till WGS84 och RT90
    let [y, x] = swerefInput.split(",").map(Number);
    wgs84 = proj4("EPSG:3006", "EPSG:4326", [x, y]);  // SWEREF99 → WGS84
    rt90 = proj4("EPSG:4326", "EPSG:3847", wgs84);    // WGS84 → RT90
  } 
  else if (wgs84Input) {
    // Om användaren matar in WGS84, konvertera till RT90 och SWEREF 99 TM
    let [lat, lon] = wgs84Input.split(",").map(Number);
    rt90 = proj4("EPSG:4326", "EPSG:3847", [lon, lat]);   // WGS84 → RT90
    sweref = proj4("EPSG:4326", "EPSG:3006", [lon, lat]); // WGS84 → SWEREF99
    wgs84 = [lon, lat]; // Behåll WGS84 för att visa i resultatet
  } else {
    alert("Ange minst en koordinat för att konvertera.");
    return;
  }

  // Uppdaterar resultatfälten i användargränssnittet
  document.getElementById("wgs84Result").textContent = wgs84
    ? `${wgs84[1].toFixed(5)}, ${wgs84[0].toFixed(5)}`
    : "-";

  document.getElementById("rt90Result").textContent = rt90
    ? `${Math.round(rt90[1])}, ${Math.round(rt90[0])}`
    : "-";

  document.getElementById("swerefResult").textContent = sweref
    ? `${Math.round(sweref[1])}, ${Math.round(sweref[0])}`
    : "-";
}

/****************************************************
 * HÄMTA GEODATA (BULK)
 ****************************************************/

/**
 * Läser in och bearbetar en Excel-fil
 * @param {File} file - Excel-filen som användaren laddar upp
 */
function readAndProcessExcel(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const sheetName = workbook.SheetNames[0]; // Första bladet
    const worksheet = workbook.Sheets[sheetName];

    // Konvertera till JSON-format
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    console.log("✅ Excel-data inläst:", jsonData);

    processRows(jsonData);
  };

  reader.readAsArrayBuffer(file);
}

/**
 * Lyssnare på uppladdningsknappen för Excel-filen
 */
document.getElementById("processBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("excelFile");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Välj en Excel-fil först!");
    return;
  }
  readAndProcessExcel(fileInput.files[0]);
});

/**
 * Visar namnet på den valda Excel-filen i UI
 */
document.getElementById("excelFile").addEventListener("change", function (e) {
  const fileNameDisplay = document.getElementById("selectedFileName");
  fileNameDisplay.textContent = e.target.files.length > 0
    ? `Vald fil: ${e.target.files[0].name}`
    : "";
});

/**
 * Bearbetar varje rad i den inlästa Excel-filen och kopplar koordinater till geografiska områden.
 * Hämtar även land och adress från Nominatim API.
 * 
 * @param {Array} rows - Lista med objekt där varje objekt representerar en rad i Excel-filen.
 */
async function processRows(rows) {
  console.log("🔍 Startar bearbetning av rader...");

  for (let row of rows) {
    const lat = parseFloat(row.lat);
    const lon = parseFloat(row.lon);
    let manuellKontroll = "";

    if (isNaN(lat) || isNaN(lon) || lat < 55 || lat > 70 || lon < 10 || lon > 25) {
      console.warn("⚠️ Ogiltiga koordinater i rad:", row);
      row.lan = "";
      row.kommun = "";
      row.landskap = "";
      row.socken = "";
      row.adress = "";
      row.land = "";
      manuellKontroll = "Kontrollera koordinater (punkt utanför Sverige)";
    } else {
      // Hämta geografiska områden via polygoner
      row.lan = polygonLookup(lon, lat, geojsonLan, "lan") || "";
      row.kommun = polygonLookup(lon, lat, geojsonKommun, "kommun") || "";
      row.landskap = polygonLookup(lon, lat, geojsonLandskap, "Landskap-lappmark") || "";
      row.socken = polygonLookup(lon, lat, geojsonSockenstad, "sockenstadnamn") || "";

      if (!row.lan || !row.kommun || !row.landskap) {
        manuellKontroll = "Ingen träff i polygondata";
      }

      // Hämta land och adress från Nominatim API
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
        const response = await fetch(nominatimUrl);
        
        if (!response.ok) throw new Error("Nominatim API-fel");

        const data = await response.json();

        // Spara landet
        row.land = data.address.country || "Okänt land";

        // Omvandla adress från mindre till större område
        let fullAddress = data.display_name || "Okänd plats";
        let sortedAddress = fullAddress.split(", ").reverse().join(", ");
        row.adress = sortedAddress;

      } catch (error) {
        console.error("Fel vid hämtning av adress från Nominatim:", error);
        row.adress = "N/A";
        row.land = "N/A";
      }
    }

    row.manuell_kontroll = manuellKontroll;
  }

  console.log("✅ Färdig med bearbetning. Rader:", rows);
  generateAndDownloadExcel(rows);
}


/**
 * Söker efter geografiska polygonträffar baserat på latitud och longitud
 * @param {number} lon - Longitud
 * @param {number} lat - Latitud
 * @param {Object} geojson - GeoJSON-data som innehåller geografiska områden
 * @param {string} propertyName - Egenskapen som ska hämtas (exempelvis "kommun", "län")
 * @returns {string|null} - Namnet på området om en träff hittas, annars null.
 */
function polygonLookup(lon, lat, geojson, propertyName) {
  if (!geojson || !geojson.features) {
    console.log(`Inget GeoJSON hittades för ${propertyName}`);
    return null;
  }

  const point = turf.point([lon, lat]);

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;
    if (turf.booleanPointInPolygon(point, feature)) {
      return feature.properties[propertyName];
    }
  }

  return null;
}

/**
 * Skapar och laddar ner en Excel-fil med bearbetad geodata
 * @param {Array} rows - Lista med objekt som ska exporteras till Excel.
 */
function generateAndDownloadExcel(rows) {
  if (rows.length === 0) {
    console.warn("🚨 Ingen data att exportera.");
    return;
  }

  // Definiera den önskade kolumnordningen och rubriknamnen
  const columnHeaders = [
    "id", "lat", "lon", "land", "lan", "landskap", "kommun", "socken", "adress", "manuell_kontroll"
  ];

  // Omorganisera varje rad enligt den definierade ordningen
  const orderedRows = rows.map((row, index) => {
    let orderedRow = {};
    orderedRow["id"] = index + 1; // Lägg till ett ID-fält, börjar från 1
    columnHeaders.forEach(col => {
      orderedRow[col] = row[col] || ""; // Fyll med tom sträng om värdet saknas
    });
    return orderedRow;
  });

  // Skapa en ny arbetsbok
  const workbook = XLSX.utils.book_new();

  // Skapa ett kalkylblad med data i rätt ordning
  const worksheet = XLSX.utils.json_to_sheet(orderedRows, { header: columnHeaders });

  // Lägg till "Resultat" som första blad
  XLSX.utils.book_append_sheet(workbook, worksheet, "resultat");

  // Skapa informationsbladet "info"
  const infoData = [
    ["Info"],
    [""],
    ["Data i kolumnerna land och adress hämtas från OpenStreetMap via Nominatims geokodningstjänst."],
    ["Kolumnerna län, landskap, kommun, och socken hämtas från lager nedladdade från Lantmäteriet år 2025."]
  ];
  const infoSheet = XLSX.utils.aoa_to_sheet(infoData);

  // Lägg till "info" som andra blad
  XLSX.utils.book_append_sheet(workbook, infoSheet, "info");

  // Skriv arbetsboken till en Blob-fil
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });

  // Skapa och klicka på en länk för att ladda ner filen
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = "geo-resultat.xlsx";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);

  console.log("✅ Excel-fil med rätt kolumnordning och informationsblad skapad och nedladdad!");
}



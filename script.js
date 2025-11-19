/****************************************************
 ********************* geoLOCUS  ********************
 ****************************************************/

// Wait for all libraries to load
window.addEventListener('load', function() {
  console.log('Page loaded, initializing...');
  
  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    alert('Error: Leaflet library failed to load. Check your internet connection.');
    return;
  }
  
  // Initialize everything
  initApp();
});

// Global variables
let geojsonLan, geojsonKommun, geojsonLandskap, geojsonSockenstad;
let currentMarkersGroup;
let map;
let overlayMaps = {};
let layerControl;

function initApp() {
  // Initialize map first
  initializeMap();
  
  // Then load GeoJSON data
  loadGeoJSON();
}

function loadGeoJSON() {
  console.log('Starting to load GeoJSON files...');
  
  Promise.all([
    fetch('data/lan.geojson').then(r => {
      if (!r.ok) throw new Error('lan.geojson not found');
      return r.json();
    }),
    fetch('data/kommun.geojson').then(r => {
      if (!r.ok) throw new Error('kommun.geojson not found');
      return r.json();
    }),
    fetch('data/landskap-lappmark.geojson').then(r => {
      if (!r.ok) throw new Error('landskap-lappmark.geojson not found');
      return r.json();
    }),
    fetch('data/sockenstad_wgs84.geojson').then(r => {
      if (!r.ok) throw new Error('sockenstad_wgs84.geojson not found');
      return r.json();
    })
  ])
  .then(([lanData, kommunData, landskapData, sockenstadData]) => {
    geojsonLan = lanData;
    geojsonKommun = kommunData;
    geojsonLandskap = landskapData;
    geojsonSockenstad = sockenstadData;
    console.log("✅ GeoJSON-lager inlästa och redo för användning!");
    
    // Add GeoJSON layers to map after data is loaded
    addGeoJsonLayers();
  })
  .catch(err => {
    console.error("❌ Fel vid inläsning av GeoJSON:", err);
    alert("Kunde inte ladda geodata-filer.\n\nKontrollera att:\n1. Du har en 'data/' mapp i samma katalog som HTML-filen\n2. Alla .geojson filer finns i 'data/' mappen\n\nFel: " + err.message);
  });
}

// Initialize map
function initializeMap() {
  console.log('Initializing map...');

  map = L.map('map', {
    center: [62.0, 15.0],
    zoom: 5,
    zoomSnap: 1,
    zoomDelta: 1,
    minZoom: 4,
    maxZoom: 19
  });

  var osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    tileSize: 256,
    detectRetina: false,
    noWrap: true,
    maxZoom: 19
  }).addTo(map);

  var topowebb = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/topowebb/?', {
    layers: ['topowebbkartan'],
    format: 'image/png',
    transparent: false,
    maxZoom: 19
  });

  var ortofoto = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/ortofoto/?', {
    layers: ['Ortofoto_0.5', 'Ortofoto_0.4', 'Ortofoto_0.25', 'Ortofoto_0.16'],
    format: 'image/png',
    transparent: false,
    maxZoom: 17
  });

  var fastigheter_rod = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/fastighetsindelning/?', {
    layers: ['granser', 'text'],
    styles: ['ljusbakgrund', 'ljusbakgrund'],
    maxZoom: 17,
    transparent: true,
    format: 'image/png'
  });

  let baseMaps = {
    "OpenStreetMap": osmBase
  };

  overlayMaps = {
    "Topowebb": topowebb,
    "Ortofoto": ortofoto,
    "Fastigheter": fastigheter_rod
  };

  layerControl = L.control.layers(baseMaps, overlayMaps, {
    position: 'bottomright',
    collapsed: true
  }).addTo(map);

  L.control.scale().addTo(map);

  const coordinateDisplay = L.control({ position: "bottomleft" });

  coordinateDisplay.onAdd = function(map) {
    const div = L.DomUtil.create("div", "coordinate-display");
    div.innerHTML = "Lat: --, Lon: --";
    return div;
  };

  coordinateDisplay.addTo(map);

  map.on("mousemove", function(e) {
    document.querySelector(".coordinate-display").innerHTML = 
      `Lat: ${e.latlng.lat.toFixed(5)}, Lon: ${e.latlng.lng.toFixed(5)}`;
  });

  // Map click handler
  map.on('click', function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    showAllInfo(lat, lng);
  });

  setTimeout(() => map.invalidateSize(), 500);
}

// Add GeoJSON layers to map
function addGeoJsonLayers() {
  console.log('Adding GeoJSON layers to map...');
  
  if (!map) {
    console.error('Map not initialized');
    return;
  }

  function addGeoJsonLayer(geojsonData, layerName, styleObj, visible = true) {
    const layer = L.geoJSON(geojsonData, { style: styleObj });
    overlayMaps[layerName] = layer;
    layerControl.addOverlay(layer, layerName);

    if (visible) {
      layer.addTo(map);
    }
  }

  addGeoJsonLayer(geojsonKommun, "Kommun", { color: "#10b981", weight: 1, fillColor: "green", fillOpacity: 0 });
  addGeoJsonLayer(geojsonLan, "Län", { color: "#3b82f6", weight: 2, fillColor: "blue", fillOpacity: 0 });
  addGeoJsonLayer(geojsonLandskap, "Landskap", { color: "#8b5cf6", weight: 1, fillColor: "purple", fillOpacity: 0 });
  addGeoJsonLayer(geojsonSockenstad, "Socknar", { color: "#000000", weight: 2, fillColor: "none", fillOpacity: 0 }, false);
  
  console.log('✅ All layers added to map');
}

// Tab system - make it globally accessible
window.openTab = function(tabId) {
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.remove('active');
  });

  document.getElementById(tabId).classList.add('active');
  
  // Find and activate the corresponding button
  document.querySelectorAll('.tab-button').forEach(btn => {
    if (btn.textContent.includes('Karta') && tabId === 'main') btn.classList.add('active');
    if (btn.textContent.includes('Konvertera') && tabId === 'converter') btn.classList.add('active');
    if (btn.textContent.includes('Hämta geodata') && tabId === 'hämta-geodata') btn.classList.add('active');
  });

  if (tabId === "main" && typeof map !== "undefined") {
    setTimeout(() => map.invalidateSize(), 300);
  }
}

// Modal functions
window.openModal = function(modalName) {
  if (modalName === 'tips') {
    document.getElementById('tipsModal').classList.add('active');
  } else if (modalName === 'sources') {
    document.getElementById('sourcesModal').classList.add('active');
  }
}

window.closeModal = function(modalName) {
  if (modalName === 'tips') {
    document.getElementById('tipsModal').classList.remove('active');
  } else if (modalName === 'sources') {
    document.getElementById('sourcesModal').classList.remove('active');
  }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
});

// Filters toggle
window.toggleFilters = function() {
  const content = document.getElementById('filters-content');
  const arrow = document.getElementById('filter-arrow');
  content.classList.toggle('active');
  arrow.textContent = content.classList.contains('active') ? '▲' : '▼';
}

// Show location info with all three coordinate systems
async function showAllInfo(lat, lng) {
  try {
    // Convert coordinates to all three systems first
    let rt90Coords, swerefCoords;
    try {
      rt90Coords = proj4("EPSG:4326", "EPSG:3847", [lng, lat]);
      swerefCoords = proj4("EPSG:4326", "EPSG:3006", [lng, lat]);
    } catch (e) {
      console.error("Coordinate conversion error:", e);
      rt90Coords = null;
      swerefCoords = null;
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(nominatimUrl);
    
    if (!response.ok) throw new Error("Fel vid hämtning från Nominatim API");

    const data = await response.json();
    const fullAddress = data.display_name || "Okänd plats";
    const formattedAddress = fullAddress.split(", ").reverse().join(", ");

    let infoList = [];

    Object.entries(overlayMaps).forEach(([layerName, layer]) => {
      if (!map.hasLayer(layer)) return;

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
            if (foundSocken) text += `<strong>Socken:</strong> ${foundSocken}<br>`;
            infoList.push(text);
          }
        });
      }
    });

    let polygonText = infoList.length === 0
      ? "<em>Ingen polygonträff i aktiva lager</em>"
      : infoList.join("") + "<br><strong>Källa:</strong> Lantmäteriet";

    // Build coordinate display with all three systems
    let coordText = `<strong>WGS84:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}<br>`;
    if (rt90Coords) {
      coordText += `<strong>RT90 2.5 gon V:</strong> ${Math.round(rt90Coords[1])}, ${Math.round(rt90Coords[0])}<br>`;
    }
    if (swerefCoords) {
      coordText += `<strong>SWEREF99 TM:</strong> ${Math.round(swerefCoords[1])}, ${Math.round(swerefCoords[0])}<br>`;
    }

    const popupHtml = `
      <strong>Koordinater:</strong><br>
      ${coordText}
      <br>
      <strong>Adress:</strong> ${formattedAddress}
      <br><br><strong>Källa:</strong> Nominatim/OpenStreetMap
      <hr>
      ${polygonText}
    `;

    L.popup()
      .setLatLng([lat, lng])
      .setContent(popupHtml)
      .openOn(map);

  } catch (error) {
    console.error("Fel vid showAllInfo():", error);
  }
}

// Search functionality
function debounce(func, delay) {
  let debounceTimer;
  return function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => func.apply(this, arguments), delay);
  };
}

document.getElementById('searchField').addEventListener('input', debounce(handleAutocomplete, 300));
document.getElementById('searchButton').addEventListener('click', performSearch);
document.getElementById('searchField').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    performSearch();
  }
});

function handleAutocomplete() {
  const query = document.getElementById('searchField').value.trim();
  const resultsContainer = document.getElementById('results');
  const worldwideSearch = document.getElementById('worldwideToggle').checked;

  if (query.length < 3) {
    resultsContainer.innerHTML = "";
    return;
  }

  const apiURL = worldwideSearch
    ? `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=50`
    : `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=SE&limit=50`;

  fetch(apiURL)
    .then(response => response.json())
    .then(data => {
      const selectedLan = document.getElementById('filterLan').value;
      const selectedLandskap = document.getElementById('filterLandskap').value;

      const filteredData = data.filter(result => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        if (selectedLan) {
          const resultLan = polygonLookup(lng, lat, geojsonLan, "lan");
          if (resultLan !== selectedLan) return false;
        }
        if (selectedLandskap) {
          const resultLandskap = polygonLookup(lng, lat, geojsonLandskap, "Landskap-lappmark");
          if (resultLandskap !== selectedLandskap) return false;
        }
        return true;
      });

      resultsContainer.innerHTML = "";
      if (filteredData.length === 0) return;

      const ul = document.createElement('ul');

      filteredData.forEach(result => {
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
    })
    .catch(console.error);
}

function isLikelyWGS84(coords) {
  return coords[0] > 50 && coords[0] < 70 && coords[1] > 5 && coords[1] < 30;
}

function isLikelyRT90(coords) {
  return coords[0] > 6000000 && coords[0] < 7700000 && coords[1] > 1200000 && coords[1] < 1900000;
}

function isLikelySWEREF99(coords) {
  return coords[0] > 6100000 && coords[0] < 7750000 && coords[1] > 250000 && coords[1] < 950000;
}

function performSearch() {
  const query = document.getElementById('searchField').value.trim().toLowerCase();
  const worldwideSearch = document.getElementById('worldwideToggle').checked;

  if (query === "") {
    alert("Ange ett sökord eller koordinater.");
    return;
  }

  if (query.includes("socken")) {
    highlightSocken(query);
    return;
  }

  if (currentMarkersGroup) {
    map.removeLayer(currentMarkersGroup);
    currentMarkersGroup = null;
  }

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

        const selectedLan = document.getElementById('filterLan').value;
        const selectedLandskap = document.getElementById('filterLandskap').value;

        const filteredData = data.filter(result => {
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          
          if (selectedLan) {
            const resultLan = polygonLookup(lng, lat, geojsonLan, "lan");
            if (resultLan !== selectedLan) return false;
          }
          if (selectedLandskap) {
            const resultLandskap = polygonLookup(lng, lat, geojsonLandskap, "Landskap-lappmark");
            if (resultLandskap !== selectedLandskap) return false;
          }
          return true;
        });

        if (filteredData.length === 0) {
          alert("Inga resultat hittades med de valda filtren.");
          return;
        }

        currentMarkersGroup = L.featureGroup();

        filteredData.forEach(result => {
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

function highlightSocken(sockenQuery) {
  if (!geojsonSockenstad) {
    console.error("Socken GeoJSON ej laddat");
    return;
  }

  let sockenName = sockenQuery.replace(/\s?socken$/, "").trim().toLowerCase();

  const matches = geojsonSockenstad.features.filter(f => 
    f.properties.sockenstadnamn.toLowerCase() === sockenName
  );

  if (matches.length === 0) {
    alert("Ingen socken hittades med det namnet.");
    return;
  }

  let mainMatch = matches.find(m => m.properties.huvudomrade === "J") || matches[0];

  if (!map.hasLayer(overlayMaps["Socknar"])) {
    overlayMaps["Socknar"].addTo(map);
  }

  const bounds = L.geoJSON(mainMatch).getBounds();
  map.fitBounds(bounds);
}

document.addEventListener('click', (event) => {
  const resultsContainer = document.getElementById('results');
  const searchInput = document.getElementById('searchField');
  if (!resultsContainer.contains(event.target) && !searchInput.contains(event.target)) {
    resultsContainer.innerHTML = "";
  }
});

document.getElementById('clearPinsButton').addEventListener('click', function () {
  if (currentMarkersGroup) {
    map.removeLayer(currentMarkersGroup);
    currentMarkersGroup = null;
  }
});

/****************************************************
 * COORDINATE CONVERSION
 ****************************************************/

// Define projections
proj4.defs([
  ["EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs"],
  ["EPSG:3006", "+proj=utm +zone=33 +ellps=GRS80 +datum=WGS84 +units=m +no_defs"],
  ["EPSG:3847", "+proj=tmerc +lat_0=0 +lon_0=15.806284529 +k=1.00000561024 +x_0=1500064.274 +y_0=-667.711 +ellps=bessel +datum=WGS84 +units=m +towgs84=-414.1,41.3,603.1,0.855,2.141,7.023,0"]
]);

document.getElementById("convertButton").addEventListener("click", convertCoordinates);

function convertCoordinates() {
  let rt90Input = document.getElementById("rt90Input").value.trim();
  let swerefInput = document.getElementById("swerefInput").value.trim();
  let wgs84Input = document.getElementById("wgs84Input").value.trim();

  let rt90, sweref, wgs84;

  if (rt90Input) {
    // Accept both comma and space as separators
    let parts = rt90Input.split(/[\s,]+/).filter(p => p).map(Number);
    if (parts.length !== 2) {
      alert("Ange koordinater i formatet: Nord, Ost (eller Nord Ost)");
      return;
    }
    let [y, x] = parts;
    wgs84 = proj4("EPSG:3847", "EPSG:4326", [x, y]);
    sweref = proj4("EPSG:4326", "EPSG:3006", wgs84);
  } 
  else if (swerefInput) {
    // Accept both comma and space as separators
    let parts = swerefInput.split(/[\s,]+/).filter(p => p).map(Number);
    if (parts.length !== 2) {
      alert("Ange koordinater i formatet: Nord, Ost (eller Nord Ost)");
      return;
    }
    let [y, x] = parts;
    wgs84 = proj4("EPSG:3006", "EPSG:4326", [x, y]);
    rt90 = proj4("EPSG:4326", "EPSG:3847", wgs84);
  } 
  else if (wgs84Input) {
    // Accept both comma and space as separators
    let parts = wgs84Input.split(/[\s,]+/).filter(p => p).map(Number);
    if (parts.length !== 2) {
      alert("Ange koordinater i formatet: Lat, Lon (eller Lat Lon)");
      return;
    }
    let [lat, lon] = parts;
    rt90 = proj4("EPSG:4326", "EPSG:3847", [lon, lat]);
    sweref = proj4("EPSG:4326", "EPSG:3006", [lon, lat]);
    wgs84 = [lon, lat];
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
}

/****************************************************
 * EXCEL PROCESSING
 ****************************************************/

function readAndProcessExcel(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
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

document.getElementById("processBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("excelFile");
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Välj en Excel-fil först!");
    return;
  }
  readAndProcessExcel(fileInput.files[0]);
});

document.getElementById("excelFile").addEventListener("change", function (e) {
  const fileNameDisplay = document.getElementById("selectedFileName");
  fileNameDisplay.textContent = e.target.files.length > 0
    ? `Vald fil: ${e.target.files[0].name}`
    : "";
});

async function processRows(rows) {
  console.log("🔍 Startar bearbetning av rader...");

  const dataSource = document.querySelector('input[name="dataSource"]:checked').value;

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
      row.lan = polygonLookup(lon, lat, geojsonLan, "lan") || "";
      row.kommun = polygonLookup(lon, lat, geojsonKommun, "kommun") || "";
      row.landskap = polygonLookup(lon, lat, geojsonLandskap, "Landskap-lappmark") || "";
      row.socken = polygonLookup(lon, lat, geojsonSockenstad, "sockenstadnamn") || "";

      if (!row.lan || !row.kommun || !row.landskap) {
        manuellKontroll = "Ingen träff i polygondata";
      }

      if (dataSource === "both") {
        try {
          const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
          const response = await fetch(nominatimUrl);
          
          if (!response.ok) throw new Error("Nominatim API-fel");

          const data = await response.json();
          row.land = data.address.country || "Okänt land";
          let fullAddress = data.display_name || "Okänd plats";
          let sortedAddress = fullAddress.split(", ").reverse().join(", ");
          row.adress = sortedAddress;

        } catch (error) {
          console.error("Fel vid hämtning av adress från Nominatim:", error);
          row.adress = "N/A";
          row.land = "N/A";
        }
      } else {
        row.adress = "Hämtas ej via Nominatim";
        row.land = "Hämtas ej via Nominatim";
      }
    }

    row.manuell_kontroll = manuellKontroll;
  }

  console.log("✅ Färdig med bearbetning. Rader:", rows);
  generateAndDownloadExcel(rows);
}

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

function generateAndDownloadExcel(rows) {
  if (rows.length === 0) {
    console.warn("🚨 Ingen data att exportera.");
    return;
  }

  const columnHeaders = [
    "id", "lat", "lon", "land", "lan", "landskap", "kommun", "socken", "adress", "manuell_kontroll"
  ];

  const orderedRows = rows.map((row, index) => {
    let orderedRow = {};
    orderedRow["id"] = index + 1;
    columnHeaders.forEach(col => {
      orderedRow[col] = row[col] || "";
    });
    return orderedRow;
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(orderedRows, { header: columnHeaders });
  XLSX.utils.book_append_sheet(workbook, worksheet, "resultat");

  const infoData = [
    ["Info"],
    [""],
    ["Data i kolumnerna land och adress hämtas från OpenStreetMap via Nominatims geokodningstjänst."],
    ["Kolumnerna län, landskap, kommun, och socken hämtas från lager nedladdade från Lantmäteriet år 2025."]
  ];
  const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
  XLSX.utils.book_append_sheet(workbook, infoSheet, "info");

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });

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
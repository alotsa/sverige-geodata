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
    if (btn.textContent.includes('Visa på karta') && tabId === 'visa-pa-karta') btn.classList.add('active');
    if (btn.textContent.includes('Hämta geodata') && tabId === 'hämta-geodata') btn.classList.add('active');
    if (btn.textContent.includes('Dokumentation') && tabId === 'dokumentation') btn.classList.add('active');
  });

  if (tabId === "main" && typeof map !== "undefined") {
    setTimeout(() => map.invalidateSize(), 300);
  }
  
  if (tabId === "visa-pa-karta") {
    setTimeout(() => {
      initUploadMap();
      if (mapUpload) mapUpload.invalidateSize();
    }, 300);
  }
}

// Modal functions
window.openModal = function(modalName) {
  if (modalName === 'tips') {
    document.getElementById('tipsModal').classList.add('active');
  }
}

window.closeModal = function(modalName) {
  if (modalName === 'tips') {
    document.getElementById('tipsModal').classList.remove('active');
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

// Helper function to format landskap display
function formatLandskap(landskapName) {
  if (!landskapName) return "";
  
  // Check if it's a lappmark (contains "lappmark" in the name)
  if (landskapName.toLowerCase().includes("lappmark")) {
    return `Lappland (${landskapName})`;
  }
  
  return landskapName;
}

// Convert DD to DMS string
function ddToDMS(dd, isLat) {
  const dir = isLat ? (dd >= 0 ? 'N' : 'S') : (dd >= 0 ? 'E' : 'W');
  dd = Math.abs(dd);
  const deg = Math.floor(dd);
  const minFull = (dd - deg) * 60;
  const min = Math.floor(minFull);
  const sec = (minFull - min) * 60;
  return `${deg}°${String(min).padStart(2,'0')}'${sec.toFixed(2).padStart(5,'0')}"${dir}`;
}

// Convert DD to DDM string
function ddToDDM(dd, isLat) {
  const dir = isLat ? (dd >= 0 ? 'N' : 'S') : (dd >= 0 ? 'E' : 'W');
  dd = Math.abs(dd);
  const deg = Math.floor(dd);
  const min = (dd - deg) * 60;
  return `${deg}°${min.toFixed(4).padStart(7,'0')}'${dir}`;
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
    const response = await fetch(nominatimUrl, {
          headers: { "User-Agent": "geoLocus/1.0 (https://geolocus.nrm.se)" }
        });
    
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
            if (foundLappmark) {
              const formattedLandskap = formatLandskap(foundLappmark);
              text += `<strong>Landskap:</strong> ${formattedLandskap}<br>`;
            }
            if (foundSocken) text += `<strong>Socken:</strong> ${foundSocken}<br>`;
            infoList.push(text);
          }
        });
      }
    });

    let polygonText = infoList.length === 0
      ? "<em>Ingen polygonträff i aktiva lager</em>"
      : infoList.join("") + "<br><strong>Källa:</strong> Lantmäteriet (utom lappmarker som avgränsas med kommungränser)";

    // Build coordinate display with all three systems
    let coordText = `<strong>WGS84:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)} <span onclick="copyCoordinates(${lat}, ${lng})" style="cursor: pointer; padding-left: 0.25rem; color: #1e293b;" title="Kopiera koordinater"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/></svg></span><br>`;
    if (rt90Coords) {
      coordText += `<strong>RT90 2.5 gon V:</strong> ${Math.round(rt90Coords[1])}, ${Math.round(rt90Coords[0])}<br>`;
    }
    if (swerefCoords) {
      coordText += `<strong>SWEREF99 TM:</strong> ${Math.round(swerefCoords[1])}, ${Math.round(swerefCoords[0])}<br>`;
    }
    coordText += `<strong>DMS:</strong> ${ddToDMS(lat, true)}, ${ddToDMS(lng, false)}<br>`;
    coordText += `<strong>DDM:</strong> ${ddToDDM(lat, true)}, ${ddToDDM(lng, false)}<br>`;

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

/****************************************************
 * DMS / DDM COORDINATE PARSING
 ****************************************************/

function parseDmsSingle(coordStr) {
  let s = coordStr.trim();
  let sign = 1;
  if (/[SsWw]/.test(s)) sign = -1;
  if (s.startsWith('-')) { sign = -1; s = s.slice(1); }
  s = s.replace(/[NSEWnsew]/g, '').replace(/\*/g, '°').trim();
  const nums = [...s.matchAll(/\d+(?:[.,]\d+)?/g)]
    .map(m => parseFloat(m[0].replace(',', '.')));
  if (nums.length === 1) return sign * nums[0];
  if (nums.length === 2) return sign * (nums[0] + nums[1] / 60);
  if (nums.length === 3) return sign * (nums[0] + nums[1] / 60 + nums[2] / 3600);
  return null;
}

function parseDmsCoordinatePair(input) {
  const s = input.trim();
  const nsLeadMatch = s.match(/^([NSns]\S[\s\S]+?)\s+([EWew]\S[\s\S]+)$/);
  if (nsLeadMatch) {
    const lat = parseDmsSingle(nsLeadMatch[1]);
    const lon = parseDmsSingle(nsLeadMatch[2]);
    if (lat !== null && lon !== null) return [lat, lon];
  }
  const afterNS = s.split(/(?<=[NSns])\s*,?\s*/);
  if (afterNS.length === 2 && afterNS[1]) {
    const lat = parseDmsSingle(afterNS[0]);
    const lon = parseDmsSingle(afterNS[1]);
    if (lat !== null && lon !== null) return [lat, lon];
  }
  const commaSplit = s.split(/,\s+/);
  if (commaSplit.length === 2) {
    const lat = parseDmsSingle(commaSplit[0]);
    const lon = parseDmsSingle(commaSplit[1]);
    if (lat !== null && lon !== null) return [lat, lon];
  }
  return null;
}

function isLikelyDMS(input) {
  return /[°*\'"]/.test(input) || /[NSEWnsew]/.test(input);
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

  // Försök DMS/DDM-parsning
  if (isLikelyDMS(query)) {
    const dmsResult = parseDmsCoordinatePair(query);
    if (dmsResult) {
      const [lat, lng] = dmsResult;
      map.setView([lat, lng], 10);
      showAllInfo(lat, lng);
      document.getElementById('results').innerHTML = "";
      return;
    }
  }

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

function showConverterError(message) {
  const el = document.getElementById('converterError');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function clearConverterError() {
  const el = document.getElementById('converterError');
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

document.getElementById("convertButton").addEventListener("click", convertCoordinates);

function convertCoordinates() {
  let rt90Input = document.getElementById("rt90Input").value.trim();
  let swerefInput = document.getElementById("swerefInput").value.trim();
  let wgs84Input = document.getElementById("wgs84Input").value.trim();

  clearConverterError();

  let rt90, sweref, wgs84;

  if (rt90Input) {
    // Accept both comma and space as separators
    let parts = rt90Input.split(/[\s,]+/).filter(p => p).map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) {
      showConverterError("Ange koordinater i formatet: Nord, Ost (eller Nord Ost)");
      return;
    }
    let [y, x] = parts;
    wgs84 = proj4("EPSG:3847", "EPSG:4326", [x, y]);
    sweref = proj4("EPSG:4326", "EPSG:3006", wgs84);
  }
  else if (swerefInput) {
    // Accept both comma and space as separators
    let parts = swerefInput.split(/[\s,]+/).filter(p => p).map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) {
      showConverterError("Ange koordinater i formatet: Nord, Ost (eller Nord Ost)");
      return;
    }
    let [y, x] = parts;
    wgs84 = proj4("EPSG:3006", "EPSG:4326", [x, y]);
    rt90 = proj4("EPSG:4326", "EPSG:3847", wgs84);
  }
  else if (wgs84Input) {
    // Accept both comma and space as separators
    let parts = wgs84Input.split(/[\s,]+/).filter(p => p).map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) {
      showConverterError("Ange koordinater i formatet: Lat, Lon (eller Lat Lon)");
      return;
    }
    let [lat, lon] = parts;
    rt90 = proj4("EPSG:4326", "EPSG:3847", [lon, lat]);
    sweref = proj4("EPSG:4326", "EPSG:3006", [lon, lat]);
    wgs84 = [lon, lat];
  } else {
    showConverterError("Ange minst en koordinat för att konvertera.");
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

function showFileError(message) {
  const el = document.getElementById('fileValidationMessage');
  el.textContent = message;
  el.style.display = 'block';
  el.style.background = '#fef2f2';
  el.style.borderColor = '#fca5a5';
  el.style.color = '#b91c1c';
}

function showFileWarning(message) {
  const el = document.getElementById('fileValidationMessage');
  el.textContent = message;
  el.style.display = 'block';
  el.style.background = '#fffbeb';
  el.style.borderColor = '#fcd34d';
  el.style.color = '#92400e';
}

function clearFileMessage() {
  const el = document.getElementById('fileValidationMessage');
  el.style.display = 'none';
  el.textContent = '';
}

function normalizeKeys(rows) {
  return rows.map(row => {
    const normalized = {};
    Object.keys(row).forEach(key => {
      normalized[key.toLowerCase().trim()] = row[key];
    });
    return normalized;
  });
}

function parseCoord(value) {
  if (value === null || value === undefined || value === "") return { val: NaN, hadComma: false };
  const str = String(value).trim();
  const hadComma = str.includes(',') && !str.includes('.');
  const normalized = hadComma ? str.replace(',', '.') : str;
  return { val: parseFloat(normalized), hadComma };
}

function readAndProcessExcel(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    let jsonData;
    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      if (isCsv) {
        const text = new TextDecoder('utf-8').decode(new Uint8Array(e.target.result));
        const workbook = XLSX.read(text, { type: "string" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      } else {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      }
    } catch (err) {
      showFileError(`Kunde inte läsa filen: ${err.message}`);
      return;
    }

    // Normalisera kolumnnamn till gemener
    jsonData = normalizeKeys(jsonData);

    // Validera att lat och lon finns
    if (jsonData.length === 0) {
      showFileError("Filen är tom eller saknar data.");
      return;
    }
    const firstRow = jsonData[0];
    if (!('lat' in firstRow) || !('lon' in firstRow)) {
      const missing = [];
      if (!('lat' in firstRow)) missing.push('lat');
      if (!('lon' in firstRow)) missing.push('lon');
      showFileError(`Filen saknar obligatoriska kolumner: ${missing.join(', ')}. Kontrollera att kolumnnamnen är korrekta.`);
      return;
    }

    // Varna om id saknas
    if (!('id' in firstRow)) {
      showFileWarning("Ingen id-kolumn hittades – radnummer används som id i resultatfilen.");
    } else {
      clearFileMessage();
    }

    console.log("✅ Excel-data inläst:", jsonData);
    processRows(jsonData);
  };

  reader.readAsArrayBuffer(file);
}

document.getElementById("processBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("excelFile");
  if (!fileInput.files || fileInput.files.length === 0) {
    showFileError("Välj en fil först.");
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
  
  // Show progress container
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  const progressCount = document.getElementById('progressCount');
  const progressTime = document.getElementById('progressTime');
  
  if (progressContainer) {
    progressContainer.style.display = 'block';
  }
  const processBtn = document.getElementById('processBtn');
  if (processBtn) processBtn.disabled = true;
  
  const totalRows = rows.length;
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const latParsed = parseCoord(row.lat);
    const lonParsed = parseCoord(row.lon);
    const lat = latParsed.val;
    const lon = lonParsed.val;
    let felmeddelande = "";
    if (latParsed.hadComma || lonParsed.hadComma) {
      felmeddelande = "Koordinat innehöll komma som decimalavskiljare – konverterades automatiskt";
    }

    // Update progress
    const progress = ((i + 1) / totalRows) * 100;
    const elapsed = (Date.now() - startTime) / 1000;
    const estimatedTotal = (elapsed / (i + 1)) * totalRows;
    const remaining = Math.max(0, estimatedTotal - elapsed);

    if (progressBar) progressBar.style.width = progress + '%';
    if (progressPercent) progressPercent.textContent = Math.round(progress) + '%';
    if (progressCount) progressCount.textContent = `${i + 1} / ${totalRows}`;
    if (progressText) progressText.textContent = `Bearbetar rad ${i + 1} av ${totalRows}`;
    if (progressTime && remaining > 0) {
      const mins = Math.floor(remaining / 60);
      const secs = Math.round(remaining % 60);
      progressTime.textContent = mins > 0
        ? `Uppskattad tid kvar: ${mins}m ${secs}s`
        : `Uppskattad tid kvar: ${secs}s`;
    }

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      // Ogiltiga koordinater - kan inte bearbetas alls
      console.warn("⚠️ Ogiltiga koordinater i rad:", row);
      row.lan = "";
      row.kommun = "";
      row.landskap = "";
      row.socken = "";
      row.adress = "";
      row.land = "";
      felmeddelande = "Ogiltiga koordinater";
    } else if (lat === 0 && lon === 0) {
      // Koordinaten (0, 0) är troligt datainmatningsfel
      console.warn("⚠️ Koordinat (0, 0) i rad:", row);
      row.lan = "";
      row.kommun = "";
      row.landskap = "";
      row.socken = "";
      row.adress = "";
      row.land = "";
      felmeddelande = "Koordinaten (0, 0) är troligen ett inmatningsfel";
    } else {
      // Giltiga koordinater - försök alltid slå upp svenska polygoner
      row.lan = polygonLookup(lon, lat, geojsonLan, "lan") || "";
      row.kommun = polygonLookup(lon, lat, geojsonKommun, "kommun") || "";

      // Get landskap and format it if it's a lappmark
      const rawLandskap = polygonLookup(lon, lat, geojsonLandskap, "Landskap-lappmark") || "";
      row.landskap = formatLandskap(rawLandskap);

      row.socken = polygonLookup(lon, lat, geojsonSockenstad, "sockenstadnamn") || "";

      if (dataSource === "both") {
        try {
          const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
          const response = await fetch(nominatimUrl, {
          headers: { "User-Agent": "geoLocus/1.0 (https://geolocus.nrm.se)" }
        });

          if (!response.ok) throw new Error(`Nominatim svarade med statuskod ${response.status}`);

          const data = await response.json();

          if (!data || !data.address) {
            row.adress = "";
            row.land = "";
            felmeddelande = "Nominatim returnerade ingen adressdata";
          } else if (Object.keys(data.address).length === 0) {
            row.adress = "";
            row.land = "";
            felmeddelande = "Nominatim returnerade ingen adress (punkt i hav eller ödemark?)";
          } else {
            row.land = data.address.country || "";
            if (!row.land) felmeddelande = "Nominatim returnerade inget land (punkt i hav eller ödemark?)";

            const fullAddress = data.display_name || "";
            row.adress = fullAddress
              ? fullAddress.split(", ").reverse().join(", ")
              : "";
          }

          // Add small delay to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error("Fel vid hämtning av adress från Nominatim:", error);
          row.adress = "";
          row.land = "";
          felmeddelande = `Nominatim API-fel: ${error.message}`;
        }
      } else {
        row.adress = "";
        row.land = "";
      }
    }

    row.felmeddelande = felmeddelande;
  }
  
  // Show completion
  if (progressText) progressText.textContent = 'Klar! Genererar Excel-fil...';
  if (progressPercent) progressPercent.textContent = '100%';
  if (progressTime) progressTime.textContent = '';

  console.log("✅ Färdig med bearbetning. Rader:", rows);
  generateAndDownloadExcel(rows);
  
  // Hide progress after download and re-enable button
  setTimeout(() => {
    if (progressContainer) progressContainer.style.display = 'none';
    if (processBtn) processBtn.disabled = false;
  }, 2000);
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
    "id", "lat", "lon", "land", "lan", "landskap", "kommun", "socken", "adress", "felmeddelande"
  ];

  const orderedRows = rows.map((row, index) => {
    let orderedRow = {};
    orderedRow["id"] = (row.id !== undefined && row.id !== "") ? row.id : index + 1;
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

/****************************************************
 * VISA PÅ KARTA - UPLOAD COORDINATES
 ****************************************************/

let mapUpload;
let uploadedMarkersGroup;

// Initialize the upload map when switching to that tab
function initUploadMap() {
  if (mapUpload) return; // Already initialized

  mapUpload = L.map('map-upload', {
    center: [62.0, 15.0],
    zoom: 5,
    zoomSnap: 1,
    zoomDelta: 1,
    minZoom: 4,
    maxZoom: 19
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    tileSize: 256,
    detectRetina: false,
    noWrap: true,
    maxZoom: 19
  }).addTo(mapUpload);

  // Add layer control
  let topowebb = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/topowebb/?', {
    layers: ['topowebbkartan'],
    format: 'image/png',
    transparent: false,
    maxZoom: 19
  });

  let ortofoto = L.tileLayer.wms('https://minkarta.lantmateriet.se/map/ortofoto/?', {
    layers: ['Ortofoto_0.5', 'Ortofoto_0.4', 'Ortofoto_0.25', 'Ortofoto_0.16'],
    format: 'image/png',
    transparent: false,
    maxZoom: 17
  });

  let baseMaps = {};
  let overlayMaps = {
    "Topowebb": topowebb,
    "Ortofoto": ortofoto
  };

  // GeoJSON-lager – läggs till direkt om datan finns
  if (geojsonKommun) {
    const kommunLayer = L.geoJSON(geojsonKommun, { style: { color: "#10b981", weight: 1, fillOpacity: 0 } });
    const lanLayer = L.geoJSON(geojsonLan, { style: { color: "#3b82f6", weight: 2, fillOpacity: 0 } });
    const landskapLayer = L.geoJSON(geojsonLandskap, { style: { color: "#8b5cf6", weight: 1, fillOpacity: 0 } });
    const socknarLayer = L.geoJSON(geojsonSockenstad, { style: { color: "#000000", weight: 2, fillOpacity: 0 } });
    overlayMaps["Kommun"] = kommunLayer;
    overlayMaps["Län"] = lanLayer;
    overlayMaps["Landskap"] = landskapLayer;
    overlayMaps["Socknar"] = socknarLayer;
    kommunLayer.addTo(mapUpload);
    lanLayer.addTo(mapUpload);
    landskapLayer.addTo(mapUpload);
  } else {
    console.warn("GeoJSON ej inläst än – lager läggs till när data finns");
  }

  L.control.layers(baseMaps, overlayMaps, {
    position: 'bottomright',
    collapsed: true
  }).addTo(mapUpload);

  L.control.scale().addTo(mapUpload);

  // Add coordinate display
  const coordDisplay = L.control({ position: "bottomleft" });
  coordDisplay.onAdd = function() {
    const div = L.DomUtil.create("div", "coordinate-display");
    div.innerHTML = "Lat: --, Lon: --";
    return div;
  };
  coordDisplay.addTo(mapUpload);

  mapUpload.on("mousemove", function(e) {
    const coordDisplays = document.querySelectorAll(".coordinate-display");
    if (coordDisplays.length > 1) {
      coordDisplays[1].innerHTML = `Lat: ${e.latlng.lat.toFixed(5)}, Lon: ${e.latlng.lng.toFixed(5)}`;
    }
  });

  setTimeout(() => mapUpload.invalidateSize(), 500);
}

// File upload handler - läs och visa direkt när fil väljs
document.getElementById('coordFile').addEventListener('change', function(e) {
  const fileNameDisplay = document.getElementById('coordFileName');
  
  if (e.target.files.length > 0) {
    const file = e.target.files[0];
    fileNameDisplay.textContent = `Vald fil: ${file.name}`;
    readAndDisplayCoordinates(file);
  } else {
    fileNameDisplay.textContent = "";
  }
});

document.getElementById('clearMapPinsBtn').addEventListener('click', function() {
  if (uploadedMarkersGroup) {
    mapUpload.removeLayer(uploadedMarkersGroup);
    uploadedMarkersGroup = null;
  }
});

function readAndDisplayCoordinates(file) {
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      console.log("✅ Koordinatfil inläst:", jsonData);
      displayCoordinatesOnMap(jsonData);
    } catch (error) {
      console.error("Fel vid inläsning av fil:", error);
      alert("Kunde inte läsa filen. Kontrollera att den är i rätt format.");
    }
  };

  reader.readAsArrayBuffer(file);
}

async function displayCoordinatesOnMap(rows) {
  if (!mapUpload) {
    initUploadMap();
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Clear old markers
  if (uploadedMarkersGroup) {
    mapUpload.removeLayer(uploadedMarkersGroup);
  }

  uploadedMarkersGroup = L.featureGroup();

  let validPoints = 0;

  // Process all markers immediately with local data (fast!)
  for (let row of rows) {
    const lat = parseFloat(row.lat);
    const lon = parseFloat(row.lon);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.warn("Ogiltig koordinat:", row);
      continue;
    }

    validPoints++;

    // Convert coordinates (local, instant)
    const rt90Coords = proj4("EPSG:4326", "EPSG:3847", [lon, lat]);
    const swerefCoords = proj4("EPSG:4326", "EPSG:3006", [lon, lat]);

    // Get polygon data (local, instant)
    const lan = polygonLookup(lon, lat, geojsonLan, "lan") || "Okänt";
    const kommun = polygonLookup(lon, lat, geojsonKommun, "kommun") || "Okänt";
    const rawLandskap = polygonLookup(lon, lat, geojsonLandskap, "Landskap-lappmark") || "Okänt";
    const landskap = formatLandskap(rawLandskap);
    const socken = polygonLookup(lon, lat, geojsonSockenstad, "sockenstadnamn") || "";

    // Create marker with initial popup (no address yet - will load on click)
    const marker = L.marker([lat, lon]);

    // Build initial popup content WITHOUT address (instant)
    let initialPopupContent = `
  <strong>id:</strong> ${row.id}<br><br>
  <strong>Koordinater:</strong><br>
  <strong>WGS84:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}<br>
  <strong>RT90 2.5 gon V:</strong> ${Math.round(rt90Coords[1])}, ${Math.round(rt90Coords[0])}<br>
  <strong>SWEREF99 TM:</strong> ${Math.round(swerefCoords[1])}, ${Math.round(swerefCoords[0])}<br>
  <br>
  <strong>Adress:</strong> <em style="color: #64748b;">Klicka på markören för att hämta adress...</em><br>
  <hr>
  <strong>Kommun:</strong> ${kommun}<br>
  <strong>Län:</strong> ${lan}<br>
  <strong>Landskap:</strong> ${landskap}<br>
  ${socken ? `<strong>Socken:</strong> ${socken}<br>` : ``}
  <strong>Källa:</strong> Lantmäteriet (utom lappmarker som avgränsas med kommungränser)
`;

    marker.bindPopup(initialPopupContent);

    // Lazy-load address data when popup is opened (only if user clicks!)
    marker.on('popupopen', async function() {
      const popup = marker.getPopup();
      
      // Check if we already fetched the address
      if (marker._addressFetched) {
        return;
      }
      
      try {
        // Show loading state
        popup.setContent(initialPopupContent.replace(
          'Klicka på markören för att hämta adress...',
          '<span style="color: #10b981;">Hämtar adress...</span>'
        ));

        // Fetch address from Nominatim
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
        const response = await fetch(nominatimUrl, {
          headers: { "User-Agent": "geoLocus/1.0 (https://geolocus.nrm.se)" }
        });
        const data = await response.json();
        const fullAddress = data.display_name || "Okänd plats";
        const formattedAddress = fullAddress.split(", ").reverse().join(", ");

        // Update popup with address
        let fullPopupContent = `
  <strong>id:</strong> ${row.id}<br><br>
  <strong>Koordinater:</strong><br>
  <strong>WGS84:</strong> ${lat.toFixed(5)}, ${lon.toFixed(5)}<br>
  <strong>RT90 2.5 gon V:</strong> ${Math.round(rt90Coords[1])}, ${Math.round(rt90Coords[0])}<br>
  <strong>SWEREF99 TM:</strong> ${Math.round(swerefCoords[1])}, ${Math.round(swerefCoords[0])}<br>
  <br>
  <strong>Adress:</strong> ${formattedAddress}<br><br>
  <strong>Källa:</strong> Nominatim/OpenStreetMap
  <hr>
  <strong>Kommun:</strong> ${kommun}<br>
  <strong>Län:</strong> ${lan}<br>
  <strong>Landskap:</strong> ${landskap}<br>
  ${socken ? `<strong>Socken:</strong> ${socken}<br>` : ``}
  <strong>Källa:</strong> Lantmäteriet (utom lappmarker som avgränsas med kommungränser)
`;

        popup.setContent(fullPopupContent);
        marker._addressFetched = true;

      } catch (error) {
        console.error("Fel vid hämtning av adress:", error);
        popup.setContent(initialPopupContent.replace(
          'Klicka på markören för att hämta adress...',
          '<span style="color: #ef4444;">Kunde inte hämta adress</span>'
        ));
      }
    });

    marker.addTo(uploadedMarkersGroup);
  }

  uploadedMarkersGroup.addTo(mapUpload);

  if (validPoints > 0) {
    // Zoom to show all markers
    mapUpload.fitBounds(uploadedMarkersGroup.getBounds(), { padding: [50, 50] });
    showCopyFeedback(`${validPoints} punkter laddade på kartan!`);
  } else {
    showCopyFeedback("Inga giltiga koordinater hittades i filen.");
  }
}

// ==========================================
// MOBILE MENU FUNCTIONS
// ==========================================

// Mobile menu toggle
window.toggleMobileMenu = function(event) {
  if (event) {
    event.stopPropagation();
  }
  
  const nav = document.getElementById('mobileTabNav');
  const toggle = document.querySelector('.mobile-menu-toggle');
  
  if (nav) {
    const isOpen = nav.classList.contains('mobile-menu-open');
    
    if (isOpen) {
      nav.classList.remove('mobile-menu-open');
      if (toggle) toggle.classList.remove('active');
    } else {
      nav.classList.add('mobile-menu-open');
      if (toggle) toggle.classList.add('active');
    }
  }
}

// Close mobile menu
window.closeMobileMenu = function() {
  const nav = document.getElementById('mobileTabNav');
  const toggle = document.querySelector('.mobile-menu-toggle');
  
  if (nav) {
    nav.classList.remove('mobile-menu-open');
  }
  if (toggle) {
    toggle.classList.remove('active');
  }
}

// Close menu when clicking outside
document.addEventListener('DOMContentLoaded', function() {
  document.addEventListener('click', function(event) {
    const nav = document.getElementById('mobileTabNav');
    const toggle = document.querySelector('.mobile-menu-toggle');
    
    if (nav && toggle && nav.classList.contains('mobile-menu-open')) {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) {
        nav.classList.remove('mobile-menu-open');
        toggle.classList.remove('active');
      }
    }
  });
});

// ==========================================
// COPY COORDINATES FUNCTION
// ==========================================
// Add this function to your script.js

// Copy WGS84 coordinates to clipboard
window.copyCoordinates = function(lat, lng) {
  const coordText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  
  // Use modern clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(coordText).then(() => {
      // Show success feedback
      showCopyFeedback('Koordinater kopierade! 📋');
    }).catch(err => {
      console.error('Failed to copy:', err);
      fallbackCopy(coordText);
    });
  } else {
    // Fallback for older browsers
    fallbackCopy(coordText);
  }
}

// Fallback copy method for older browsers
function fallbackCopy(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.select();
  
  try {
    document.execCommand('copy');
    showCopyFeedback('Koordinater kopierade! 📋');
  } catch (err) {
    showCopyFeedback('Kunde inte kopiera 😞');
  }
  
  document.body.removeChild(textArea);
}

// Show visual feedback when coordinates are copied
function showCopyFeedback(message) {
  // Remove existing feedback if any
  const existing = document.getElementById('copy-feedback');
  if (existing) {
    existing.remove();
  }
  
  // Create feedback element
  const feedback = document.createElement('div');
  feedback.id = 'copy-feedback';
  feedback.textContent = message;
  feedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(16, 185, 129, 0.95);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 10px;
    font-weight: 600;
    font-size: 1rem;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: fadeInOut 2s ease-in-out;
  `;
  
  document.body.appendChild(feedback);
  
  // Remove after 2 seconds
  setTimeout(() => {
    feedback.remove();
  }, 2000);
}

// Add CSS animation for feedback
if (!document.getElementById('copy-feedback-styles')) {
  const style = document.createElement('style');
  style.id = 'copy-feedback-styles';
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    }
  `;
  document.head.appendChild(style);
}
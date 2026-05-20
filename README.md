# geoLocus

Webbaserat verktyg för geografisk information om platser i Sverige.

## Funktioner

**Karta**
- Klicka var som helst på kartan för att se län, kommun, landskap, socken, koordinater och adress
- Sök på ortnamn, koordinater (WGS84, RT90, SWEREF99 TM, DMS, DDM), vägnummer, byggnader m.m.
- Filtrera sökning på län eller landskap
- Kartlager: OpenStreetMap, Lantmäteriets Topowebb, ortofoto och fastighetsindelning

**Hämta geodata**
- Ladda upp en Excel- eller CSV-fil med koordinater
- Få tillbaka en fil med län, landskap, kommun och socken (Lantmäteriet) samt adress och land (Nominatim/OpenStreetMap)

**Visa koordinater på karta**
- Visualisera koordinater från en Excel- eller CSV-fil på karta
- Rita ett område för att markera och exportera ett urval av punkter

**Konvertera koordinater**
- Konvertera enstaka koordinater eller en hel fil mellan WGS84, RT90 2.5 gon V och SWEREF99 TM

## Teknik

HTML, CSS, JavaScript med biblioteken [Leaflet.js](https://leafletjs.com/), [Turf.js](https://turfjs.org/), [proj4js](http://proj4js.org/) och [SheetJS](https://sheetjs.com/).
Geodata från [Lantmäteriet](https://www.lantmateriet.se/) och [OpenStreetMap](https://www.openstreetmap.org/) via Nominatim.

## Licens

CC0 1.0 – fri att använda utan restriktioner.

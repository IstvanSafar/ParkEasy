// Leaflet terkep: zona-poligonok, sajat pozicio, aktualis zona kiemelese.

import { loadZones } from './zones.js';

let map = null;
let positionMarker = null;
let zonesLayer = null;

export async function initMap(position, currentZone, onClick = null, onZoneSelect = null) {
  const offlineNote = document.getElementById('map-offline');
  offlineNote.classList.toggle('d-none', navigator.onLine);

  if (!map) {
    map = L.map('map').setView(position ? [position.lat, position.lng] : [47.4979, 19.0402], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (onClick) {
      map.on('click', (e) => onClick(e.latlng));
      window.__peMap = map; // tesztmodban automatizalt teszthez
    }

    try {
      const geojson = await loadZones();
      const currentCode = currentZone?.feature.properties.zone;
      // dij szerinti szinezes (Ft/ora): olcso zold -> draga piros
      const priceColor = (p) =>
        !p ? '#6c757d' : p <= 300 ? '#2e7d32' : p <= 450 ? '#7cb342'
        : p <= 600 ? '#f9a825' : p <= 800 ? '#ef6c00' : '#c62828';
      zonesLayer = L.geoJSON(geojson, {
        // pozicio-valaszto modban a poligonok atengedik a kattintast a terkepnek
        interactive: !onClick,
        style: (f) => ({
          color: priceColor(f.properties.price),
          weight: f.properties.zone === currentCode ? 3 : 1,
          fillOpacity: f.properties.zone === currentCode ? 0.5 : 0.25,
        }),
        onEachFeature: (f, layer) => {
          if (onClick) return;
          const p = f.properties;
          const div = document.createElement('div');
          div.innerHTML =
            `<b>Zóna: ${p.zone}</b><br>${p.district || ''}<br>` +
            `${p.price ? p.price + ' Ft/óra' : ''}<br>` +
            `${p.paidFrom && p.paidTo ? p.paidFrom + '–' + p.paidTo : ''}`;
          if (onZoneSelect) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-primary btn-sm mt-2 w-100';
            btn.textContent = 'Ezt a zónát választom';
            btn.addEventListener('click', () => {
              map.closePopup();
              onZoneSelect(f);
            });
            div.appendChild(btn);
          }
          layer.bindPopup(div);
        },
      }).addTo(map);
    } catch {
      // offline vagy hianyzo adat — a terkep zonak nelkul is hasznalhato
    }
  }

  updateMapPosition(position);
  // a d-none-bol elovett terkepnek ujra kell szamolnia a meretet
  setTimeout(() => map.invalidateSize(), 50);
}

export function updateMapPosition(position) {
  if (!map || !position) return;
  const latlng = [position.lat, position.lng];
  if (!positionMarker) {
    positionMarker = L.marker(latlng, { title: 'Itt vagy' }).addTo(map);
  } else {
    positionMarker.setLatLng(latlng);
  }
  map.setView(latlng, Math.max(map.getZoom(), 15));
}

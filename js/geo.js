// GPS es geometriai muveletek: point-in-polygon, legkozelebbi zona.

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('A bongeszo nem tamogatja a helymeghatarozast.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
      ...options,
    });
  });
}

export function watchPosition(onUpdate, onError) {
  if (!navigator.geolocation) return null;
  return navigator.geolocation.watchPosition(onUpdate, onError, {
    enableHighAccuracy: true,
    maximumAge: 15000,
  });
}

// Ray-casting: benne van-e a [lng, lat] pont a poligon gyurujeben.
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInPolygon(lng, lat, polygonCoords) {
  // elso gyuru a kulso hatar, a tobbi lyuk
  if (!pointInRing(lng, lat, polygonCoords[0])) return false;
  for (let i = 1; i < polygonCoords.length; i++) {
    if (pointInRing(lng, lat, polygonCoords[i])) return false;
  }
  return true;
}

// Tavolsag meterben, equirectangularis kozelites (varosi lepteknel pontos).
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const x = ((lng2 - lng1) * Math.PI / 180) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const y = (lat2 - lat1) * Math.PI / 180;
  return Math.sqrt(x * x + y * y) * R;
}

// A pont tavolsaga a poligon hatarvonalatol (csucspontok alapjan kozelitve).
function distanceToPolygon(lat, lng, polygonCoords) {
  let min = Infinity;
  for (const [vLng, vLat] of polygonCoords[0]) {
    const d = distanceMeters(lat, lng, vLat, vLng);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Zona keresese: eloszor pontos talalat (point-in-polygon),
 * ha nincs, a legkozelebbi zona tavolsaggal.
 * @returns {{feature: object, distance: number} | null}
 */
export function findZone(lat, lng, features) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const feature of features) {
    const coords = feature.geometry.coordinates;
    if (pointInPolygon(lng, lat, coords)) {
      return { feature, distance: 0 };
    }
    const d = distanceToPolygon(lat, lng, coords);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = feature;
    }
  }
  return nearest ? { feature: nearest, distance: Math.round(nearestDist) } : null;
}

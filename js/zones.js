// Zonaadatok betoltese es gyorsitotarazott hozzaferes.

let zonesPromise = null;

export function loadZones() {
  if (!zonesPromise) {
    zonesPromise = fetch('data/zones.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Zonaadat nem toltheto be: ' + res.status);
        return res.json();
      })
      .catch((err) => {
        zonesPromise = null; // kovetkezo hivas ujraprobalja
        throw err;
      });
  }
  return zonesPromise;
}

export async function getFeatures() {
  const geojson = await loadZones();
  return geojson.features;
}

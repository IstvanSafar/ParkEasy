// SMS URI osszeallitas — az iOS `&`-t var a body elott, minden mas `?`-t.

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function buildSmsUri(number, body) {
  const sep = isIOS() ? '&' : '?';
  return `sms:${number}${sep}body=${encodeURIComponent(body)}`;
}

// Rendszam normalizalas az NMF kovetelmenye szerint: nagybetu, szokoz/kotojel nelkul.
export function normalizePlate(plate) {
  return (plate || '').toUpperCase().replace(/[\s-]/g, '');
}

// Mobilszolgaltatoi "mobilvasarlas": a zonakod a telefonszam vege,
// az uzenet csak a rendszam (inditas) ill. STOP (leallitas).
const CARRIER_PREFIXES = {
  telekom: '+3630763',
  yettel: '+3620763',
  one: '+3670763',
};

// NMF kozponti szamok es uzenetformatum — orszagosan egyseges.
const NMF_START_NUMBER = '+36303444805';
const NMF_STOP_NUMBER = '+36303444806';

/**
 * Indito SMS. opts:
 *  - vehicleType: '' | 'M' | 'B' | 'T' | 'KT'
 *  - country: kulfoldi felsegjel (pl. 'CH'), csak mobilvasarlasnal
 *  - minutes: hatarozott ideju parkolas percben, csak mobilvasarlasnal
 * Szolgaltatoi formatum: RENDSZAM[,FELSEGJEL][,TIPUS][,PERC]
 */
export function buildStartSms(zoneProps, plate, provider = 'nmf', opts = {}) {
  const normalized = normalizePlate(plate);
  const prefix = CARRIER_PREFIXES[provider];
  if (prefix) {
    const parts = [normalized];
    if (opts.country) parts.push(opts.country.toUpperCase());
    if (opts.vehicleType) parts.push(opts.vehicleType);
    if (opts.minutes) parts.push(String(opts.minutes));
    const body = parts.join(',');
    const number = prefix + zoneProps.zone;
    return { uri: buildSmsUri(number, body), body, number };
  }
  // NMF: a tipus vesszovel a rendszam mogott tamogatott (M/T/B)
  const plateWithType = opts.vehicleType && opts.vehicleType !== 'KT'
    ? `${normalized},${opts.vehicleType}` : normalized;
  const body = `${zoneProps.zone} ${plateWithType}`;
  return { uri: buildSmsUri(NMF_START_NUMBER, body), body, number: NMF_START_NUMBER };
}

export function buildStopSms(zoneProps, plate, provider = 'nmf') {
  const prefix = CARRIER_PREFIXES[provider];
  if (prefix) {
    const number = prefix + zoneProps.zone;
    return { uri: buildSmsUri(number, 'STOP'), body: 'STOP', number };
  }
  const body = `STOP ${normalizePlate(plate)}`;
  return { uri: buildSmsUri(NMF_STOP_NUMBER, body), body, number: NMF_STOP_NUMBER };
}

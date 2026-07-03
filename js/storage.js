// LocalStorage wrapper — minden adat csak a keszuleken tarolodik.

const KEYS = {
  settings: 'parkeasy.settings',
  activeParking: 'parkeasy.activeParking',
  history: 'parkeasy.history',
  lastZone: 'parkeasy.lastZone',
};

const DEFAULT_SETTINGS = {
  plate1: '',
  plate1Type: '',    // '' | 'M' | 'B' | 'T' | 'KT'
  plate1Country: '', // kulfoldi felsegjel, pl. 'CH'
  plate2: '',
  plate2Type: '',
  plate2Country: '',
  defaultDuration: 60, // perc; 0 = start-stop
  defaultReminder: 0,  // perc az inditastol; 0 = nincs emlekezteto
  darkMode: false,
  paymentProvider: 'nmf', // 'nmf' | 'telekom' | 'yettel' | 'one'
  onboarded: false,       // elso inditasos szolgaltato-valaszto lefutott-e
};

function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}

export function saveSettings(settings) {
  write(KEYS.settings, settings);
}

export function getActiveParking() {
  return read(KEYS.activeParking);
}

export function saveActiveParking(parking) {
  write(KEYS.activeParking, parking);
}

export function clearActiveParking() {
  localStorage.removeItem(KEYS.activeParking);
}

export function getHistory() {
  return read(KEYS.history, []);
}

export function addHistoryEntry(entry) {
  const history = getHistory();
  history.unshift(entry);
  write(KEYS.history, history.slice(0, 20));
}

export function getLastZone() {
  return read(KEYS.lastZone);
}

export function saveLastZone(zoneProps) {
  write(KEYS.lastZone, zoneProps);
}

// ParkEasy belepesi pont: nezetek, inditasi folyamat, GPS -> zona -> SMS.

import * as storage from './storage.js';
import * as parking from './parking.js';
import * as notifications from './notifications.js';
import { getFeatures } from './zones.js';
import { getCurrentPosition, findZone } from './geo.js';
import { buildStartSms, buildStopSms, normalizePlate } from './sms.js';
import {
  initSettingsView, renderHistory, applyDarkMode,
  renderOptionGroup, getGroupValue, DURATION_OPTIONS, REMINDER_OPTIONS,
} from './settings.js';
import { initMap, updateMapPosition } from './map.js';

const NEARBY_MAX_METERS = 500; // ennel messzebbi "legkozelebbi zonat" nem ajanlunk fel

// Tesztmod asztali gephez: ?test=1 — terkepen kattintva valaszthato a pozicio,
// az SMS app nem nyilik meg. Fix pozicio: ?pos=47.475,19.047
const urlParams = new URLSearchParams(location.search);
const TEST_MODE = urlParams.has('test') || urlParams.has('pos');
const MOCK_POS = (() => {
  const raw = urlParams.get('pos');
  if (!raw) return null;
  const [lat, lng] = raw.split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
})();

let currentZone = null;      // { feature, distance } | null
let lastPosition = null;     // { lat, lng }
let tickInterval = null;
let pendingConfirm = null;   // 'start' | 'stop'
let lastSms = null;          // az utoljara elokeszitett SMS a masolashoz

const TYPE_ICONS = { '': '🚗', M: '🏍️', B: '🚌', T: '🚚', KT: '🚐' };

// A beallitasokban tarolt tipus/felsegjel a rendszamhoz.
function getPlateOpts(plate) {
  const s = storage.getSettings();
  const p = normalizePlate(plate);
  if (p === s.plate1) return { vehicleType: s.plate1Type, country: s.plate1Country };
  if (p === s.plate2) return { vehicleType: s.plate2Type, country: s.plate2Country };
  return { vehicleType: '', country: '' };
}

const $ = (id) => document.getElementById(id);

// ---------- Nezetek ----------

const VIEWS = ['view-home', 'view-active', 'view-settings', 'view-map'];

function showView(id) {
  for (const v of VIEWS) $(v).classList.toggle('d-none', v !== id);
  if (id === 'view-settings') renderHistory();
  if (id === 'view-map') {
    $('map-test-hint').classList.toggle('d-none', !TEST_MODE);
    initMap(lastPosition, currentZone,
      TEST_MODE ? onTestPositionPicked : null,
      TEST_MODE ? null : onManualZonePicked);
  }
}

// Eles modban a zona popupjabol kezzel is kivalaszthato a zona.
function onManualZonePicked(feature) {
  applyZone({ feature, distance: 0, manual: true }, false);
  showView('view-home');
}

// Tesztmodban a terkepre kattintva valasztjuk ki a "GPS" poziciot.
function onTestPositionPicked(latlng) {
  lastPosition = { lat: latlng.lat, lng: latlng.lng };
  updateMapPosition(lastPosition);
  showView('view-home');
  detectZone();
}

// ---------- Zonafelismeres ----------

async function detectZone() {
  const status = $('geo-status');
  status.classList.remove('d-none');
  $('zone-info').classList.add('d-none');
  $('zone-free').classList.add('d-none');

  let features;
  try {
    features = await getFeatures();
  } catch {
    status.innerHTML = '⚠️ A zónaadatok nem tölthetők be. Ellenőrizd a kapcsolatot, majd frissíts.';
    return;
  }

  try {
    if (MOCK_POS) {
      lastPosition = { ...MOCK_POS };
    } else if (TEST_MODE && lastPosition) {
      // tesztmodban a terkepen valasztott pozicio marad ervenyben
    } else if (TEST_MODE && !lastPosition) {
      status.innerHTML = '🧪 Tesztmód: válassz pozíciót a térképen.<br>' +
        '<button type="button" class="btn btn-primary btn-sm mt-2">Térkép megnyitása</button>';
      status.querySelector('button').addEventListener('click', () => showView('view-map'));
      return;
    } else {
      const pos = await getCurrentPosition();
      lastPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
  } catch (err) {
    status.innerHTML = err.code === 1
      ? '⚠️ Helymeghatározás letiltva. Engedélyezd a böngészőben, majd frissíts.'
      : '⚠️ Nem sikerült a helymeghatározás. Próbáld újra.';
    const last = storage.getLastZone();
    if (last) applyZone({ feature: { properties: last }, distance: 0 }, true);
    return;
  }

  const result = findZone(lastPosition.lat, lastPosition.lng, features);
  status.classList.add('d-none');

  if (!result || result.distance > NEARBY_MAX_METERS) {
    $('zone-free').classList.remove('d-none');
    currentZone = null;
    updateStartButton();
    return;
  }
  applyZone(result, false);
}

function applyZone(result, fromCache) {
  currentZone = result;
  const p = result.feature.properties;
  $('geo-status').classList.add('d-none');
  $('zone-info').classList.remove('d-none');
  $('zone-code').textContent = p.zone;
  $('zone-district').textContent = p.district || '';
  $('zone-price').textContent = p.price ? `${p.price} Ft/óra` : '–';
  $('zone-hours').textContent = p.paidFrom && p.paidTo ? `${p.paidFrom}–${p.paidTo}` : '';

  const note = $('zone-nearby-note');
  if (result.manual) {
    note.textContent = '🖐️ Kézzel választott zóna — indítás előtt ellenőrizd a kihelyezett táblát!';
    note.classList.remove('d-none');
  } else if (fromCache) {
    note.textContent = '📌 Utoljára felismert zóna (a pontos helymeghatározás nem sikerült).';
    note.classList.remove('d-none');
  } else if (result.distance > 0) {
    note.textContent = `📍 Nem vagy zónában — a legközelebbi kb. ${result.distance} m-re van. Indítás előtt ellenőrizd a kihelyezett táblát!`;
    note.classList.remove('d-none');
  } else {
    note.classList.add('d-none');
    storage.saveLastZone(p);
  }
  updateStartButton();
}

// ---------- Fo nezet / inditas ----------

function updateStartButton() {
  const plate = normalizePlate($('plate-input').value);
  const ok = currentZone && plate.length >= 5;
  $('btn-start').disabled = !ok;
  const hint = $('start-hint');
  if (ok) {
    hint.classList.add('d-none');
  } else {
    hint.textContent = !currentZone
      ? 'Az indításhoz előbb zónát kell felismerni.'
      : 'Add meg a rendszámot (legalább 5 karakter).';
    hint.classList.remove('d-none');
  }
}

// Mentett rendszamok gombokkent — kattintasra kitoltik a mezot, de kezzel is irhato.
function renderPlateChips() {
  const s = storage.getSettings();
  const chips = $('plate-chips');
  const plates = [s.plate1, s.plate2].filter(Boolean);
  chips.classList.toggle('d-none', plates.length === 0);
  chips.innerHTML = '';
  const current = normalizePlate($('plate-input').value);
  for (const p of plates) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn flex-fill ' + (current === p ? 'btn-primary' : 'btn-outline-primary');
    btn.textContent = `${TYPE_ICONS[getPlateOpts(p).vehicleType] || '🚗'} ${p}`;
    btn.addEventListener('click', () => {
      $('plate-input').value = p;
      renderPlateChips();
      updateStartButton();
    });
    chips.appendChild(btn);
  }
}

const PROVIDER_OPTIONS = [
  ['telekom', 'Telekom'], ['yettel', 'Yettel'], ['one', 'One'], ['nmf', 'NMF'],
];

function renderTimeGroups() {
  const s = storage.getSettings();
  renderOptionGroup('duration-group', 'duration', DURATION_OPTIONS, s.defaultDuration);
  renderOptionGroup('reminder-group', 'reminder', REMINDER_OPTIONS, s.defaultReminder);
}

// Szolgaltato-gombsor a fooldalon: valtas azonnal mentodik (ketkartyasoknak).
function renderProviderGroup() {
  renderOptionGroup('provider-group', 'provider', PROVIDER_OPTIONS,
    storage.getSettings().paymentProvider, () => {
      const s = storage.getSettings();
      s.paymentProvider = document.querySelector('input[name="provider"]:checked').value;
      storage.saveSettings(s);
      $('setting-provider').value = s.paymentProvider;
    });
}

// Elso inditas: a legegyszerubb kerdes — melyik szolgaltatod van?
function maybeShowOnboarding() {
  if (storage.getSettings().onboarded) return;
  const modal = bootstrap.Modal.getOrCreateInstance($('onboarding-modal'));
  document.querySelectorAll('.onboard-provider').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = storage.getSettings();
      s.paymentProvider = btn.dataset.provider;
      s.onboarded = true;
      storage.saveSettings(s);
      $('setting-provider').value = s.paymentProvider;
      renderProviderGroup();
      modal.hide();
    });
  });
  // ha a "segitseg" linkrol jott vissza es meg nem valasztott, kerdezzuk ujra
  $('reg-info-modal').addEventListener('hidden.bs.modal', () => {
    if (!storage.getSettings().onboarded) modal.show();
  });
  modal.show();
}

function initPlateControls() {
  const s = storage.getSettings();
  $('plate-input').value = s.plate1;
  renderTimeGroups();
  renderProviderGroup();
  renderPlateChips();
  $('plate-input').addEventListener('input', () => {
    renderPlateChips();
    updateStartButton();
  });
}

function openSmsAndConfirm(sms, action, question) {
  pendingConfirm = action;
  lastSms = sms;
  $('sms-confirm-question').textContent = question;
  $('sms-confirm-detail').textContent = `Címzett: ${sms.number} · Üzenet: "${sms.body}"`;
  if (TEST_MODE) {
    $('sms-confirm-question').textContent = `🧪 ${question} (tesztmód — az SMS app nem nyílik meg)`;
    bootstrap.Modal.getOrCreateInstance($('sms-confirm-modal')).show();
    return;
  }
  window.location.href = sms.uri;
  // kis keslekedessel, hogy az SMS app atvaltasa ne akadjon ossze a modallal
  setTimeout(() => {
    bootstrap.Modal.getOrCreateInstance($('sms-confirm-modal')).show();
  }, 400);
}

function onStartClicked() {
  if (!currentZone) return;
  const plate = normalizePlate($('plate-input').value);
  const duration = getGroupValue('duration');
  const opts = getPlateOpts(plate);
  if (duration > 0) opts.minutes = duration; // csak mobilvasarlasnal kerul az SMS-be
  const sms = buildStartSms(currentZone.feature.properties, plate, storage.getSettings().paymentProvider, opts);
  openSmsAndConfirm(sms, 'start', 'Elküldted az indító SMS-t?');
}

function onStopClicked() {
  const active = parking.getActive();
  if (!active) return;
  const sms = buildStopSms(active.zoneProps, active.plate, storage.getSettings().paymentProvider);
  openSmsAndConfirm(sms, 'stop', 'Elküldted a leállító SMS-t?');
}

function onSmsConfirmed() {
  if (pendingConfirm === 'start') {
    const plate = normalizePlate($('plate-input').value);
    const duration = getGroupValue('duration');
    const reminder = getGroupValue('reminder');
    const p = parking.startParking(currentZone.feature.properties, plate, duration, reminder);
    if (reminder > 0) notifications.requestPermission();
    notifications.scheduleReminder(p);
    enterActiveView(p);
  } else if (pendingConfirm === 'stop') {
    parking.stopParking();
    notifications.cancelReminder();
    exitActiveView();
  }
  pendingConfirm = null;
}

// ---------- Aktiv parkolas nezet ----------

function enterActiveView(p) {
  $('active-zone').textContent = `${p.zone} zóna`;
  $('active-plate').textContent = p.plate;
  $('active-start').textContent = parking.formatTime(p.startedAt);
  $('active-end').textContent = p.expiresAt ? parking.formatTime(p.expiresAt) : '—';
  tick();
  tickInterval = setInterval(tick, 1000);
  showView('view-active');
}

function exitActiveView() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
  showView('view-home');
  detectZone();
}

function tick() {
  const p = parking.getActive();
  if (!p) { exitActiveView(); return; }
  const cd = $('countdown');
  if (p.expiresAt) {
    const remaining = parking.remainingMs(p);
    cd.textContent = (remaining < 0 ? '−' : '') + parking.formatDuration(remaining);
    cd.classList.toggle('warning', remaining < 10 * 60 * 1000);
  } else {
    // start-stop parkolas: az eltelt idot szamoljuk folfele
    cd.textContent = parking.formatDuration(parking.elapsedMs(p));
    cd.classList.remove('warning');
  }
  $('active-elapsed').textContent = parking.formatDuration(parking.elapsedMs(p));
  $('active-cost').textContent = `${parking.estimateCost(p)} Ft`;
}

// ---------- Offline jelzes ----------

function updateOnlineStatus() {
  $('offline-banner').classList.toggle('d-none', navigator.onLine);
}

// ---------- Indulas ----------

function init() {
  applyDarkMode(storage.getSettings().darkMode);
  initSettingsView();
  initPlateControls();

  $('btn-start').addEventListener('click', onStartClicked);
  $('btn-stop').addEventListener('click', onStopClicked);
  $('sms-confirm-yes').addEventListener('click', onSmsConfirmed);
  $('sms-copy').addEventListener('click', async () => {
    if (!lastSms) return;
    try {
      await navigator.clipboard.writeText(lastSms.body);
      $('sms-copy').textContent = '✓ Másolva';
    } catch {
      $('sms-copy').textContent = '⚠️ Nem sikerült';
    }
    setTimeout(() => { $('sms-copy').textContent = '📋 Üzenet másolása'; }, 2000);
  });
  $('nav-settings').addEventListener('click', () => showView('view-settings'));
  $('nav-map').addEventListener('click', () => showView('view-map'));
  $('btn-open-map').addEventListener('click', () => showView('view-map'));
  $('btn-settings-back').addEventListener('click', () => showView('view-home'));
  $('btn-map-back').addEventListener('click', () => showView('view-home'));

  document.addEventListener('parkeasy:settingschanged', (e) => {
    // a fooldali rendszam es idogombok kovessek a beallitast, ha nincs aktiv parkolas
    if (!parking.getActive()) {
      $('plate-input').value = e.detail.plate1;
      renderTimeGroups();
    }
    renderProviderGroup();
    renderPlateChips();
    updateStartButton();
  });

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // elo parkolas visszaallitasa app-inditaskor
  const active = parking.getActive();
  if (active) {
    notifications.scheduleReminder(active);
    enterActiveView(active);
  } else if (TEST_MODE && !MOCK_POS) {
    // tesztmodban egybol a terkep jon be, ott lehet poziciot valasztani
    showView('view-map');
  } else {
    showView('view-home');
    detectZone();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  maybeShowOnboarding();
}

init();

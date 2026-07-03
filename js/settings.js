// Beallitasok kepernyo: urlap <-> storage szinkron, sotet mod, elozmenyek.

import * as storage from './storage.js';
import { normalizePlate } from './sms.js';
import { formatTime } from './parking.js';

export function applyDarkMode(enabled) {
  document.documentElement.setAttribute('data-bs-theme', enabled ? 'dark' : 'light');
}

// Mobilbarat gombsorok a legordulo helyett.
export const DURATION_OPTIONS = [
  [0, 'Start–stop'], [15, '15 p'], [30, '30 p'], [45, '45 p'],
  [60, '1 óra'], [120, '2 óra'], [180, '3 óra'], [240, '4 óra'],
];
export const REMINDER_OPTIONS = [
  [0, 'Nincs'], [15, '15 p'], [30, '30 p'], [45, '45 p'],
  [60, '1 óra'], [90, '1,5 óra'], [120, '2 óra'], [180, '3 óra'],
];

export function renderOptionGroup(containerId, name, options, selected, onChange) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  for (const [value, label] of options) {
    const input = document.createElement('input');
    input.type = 'radio';
    input.className = 'btn-check';
    input.name = name;
    input.id = `${name}-${value}`;
    input.value = String(value);
    input.checked = value === selected;
    if (onChange) input.addEventListener('change', onChange);
    const lab = document.createElement('label');
    lab.className = 'btn btn-outline-primary btn-sm';
    lab.htmlFor = input.id;
    lab.textContent = label;
    el.append(input, lab);
  }
}

export function getGroupValue(name) {
  return Number(document.querySelector(`input[name="${name}"]:checked`)?.value ?? 0);
}

export function initSettingsView() {
  const s = storage.getSettings();
  document.getElementById('setting-plate1').value = s.plate1;
  document.getElementById('setting-plate1-type').value = s.plate1Type;
  document.getElementById('setting-plate1-country').value = s.plate1Country;
  document.getElementById('setting-plate2').value = s.plate2;
  document.getElementById('setting-plate2-type').value = s.plate2Type;
  document.getElementById('setting-plate2-country').value = s.plate2Country;
  document.getElementById('setting-provider').value = s.paymentProvider;
  document.getElementById('setting-dark').checked = s.darkMode;
  applyDarkMode(s.darkMode);

  const save = () => {
    const settings = {
      plate1: normalizePlate(document.getElementById('setting-plate1').value),
      plate1Type: document.getElementById('setting-plate1-type').value,
      plate1Country: document.getElementById('setting-plate1-country').value.trim().toUpperCase(),
      plate2: normalizePlate(document.getElementById('setting-plate2').value),
      plate2Type: document.getElementById('setting-plate2-type').value,
      plate2Country: document.getElementById('setting-plate2-country').value.trim().toUpperCase(),
      paymentProvider: document.getElementById('setting-provider').value,
      defaultDuration: getGroupValue('setting-duration'),
      defaultReminder: getGroupValue('setting-reminder'),
      darkMode: document.getElementById('setting-dark').checked,
    };
    storage.saveSettings(settings);
    applyDarkMode(settings.darkMode);
    document.dispatchEvent(new CustomEvent('parkeasy:settingschanged', { detail: settings }));
  };

  renderOptionGroup('setting-duration-group', 'setting-duration', DURATION_OPTIONS, s.defaultDuration, save);
  renderOptionGroup('setting-reminder-group', 'setting-reminder', REMINDER_OPTIONS, s.defaultReminder, save);

  for (const id of ['setting-plate1', 'setting-plate1-type', 'setting-plate1-country',
                    'setting-plate2', 'setting-plate2-type', 'setting-plate2-country',
                    'setting-provider', 'setting-dark']) {
    document.getElementById(id).addEventListener('change', save);
  }
}

export function renderHistory() {
  const list = document.getElementById('history-list');
  const history = storage.getHistory();
  if (!history.length) {
    list.innerHTML = '<li class="list-group-item small text-secondary">Még nincs parkolási előzmény.</li>';
    return;
  }
  list.innerHTML = history.map((h) => {
    const date = new Date(h.startedAt).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' });
    return `<li class="list-group-item small d-flex justify-content-between">
      <span>${date} ${formatTime(h.startedAt)}–${formatTime(h.stoppedAt)} · ${h.zone} zóna · ${h.plate}</span>
      <span class="fw-semibold">${h.cost} Ft</span>
    </li>`;
  }).join('');
}

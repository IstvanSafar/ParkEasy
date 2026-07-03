// Parkolas eletciklus: inditas, leallitas, eltelt ido, koltseg, lejarat.

import * as storage from './storage.js';

export function startParking(zoneProps, plate, durationMinutes, reminderMinutes = 0) {
  const now = Date.now();
  const parking = {
    zone: zoneProps.zone,
    district: zoneProps.district || '',
    price: zoneProps.price || 0,
    zoneProps,
    plate,
    startedAt: now,
    // 0 = start-stop parkolas, nincs lejarat
    expiresAt: durationMinutes > 0 ? now + durationMinutes * 60 * 1000 : null,
    // fuggetlen emlekezteto az inditastol szamitva
    remindAt: reminderMinutes > 0 ? now + reminderMinutes * 60 * 1000 : null,
  };
  storage.saveActiveParking(parking);
  return parking;
}

export function stopParking() {
  const parking = storage.getActiveParking();
  if (!parking) return null;
  const stoppedAt = Date.now();
  storage.addHistoryEntry({
    zone: parking.zone,
    plate: parking.plate,
    startedAt: parking.startedAt,
    stoppedAt,
    cost: estimateCost(parking, stoppedAt),
  });
  storage.clearActiveParking();
  return parking;
}

export function getActive() {
  return storage.getActiveParking();
}

export function elapsedMs(parking, now = Date.now()) {
  return Math.max(0, now - parking.startedAt);
}

export function remainingMs(parking, now = Date.now()) {
  return parking.expiresAt - now;
}

// Becsult koltseg: megkezdett orak szama * oradij (a parkolooras gyakorlat).
export function estimateCost(parking, now = Date.now()) {
  const hours = Math.max(1, Math.ceil(elapsedMs(parking, now) / 3600000));
  return hours * (parking.price || 0);
}

export function formatDuration(ms) {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}

// Lejarat elotti ertesites: Notification API, fallback in-app banner.

let timerId = null;

export async function requestPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: 'assets/icons/icon-192.png' });
      return true;
    } catch {
      // nehany mobilbongeszo csak service workeren at engedi
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.ready.then((reg) =>
          reg.showNotification(title, { body, icon: 'assets/icons/icon-192.png' }));
        return true;
      }
    }
  }
  return false;
}

function showBanner(message) {
  const banner = document.getElementById('notify-banner');
  banner.textContent = message;
  banner.classList.remove('d-none');
}

export function hideBanner() {
  document.getElementById('notify-banner').classList.add('d-none');
}

/**
 * Emlekezteto a parkolas inditasatol szamitva (parking.remindAt).
 * Fuggetlen a parkolasi idotol; csak addig el, amig az app nyitva van.
 */
export function scheduleReminder(parking) {
  cancelReminder();
  if (!parking.remindAt) return;
  const delay = parking.remindAt - Date.now();
  if (delay <= 0) return;
  let message;
  if (parking.expiresAt) {
    const left = Math.max(0, Math.round((parking.expiresAt - parking.remindAt) / 60000));
    message = `Emlékeztető: a parkolásod ${left} perc múlva lejár (${parking.zone} zóna, ${parking.plate}).`;
  } else {
    const mins = Math.round((parking.remindAt - parking.startedAt) / 60000);
    message = `Emlékeztető: ${mins} perce fut a parkolásod (${parking.zone} zóna, ${parking.plate}).`;
  }
  timerId = setTimeout(() => {
    const shown = showNotification('ParkEasy — emlékeztető', message);
    showBanner(message);
    if (!shown && document.visibilityState === 'visible') alert(message);
  }, delay);
}

export function cancelReminder() {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  hideBanner();
}

/**
 * firebase-sync.js — Optional real-time sync via Firebase Realtime Database.
 * If Firebase is not configured the app works fully in local/offline mode.
 */

const FirebaseSync = (() => {
  let db = null;
  let courtsRef = null;

  // ── Init ─────────────────────────────────────────────────────
  async function init(configJSON) {
    try {
      const config = typeof configJSON === 'string' ? JSON.parse(configJSON) : configJSON;

      if (!config.databaseURL) {
        throw new Error('Firebase config must include "databaseURL". Enable Realtime Database in your Firebase console.');
      }

      // Dynamically load Firebase SDKs (compat v9 via CDN)
      await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js');

      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      db = firebase.database();
      courtsRef = db.ref('tournament/courts');

      // Listen for remote changes → update local state & re-render
      courtsRef.on('value', snapshot => {
        const data = snapshot.val();
        if (data) {
          State.courts = Object.values(data);
          UI.renderCourts();
          UI.updateTallyBar();
        }
        State.addLog('firebase', 'FIREBASE', 'Real-time sync active — data updated');
        UI.renderLog();
      });

      State.firebaseConnected = true;
      State.addLog('firebase', 'FIREBASE', 'Connected to Firebase Realtime Database');
      UI.renderLog();
      updateBanner(true);
      return true;
    } catch (err) {
      State.addLog('error', 'FIREBASE', `Connection failed: ${err.message}`);
      UI.renderLog();
      throw err;
    }
  }

  // ── Push court update to Firebase ────────────────────────────
  async function pushCourt(court) {
    if (!db || !courtsRef) return;
    try {
      const { history, ...safeData } = court; // strip history to save bandwidth
      await courtsRef.child(String(court.id)).set(safeData);
    } catch (err) {
      State.addLog('error', 'FIREBASE', `Push failed: ${err.message}`);
      UI.renderLog();
    }
  }

  // ── Remove court from Firebase ────────────────────────────────
  async function removeCourt(id) {
    if (!db || !courtsRef) return;
    try {
      await courtsRef.child(String(id)).remove();
    } catch (err) {
      State.addLog('error', 'FIREBASE', `Remove failed: ${err.message}`);
    }
  }

  // ── Reset all Firebase data ───────────────────────────────────
  async function resetAll() {
    if (!db) return;
    try {
      await db.ref('tournament').remove();
    } catch (err) {
      State.addLog('error', 'FIREBASE', `Reset failed: ${err.message}`);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  function updateBanner(connected) {
    const banner = document.getElementById('firebase-banner');
    const text   = document.getElementById('firebase-status-text');
    if (!banner || !text) return;
    if (connected) {
      banner.style.background = 'rgba(74,222,128,0.08)';
      banner.style.borderBottomColor = 'rgba(74,222,128,0.15)';
      text.style.color = '#4ADE80';
      text.innerHTML = '⚡ Firebase connected — scores sync in real time across all devices.';
    }
  }

  function isConnected() { return State.firebaseConnected; }

  return { init, pushCourt, removeCourt, resetAll, isConnected };
})();

// ── Exposed global init handler (called from Setup UI) ─────────
async function initFirebase() {
  const raw = document.getElementById('firebase-config').value.trim();
  if (!raw) { alert('Please paste your Firebase config JSON first.'); return; }
  try {
    await FirebaseSync.init(raw);
    alert('Firebase connected! Scores will now sync across all devices in real time.');
  } catch (err) {
    alert(`Firebase error: ${err.message}\n\nCheck the Agent Log for details.`);
  }
}

/**
 * state.js — Central app state
 * All modules read/write through this shared object.
 */

const State = {
  courts: [],
  leaderboard: [],
  agentLogs: [],
  firebaseConnected: false,
  currentPreview: 'leaderboard',

  // ── Court helpers ──────────────────────────────────────────────
  getCourt(id) {
    return this.courts.find(c => String(c.id) === String(id));
  },

  addCourt(court) {
    this.courts.push(court);
  },

  removeCourt(id) {
    this.courts = this.courts.filter(c => String(c.id) !== String(id));
  },

  // ── Log helpers ────────────────────────────────────────────────
  addLog(type, tag, msg) {
    this.agentLogs.unshift({
      type,
      tag,
      msg,
      time: new Date().toLocaleTimeString()
    });
    if (this.agentLogs.length > 150) this.agentLogs.pop();
  },

  clearLogs() {
    this.agentLogs = [];
  },

  // ── Persistence (localStorage fallback) ───────────────────────
  save() {
    try {
      const payload = {
        courts: this.courts.map(c => {
          // strip non-serialisable history snapshots (keep last 5)
          const { history, ...rest } = c;
          return { ...rest, history: (history || []).slice(-5) };
        })
      };
      localStorage.setItem('shuttlescore_state', JSON.stringify(payload));
    } catch (_) { /* storage not available */ }
  },

  load() {
    try {
      const raw = localStorage.getItem('shuttlescore_state');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.courts) this.courts = data.courts;
    } catch (_) { /* ignore corrupt data */ }
  },

  reset() {
    this.courts = [];
    this.leaderboard = [];
    this.agentLogs = [];
    try { localStorage.removeItem('shuttlescore_state'); } catch (_) {}
  }
};

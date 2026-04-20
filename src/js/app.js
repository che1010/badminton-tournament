/**
 * app.js — Entry point. Initialises all modules and wires up global handlers.
 */

// ── Tab navigation ────────────────────────────────────────────────
function switchTab(name) {
  const names = ['courts', 'leaderboard', 'export', 'log', 'setup'];
  document.querySelectorAll('.nav-tab').forEach((t, i) => {
    t.classList.toggle('active', names[i] === name);
  });
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');

  // Refresh export preview whenever that tab is opened
  if (name === 'export') ExportManager.showPreview(State.currentPreview);
}

// ── Add court ─────────────────────────────────────────────────────
function addCourt() {
  const nameEl  = document.getElementById('court-name');
  const fmtEl   = document.getElementById('court-format');
  const teamAEl = document.getElementById('team-a');
  const teamBEl = document.getElementById('team-b');

  const fmt       = fmtEl.value;
  const isDoubles = fmt === 'Doubles';
  const name      = nameEl.value.trim() || `Court ${State.courts.length + 1}`;
  const teamA     = teamAEl.value.trim() || (isDoubles ? 'Team A' : 'Player A');
  const teamB     = teamBEl.value.trim() || (isDoubles ? 'Team B' : 'Player B');

  if (teamA === teamB) {
    alert('Team A and Team B must have different names.');
    return;
  }

  const court = {
    id:          Date.now(),
    name,
    format:      fmt,
    teamA,
    teamB,
    games:       [{ a: 0, b: 0 }],
    currentGame: 0,
    gamesWonA:   0,
    gamesWonB:   0,
    serving:     'A',
    complete:    false,
    winner:      null,
    startTime:   new Date().toLocaleString(),
    endTime:     null,
    history:     [],
    status:      '',
    agentNote:   ''
  };

  if (isDoubles) {
    court.teamA_p1 = document.getElementById('team-a-p1').value.trim() || 'A-P1';
    court.teamA_p2 = document.getElementById('team-a-p2').value.trim() || 'A-P2';
    court.teamB_p1 = document.getElementById('team-b-p1').value.trim() || 'B-P1';
    court.teamB_p2 = document.getElementById('team-b-p2').value.trim() || 'B-P2';
    ServingAgent.initCourt(court);
  }

  State.addCourt(court);
  State.addLog('scoring', `SCORING/${name}`, `Match created: ${teamA} vs ${teamB} (${fmt})`);
  State.save();

  if (FirebaseSync.isConnected()) FirebaseSync.pushCourt(court);

  // Clear form
  [nameEl, teamAEl, teamBEl].forEach(el => { el.value = ''; });
  ['team-a-p1', 'team-a-p2', 'team-b-p1', 'team-b-p2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  UI.renderCourts();
  UI.renderLog();
  switchTab('courts');
}

// ── Format toggle ──────────────────────────────────────────────────
function onFormatChange(value) {
  const isDoubles = value === 'Doubles';
  document.getElementById('doubles-fields').style.display = isDoubles ? 'block' : 'none';
  document.getElementById('label-team-a').textContent = isDoubles ? 'Team A name' : 'Player A';
  document.getElementById('label-team-b').textContent = isDoubles ? 'Team B name' : 'Player B';
}

// ── Clear log ─────────────────────────────────────────────────────
function clearLog() {
  State.clearLogs();
  UI.renderLog();
}

// ── Reset all ─────────────────────────────────────────────────────
function resetAll() {
  if (!confirm('Reset ALL courts, scores, and match data? This cannot be undone.')) return;
  if (FirebaseSync.isConnected()) FirebaseSync.resetAll();
  State.reset();
  UI.renderCourts();
  UI.renderLeaderboard([]);
  UI.renderLog();
  State.addLog('warn', 'SYSTEM', 'All data reset by administrator');
  UI.renderLog();
}

// ── Keyboard shortcuts ────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const map = { '1': 'courts', '2': 'leaderboard', '3': 'export', '4': 'log', '5': 'setup' };
  if (map[e.key]) switchTab(map[e.key]);
});

// ── Init ──────────────────────────────────────────────────────────
(function init() {
  // Set init time in log
  const el = document.getElementById('init-time');
  if (el) el.textContent = new Date().toLocaleTimeString();

  // Restore state from localStorage
  State.load();

  // Start clock
  UI.startClock();

  // Render initial UI
  UI.renderCourts();
  UI.renderLog();

  // Allow Enter key on setup form inputs
  ['court-name', 'team-a', 'team-b', 'team-a-p1', 'team-a-p2', 'team-b-p1', 'team-b-p2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') addCourt(); });
  });

  console.log('🏸 ShuttleScore loaded. Courts:', State.courts.length);
})();

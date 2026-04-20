/**
 * ui.js — All DOM rendering logic.
 * Keeps rendering cleanly separated from business logic.
 */

const UI = (() => {

  function escHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Court grid ─────────────────────────────────────────────────
  function renderCourts() {
    const grid = document.getElementById('court-grid');
    if (!grid) return;

    if (!State.courts.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏸</div>
          <div class="empty-title">No courts yet</div>
          <div class="empty-sub">Go to Setup to add courts and players</div>
          <button class="btn-primary" style="margin-top:1.5rem;" onclick="switchTab('setup')">Set up a court</button>
        </div>`;
      updateTallyBar();
      return;
    }

    grid.innerHTML = State.courts.map(c => buildCourtCard(c)).join('');
    updateTallyBar();
  }

  function buildCourtCard(c) {
    const gi = Math.min(c.currentGame, c.games.length - 1);
    const g  = c.games[gi] || { a: 0, b: 0 };

    const prevA = c.games.slice(0, c.currentGame).map(gs =>
      `<span class="game-score-chip ${gs.a > gs.b ? 'won' : ''}">${gs.a}</span>`).join('');
    const prevB = c.games.slice(0, c.currentGame).map(gs =>
      `<span class="game-score-chip ${gs.b > gs.a ? 'won' : ''}">${gs.b}</span>`).join('');

    const dots = [0, 1, 2].map(i => {
      if (i < c.currentGame) {
        const cg = c.games[i];
        return `<div class="progress-dot ${cg.a > cg.b ? 'won-a' : 'won-b'}"></div>`;
      }
      if (i === c.currentGame && !c.complete) return `<div class="progress-dot current"></div>`;
      return `<div class="progress-dot"></div>`;
    }).join('');

    if (c.complete) {
      return `
        <div class="court-card complete">
          <div class="card-header">
            <span class="card-court-name">${escHtml(c.name)}</span>
            <span class="format-badge">${c.format}</span>
          </div>
          <div class="matchup-row">
            <div class="team-info">
              <div class="team-name-display">${escHtml(c.teamA)}</div>
              <div class="prev-game-scores">${prevA}</div>
            </div>
            <div class="vs-divider">${c.gamesWonA}–${c.gamesWonB}</div>
            <div class="team-info" style="text-align:right;">
              <div class="team-name-display" style="justify-content:flex-end;">${escHtml(c.teamB)}</div>
              <div class="prev-game-scores" style="justify-content:flex-end;">${prevB}</div>
            </div>
          </div>
          <div class="match-winner-banner">🏆 ${escHtml(c.winner)} wins the match</div>
        </div>`;
    }

    const aLead = g.a > g.b, bLead = g.b > g.a;
    const isAlert = c.status && (c.status.includes('Deuce') || c.status.includes('Setting'));

    // Doubles: player position rows
    let doublesRowA = '', doublesRowB = '', servingBox = '';
    if (c.format === 'Doubles') {
      const aRight = c.teamA_rightPlayer === 'p1' ? c.teamA_p1 : c.teamA_p2;
      const aLeft  = c.teamA_rightPlayer === 'p1' ? c.teamA_p2 : c.teamA_p1;
      const bRight = c.teamB_rightPlayer === 'p1' ? c.teamB_p1 : c.teamB_p2;
      const bLeft  = c.teamB_rightPlayer === 'p1' ? c.teamB_p2 : c.teamB_p1;

      const aRightServing = c.servingPlayer === aRight && c.serving === 'A';
      const aLeftServing  = c.servingPlayer === aLeft  && c.serving === 'A';
      const bRightServing = c.servingPlayer === bRight && c.serving === 'B';
      const bLeftServing  = c.servingPlayer === bLeft  && c.serving === 'B';

      doublesRowA = `
        <div class="doubles-players">
          <span class="player-chip right${aRightServing ? ' serving' : ''}">${escHtml(aRight || 'P1')}</span>
          <span class="player-divider">/</span>
          <span class="player-chip left${aLeftServing ? ' serving' : ''}">${escHtml(aLeft || 'P2')}</span>
        </div>`;

      doublesRowB = `
        <div class="doubles-players" style="justify-content:flex-end;">
          <span class="player-chip right${bRightServing ? ' serving' : ''}">${escHtml(bRight || 'P1')}</span>
          <span class="player-divider">/</span>
          <span class="player-chip left${bLeftServing ? ' serving' : ''}">${escHtml(bLeft || 'P2')}</span>
        </div>`;

      if (c.servingPlayer) {
        servingBox = `
          <div class="serving-box">
            <span class="serving-dot-sm"></span>
            <span class="serving-player-name">${escHtml(c.servingPlayer)}</span>
            <span class="serving-label">serving from</span>
            <span class="serving-side-badge ${c.servingPlayerSide}">${(c.servingPlayerSide || '').toUpperCase()} court</span>
          </div>`;
      }
    }

    return `
      <div class="court-card">
        <div class="card-header">
          <span class="card-court-name">${escHtml(c.name)}</span>
          <span class="format-badge">${c.format}</span>
        </div>
        <div class="matchup-row">
          <div class="team-info">
            <div class="team-name-display">
              ${escHtml(c.teamA)}
              ${c.serving === 'A' ? '<span class="serving-indicator"></span>' : ''}
            </div>
            ${doublesRowA}
            <div class="prev-game-scores">${prevA}</div>
          </div>
          <div class="vs-divider">G${c.currentGame + 1}</div>
          <div class="team-info" style="text-align:right;">
            <div class="team-name-display" style="justify-content:flex-end;">
              ${c.serving === 'B' ? '<span class="serving-indicator"></span>' : ''}
              ${escHtml(c.teamB)}
            </div>
            ${doublesRowB}
            <div class="prev-game-scores" style="justify-content:flex-end;">${prevB}</div>
          </div>
        </div>

        ${servingBox}

        <div class="score-strip">
          <div class="score-side">
            <button class="score-btn" onclick="ScoringAgent.addPoint('${c.id}','A')">+ Point</button>
            <div class="score-number ${aLead ? 'leading' : ''}">${g.a}</div>
          </div>
          <div class="score-sep">–</div>
          <div class="score-side">
            <div class="score-number ${bLead ? 'leading' : ''}">${g.b}</div>
            <button class="score-btn" onclick="ScoringAgent.addPoint('${c.id}','B')">+ Point</button>
          </div>
        </div>

        <div class="game-progress">${dots}</div>
        <div class="card-status ${isAlert ? 'alert' : ''}">${escHtml(c.status)}</div>
        <div class="agent-note-display" id="note-${c.id}">${escHtml(c.agentNote || '')}</div>

        <div class="card-footer">
          <button class="undo-link" onclick="ScoringAgent.undoPoint('${c.id}')">↩ undo last point</button>
        </div>
      </div>`;
  }

  function updateTallyBar() {
    const bar = document.getElementById('tally-bar');
    if (!bar) return;
    bar.style.display = State.courts.length ? 'block' : 'none';
  }

  // ── Leaderboard ────────────────────────────────────────────────
  function renderLeaderboard(lb) {
    const el = document.getElementById('lb-content');
    if (!el) return;

    if (!lb || !lb.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏆</div>
          <div class="empty-title">No standings yet</div>
          <div class="empty-sub">Complete some matches and run the Tally Agent</div>
        </div>`;
      return;
    }

    const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const statusClass = s => {
      if (!s) return 'status-active';
      const sl = s.toLowerCase();
      if (sl.includes('champion')) return 'status-done';
      if (sl.includes('eliminat')) return 'status-out';
      return 'status-active';
    };

    const rows = lb.map((p, i) => `
      <tr>
        <td><span class="rank-num ${rankClass(i)}">${p.rank}</span></td>
        <td><span class="player-name">${escHtml(p.name)}</span></td>
        <td style="color:var(--text-2);">${p.matchesPlayed}</td>
        <td><span class="win-badge">${p.matchWins}</span></td>
        <td><span class="loss-badge">${p.matchLosses}</span></td>
        <td style="color:var(--text-2);">${p.gamesWon}–${p.gamesLost}</td>
        <td style="color:var(--text-2);">${p.gameDiff ?? (p.gamesWon - p.gamesLost)}</td>
        <td><span class="status-badge ${statusClass(p.status)}">${escHtml(p.status || 'Active')}</span></td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="lb-table-wrap">
        <table class="lb-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player / Team</th>
              <th>Played</th>
              <th>Won</th>
              <th>Lost</th>
              <th>Games</th>
              <th>+/−</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="lb-footer">Last updated by Tally Agent · ${new Date().toLocaleTimeString()}</div>`;
  }

  // ── Agent log ──────────────────────────────────────────────────
  function renderLog() {
    const el = document.getElementById('agent-log');
    if (!el) return;
    el.innerHTML = State.agentLogs.map(l => `
      <div class="log-entry ${l.type}">
        <span class="log-tag">[${l.tag}]</span>
        <span class="log-time">${l.time}</span>
        <span>${escHtml(l.msg)}</span>
      </div>`).join('') || '<div class="log-entry system"><span class="log-tag">[SYSTEM]</span> No events yet.</div>';
  }

  // ── Clock ──────────────────────────────────────────────────────
  function startClock() {
    const tick = () => {
      const el = document.getElementById('clock');
      if (el) el.textContent = new Date().toLocaleTimeString();
    };
    tick();
    setInterval(tick, 1000);
  }

  return { renderCourts, renderLeaderboard, renderLog, updateTallyBar, startClock };
})();

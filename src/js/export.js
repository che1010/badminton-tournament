/**
 * export.js — Generates Excel (.xlsx) and CSV reports from match data.
 * Uses SheetJS (loaded via CDN in index.html).
 */

const ExportManager = (() => {

  // ── Data builders ──────────────────────────────────────────────

  function buildLeaderboardRows() {
    if (State.leaderboard.length) {
      return State.leaderboard.map(p => ({
        'Rank':           p.rank,
        'Player / Team':  p.name,
        'Matches Played': p.matchesPlayed,
        'Match Wins':     p.matchWins,
        'Match Losses':   p.matchLosses,
        'Games Won':      p.gamesWon,
        'Games Lost':     p.gamesLost,
        'Game Diff':      p.gameDiff ?? (p.gamesWon - p.gamesLost),
        'Status':         p.status || ''
      }));
    }

    // Fallback: build from courts if tally hasn't been run
    const players = {};
    State.courts.forEach(c => {
      [c.teamA, c.teamB].forEach(name => {
        if (!players[name]) players[name] = { name, mP: 0, mW: 0, mL: 0, gW: 0, gL: 0 };
      });
      if (c.complete) {
        players[c.teamA].mP++; players[c.teamB].mP++;
        players[c.teamA].gW += c.gamesWonA; players[c.teamA].gL += c.gamesWonB;
        players[c.teamB].gW += c.gamesWonB; players[c.teamB].gL += c.gamesWonA;
        if (c.winner === c.teamA) { players[c.teamA].mW++; players[c.teamB].mL++; }
        else { players[c.teamB].mW++; players[c.teamA].mL++; }
      }
    });

    return Object.values(players)
      .sort((a, b) => b.mW - a.mW || (b.gW - b.gL) - (a.gW - a.gL))
      .map((p, i) => ({
        'Rank': i + 1, 'Player / Team': p.name,
        'Matches Played': p.mP, 'Match Wins': p.mW, 'Match Losses': p.mL,
        'Games Won': p.gW, 'Games Lost': p.gL, 'Game Diff': p.gW - p.gL, 'Status': 'Active'
      }));
  }

  function buildMatchRows() {
    return State.courts.map((c, i) => ({
      'Match #':        i + 1,
      'Court':          c.name,
      'Format':         c.format,
      'Team A':         c.teamA,
      'Team B':         c.teamB,
      'Games Won (A)':  c.gamesWonA,
      'Games Won (B)':  c.gamesWonB,
      'Winner':         c.winner || 'In Progress',
      'Status':         c.complete ? 'Complete' : 'In Progress',
      'Start Time':     c.startTime || '',
      'End Time':       c.endTime   || ''
    }));
  }

  function buildGameRows() {
    const rows = [];
    State.courts.forEach((c, mi) => {
      c.games.forEach((g, gi) => {
        // Skip empty games (match not yet reached that game)
        if (gi > c.currentGame && !c.complete) return;
        if (g.a === 0 && g.b === 0 && gi === c.currentGame && !c.complete) return;

        const gameWinner =
          g.a > g.b ? c.teamA :
          g.b > g.a ? c.teamB : 'In Progress';

        rows.push({
          'Match #':      mi + 1,
          'Court':        c.name,
          'Format':       c.format,
          'Game #':       gi + 1,
          'Team A':       c.teamA,
          'Score A':      g.a,
          'Score B':      g.b,
          'Team B':       c.teamB,
          'Game Winner':  gameWinner,
          'Total Points': g.a + g.b,
          'Went to Deuce': (g.a >= 20 && g.b >= 20) ? 'Yes' : 'No',
          'Match Winner': c.winner || 'In Progress'
        });
      });
    });
    return rows;
  }

  // ── Excel export ───────────────────────────────────────────────
  function exportXLSX() {
    if (!State.courts.length) { alert('No match data to export yet.'); return; }
    if (typeof XLSX === 'undefined') { alert('SheetJS library not loaded. Please check your internet connection.'); return; }

    const btn = document.getElementById('xlsx-btn');
    if (btn) { btn.disabled = true; btn.querySelector('strong').textContent = 'Generating…'; }

    try {
      const wb = XLSX.utils.book_new();

      const addSheet = (name, rows, colWidths) => {
        const ws = rows.length
          ? XLSX.utils.json_to_sheet(rows)
          : XLSX.utils.aoa_to_sheet([['No data yet']]);
        if (colWidths) ws['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(wb, ws, name);
      };

      addSheet('Leaderboard', buildLeaderboardRows(), [
        { wch: 6 }, { wch: 24 }, { wch: 15 }, { wch: 12 }, { wch: 13 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 12 }
      ]);

      addSheet('Match Results', buildMatchRows(), [
        { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 22 },
        { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 20 }
      ]);

      addSheet('Game Scores', buildGameRows(), [
        { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 20 },
        { wch: 9 }, { wch: 9 }, { wch: 20 }, { wch: 20 }, { wch: 13 }, { wch: 14 }, { wch: 20 }
      ]);

      const ts = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `shuttlescore-report-${ts}.xlsx`);

      State.addLog('export', 'EXPORT', `Excel exported — ${buildMatchRows().length} matches, ${buildGameRows().length} games`);
      UI.renderLog();
    } catch (err) {
      State.addLog('error', 'EXPORT', `Excel export error: ${err.message}`);
      UI.renderLog();
      alert('Export failed: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.querySelector('strong').textContent = 'Download Excel'; }
    }
  }

  // ── CSV export ─────────────────────────────────────────────────
  function exportCSV() {
    if (!State.courts.length) { alert('No match data to export yet.'); return; }

    try {
      const toCSV = rows => {
        if (!rows.length) return '(no data)';
        const headers = Object.keys(rows[0]).join(',');
        const body = rows.map(r =>
          Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        return headers + '\n' + body;
      };

      const content = [
        '=== LEADERBOARD ===', toCSV(buildLeaderboardRows()),
        '', '=== MATCH RESULTS ===', toCSV(buildMatchRows()),
        '', '=== GAME SCORES ===', toCSV(buildGameRows())
      ].join('\n');

      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `shuttlescore-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      State.addLog('export', 'EXPORT', `CSV exported — ${buildMatchRows().length} matches`);
      UI.renderLog();
    } catch (err) {
      State.addLog('error', 'EXPORT', `CSV error: ${err.message}`);
      UI.renderLog();
    }
  }

  // ── Preview (in-app table) ─────────────────────────────────────
  function showPreview(type) {
    State.currentPreview = type;

    document.querySelectorAll('.sheet-tab').forEach((t, i) => {
      t.classList.toggle('active', ['leaderboard', 'matches', 'games'][i] === type);
    });

    const area = document.getElementById('preview-area');
    if (!area) return;

    const rows =
      type === 'leaderboard' ? buildLeaderboardRows() :
      type === 'matches'     ? buildMatchRows() :
                               buildGameRows();

    if (!rows.length) {
      area.innerHTML = '<div class="preview-more" style="padding:1rem 0;">No data yet — add courts and record scores first.</div>';
      return;
    }

    const headers = Object.keys(rows[0]);
    const hRow = headers.map(h => `<th>${escHtml(h)}</th>`).join('');
    const dRows = rows.slice(0, 12).map(r =>
      `<tr>${Object.values(r).map(v => `<td>${escHtml(v)}</td>`).join('')}</tr>`
    ).join('');
    const more = rows.length > 12
      ? `<div class="preview-more">Showing 12 of ${rows.length} rows — full data in downloaded file.</div>`
      : '';

    area.innerHTML =
      `<table class="preview-table"><thead><tr>${hRow}</tr></thead><tbody>${dRows}</tbody></table>${more}`;
  }

  function escHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { exportXLSX, exportCSV, showPreview };
})();

// ── Global aliases (called from HTML onclick) ──────────────────────
function exportXLSX() { ExportManager.exportXLSX(); }
function exportCSV()  { ExportManager.exportCSV();  }
function showPreview(type) { ExportManager.showPreview(type); }

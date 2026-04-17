/**
 * tally-agent.js
 *
 * Aggregates match results from all courts and uses Claude to produce
 * a ranked leaderboard. Falls back to local calculation if API is unavailable.
 */

const TallyAgent = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL   = 'claude-sonnet-4-20250514';
  const HEADERS = {
    'Content-Type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true'
  };

  // ── Run the tally ──────────────────────────────────────────────
  async function run() {
    if (!State.courts.length) {
      State.addLog('warn', 'TALLY', 'No courts to aggregate');
      UI.renderLog();
      return;
    }

    const btn = document.getElementById('tally-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="tally-icon">⏳</span> Tally Agent Working…'; }

    State.addLog('tally', 'TALLY', `Running — ${State.courts.length} court(s) to aggregate`);
    UI.renderLog();
    switchTab('leaderboard');
    document.getElementById('lb-content').innerHTML =
      '<div style="text-align:center;padding:3rem;color:var(--text-2);font-family:var(--font-display);">🤖 Tally agent working…</div>';

    const matchData = State.courts.map((c, i) => {
      const scores = c.games.map((g, gi) => `G${gi + 1}: ${g.a}–${g.b}`).join(', ');
      return `Match ${i + 1} | Court: ${c.name} | Format: ${c.format} | ` +
             `${c.teamA} vs ${c.teamB} | Games won: ${c.gamesWonA}–${c.gamesWonB} | ` +
             `${c.complete ? 'COMPLETE | Winner: ' + c.winner : 'IN PROGRESS'} | Scores: ${scores}`;
    }).join('\n');

    try {
      const raw = await callAPI(matchData);
      const clean = raw.replace(/```json|```/g, '').trim();
      const lb = JSON.parse(clean);
      State.leaderboard = lb;
      UI.renderLeaderboard(lb);
      State.addLog('tally', 'TALLY', `Leaderboard updated — ${lb.length} entries ranked`);
    } catch (err) {
      // Fallback: compute leaderboard locally
      State.addLog('warn', 'TALLY', `AI tally failed (${err.message}) — using local calculation`);
      const lb = localTally();
      State.leaderboard = lb;
      UI.renderLeaderboard(lb);
      State.addLog('tally', 'TALLY', `Local tally complete — ${lb.length} entries`);
    }

    UI.renderLog();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="tally-icon">🤖</span> Run Tally Agent — Refresh Leaderboard';
    }
  }

  // ── Claude API call ────────────────────────────────────────────
  async function callAPI(matchData) {
    const resp = await fetch(API_URL, {
      method:  'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 1500,
        system:     'You are a tournament tally agent. Return ONLY a valid JSON array. No markdown, no explanation.',
        messages: [{
          role:    'user',
          content: `Produce a tournament leaderboard from these badminton matches.
Rules: 1 match win per completed match. Sort by matchWins desc, then game differential (gamesWon - gamesLost) desc.
Each player/team that has appeared in any match must have an entry.

Match data:
${matchData}

Return ONLY a JSON array in this exact format:
[
  {
    "rank": 1,
    "name": "Team name",
    "matchesPlayed": 1,
    "matchWins": 1,
    "matchLosses": 0,
    "gamesWon": 2,
    "gamesLost": 0,
    "gameDiff": 2,
    "status": "Active"
  }
]

Status values: "Active" (in progress), "Champion", "Eliminated".`
        }]
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  }

  // ── Local fallback tally ───────────────────────────────────────
  function localTally() {
    const players = {};

    State.courts.forEach(court => {
      const { teamA, teamB, gamesWonA, gamesWonB, complete, winner } = court;
      [teamA, teamB].forEach(name => {
        if (!players[name]) {
          players[name] = { name, matchesPlayed: 0, matchWins: 0, matchLosses: 0, gamesWon: 0, gamesLost: 0 };
        }
      });

      if (complete) {
        players[teamA].matchesPlayed++;
        players[teamB].matchesPlayed++;
        players[teamA].gamesWon  += gamesWonA;
        players[teamA].gamesLost += gamesWonB;
        players[teamB].gamesWon  += gamesWonB;
        players[teamB].gamesLost += gamesWonA;

        if (winner === teamA) {
          players[teamA].matchWins++;
          players[teamB].matchLosses++;
        } else {
          players[teamB].matchWins++;
          players[teamA].matchLosses++;
        }
      } else {
        // In-progress: credit games played so far
        players[teamA].matchesPlayed++;
        players[teamB].matchesPlayed++;
        players[teamA].gamesWon  += gamesWonA;
        players[teamA].gamesLost += gamesWonB;
        players[teamB].gamesWon  += gamesWonB;
        players[teamB].gamesLost += gamesWonA;
      }
    });

    return Object.values(players)
      .sort((a, b) => {
        if (b.matchWins !== a.matchWins) return b.matchWins - a.matchWins;
        return (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost);
      })
      .map((p, i) => ({
        rank:           i + 1,
        name:           p.name,
        matchesPlayed:  p.matchesPlayed,
        matchWins:      p.matchWins,
        matchLosses:    p.matchLosses,
        gamesWon:       p.gamesWon,
        gamesLost:      p.gamesLost,
        gameDiff:       p.gamesWon - p.gamesLost,
        status:         p.matchWins > 0 && p.matchLosses === 0 ? 'Champion' :
                        p.matchesPlayed === 0 ? 'Active' : 'Active'
      }));
  }

  return { run };
})();

// ── Global alias ──────────────────────────────────────────────────
function runTallyAgent() { TallyAgent.run(); }

/**
 * serving-agent.js
 *
 * Tracks BWF doubles serving order — which player serves and from which
 * service court (right / left) — and calls Claude for a brief confirmation.
 *
 * BWF rule summary:
 *   - Serving side score even  → server stands in RIGHT service court
 *   - Serving side score odd   → server stands in LEFT service court
 *   - Serving side wins rally  → players swap sides within their team; same player keeps serving
 *   - Receiving side wins rally → service transfers; no position swap for either team
 */

const ServingAgent = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL   = 'claude-sonnet-4-20250514';
  const HEADERS = {
    'Content-Type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true'
  };

  // ── Called once when a doubles court is created ────────────────
  function initCourt(court) {
    if (court.format !== 'Doubles') return;
    court.teamA_rightPlayer = 'p1'; // Player 1 starts on the right by default
    court.teamB_rightPlayer = 'p1';
    _refreshDisplay(court);
  }

  // ── Called after every point scored on a doubles court ─────────
  function update(court, prevServing, scoringTeam, prevGame) {
    if (court.format !== 'Doubles') return;

    if (court.currentGame !== prevGame) {
      // New game started: both teams reset to Player 1 on right
      court.teamA_rightPlayer = 'p1';
      court.teamB_rightPlayer = 'p1';
    } else if (prevServing === scoringTeam) {
      // Same team keeps service: the two partners swap sides
      const key = `team${scoringTeam}_rightPlayer`;
      court[key] = court[key] === 'p1' ? 'p2' : 'p1';
    }
    // Service changed to other team: no position swap for either team

    _refreshDisplay(court);

    const gi    = Math.min(court.currentGame, court.games.length - 1);
    const score = court.games[gi][court.serving === 'A' ? 'a' : 'b'];
    State.addLog(
      'scoring',
      `SERVING/${court.name}`,
      `${court.servingPlayer} serves from ${court.servingPlayerSide.toUpperCase()} service court ` +
      `(score ${score} — ${score % 2 === 0 ? 'even' : 'odd'})`
    );
  }

  // ── Derive and cache serving player + side onto the court ──────
  function _refreshDisplay(court) {
    if (court.format !== 'Doubles') return;
    const gi    = Math.min(court.currentGame, court.games.length - 1);
    const g     = court.games[gi] || { a: 0, b: 0 };
    const t     = court.serving; // 'A' or 'B'
    const score = t === 'A' ? g.a : g.b;
    const rightProp = court[`team${t}_rightPlayer`]; // 'p1' or 'p2'
    const leftProp  = rightProp === 'p1' ? 'p2' : 'p1';
    const serveProp = score % 2 === 0 ? rightProp : leftProp;
    court.servingPlayer     = court[`team${t}_${serveProp}`] || serveProp;
    court.servingPlayerSide = score % 2 === 0 ? 'right' : 'left';
  }

  // ── Claude commentary: confirms serving player + side ──────────
  async function fetchServingCommentary(court) {
    if (court.format !== 'Doubles') return;
    const gi = Math.min(court.currentGame, court.games.length - 1);
    const g  = court.games[gi] || { a: 0, b: 0 };
    const aR = court.teamA_rightPlayer === 'p1' ? 'R' : 'L';
    const aL = court.teamA_rightPlayer === 'p1' ? 'L' : 'R';
    const bR = court.teamB_rightPlayer === 'p1' ? 'R' : 'L';
    const bL = court.teamB_rightPlayer === 'p1' ? 'L' : 'R';
    try {
      const resp = await fetch(API_URL, {
        method:  'POST',
        headers: HEADERS,
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: 60,
          system:     'You are a BWF doubles serving order tracker. Confirm who serves and from which service court in 10 words or fewer. No preamble.',
          messages: [{
            role:    'user',
            content:
              `Court: ${court.name} | Game ${court.currentGame + 1}\n` +
              `Score: ${court.teamA} ${g.a}–${g.b} ${court.teamB}\n` +
              `Serving: ${court.serving === 'A' ? court.teamA : court.teamB}\n` +
              `${court.teamA}: ${court.teamA_p1}(${aR}) / ${court.teamA_p2}(${aL})\n` +
              `${court.teamB}: ${court.teamB_p1}(${bR}) / ${court.teamB_p2}(${bL})\n` +
              `Who serves next and from which service court?`
          }]
        })
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      const note = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      State.addLog('scoring', `SERVING/${court.name}`, `Agent: "${note}"`);
      UI.renderLog();
    } catch (err) {
      State.addLog('error', `SERVING/${court.name}`, `Serving agent error: ${err.message}`);
      UI.renderLog();
    }
  }

  return { initCourt, update, fetchServingCommentary };
})();

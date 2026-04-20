/**
 * scoring-agent.js
 *
 * Responsibilities:
 *  1. Enforce BWF rally-point scoring rules (pure JS — no AI needed for rules)
 *  2. Call Claude API for a brief contextual commentary after each point
 */

const ScoringAgent = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL   = 'claude-sonnet-4-20250514';
  const HEADERS = {
    'Content-Type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true'
  };

  // ── BWF rule evaluation ────────────────────────────────────────
  function evaluateGame(court) {
    const g = court.games[court.currentGame];
    const a = g.a, b = g.b;
    let gameWinner = null;

    // Win by 2, capped at 30
    if ((a >= 21 || b >= 21) && Math.abs(a - b) >= 2) {
      gameWinner = a > b ? 'A' : 'B';
    }
    if (a >= 30 || b >= 30) {
      gameWinner = a > b ? 'A' : 'B';
    }

    // Status message
    if (a === 20 && b === 20) {
      court.status = 'Deuce — win by 2';
    } else if ((a >= 21 || b >= 21) && !gameWinner) {
      court.status = 'Setting — win by 2';
    } else if (gameWinner) {
      court.status = `Game ${court.currentGame + 1} complete`;
    } else {
      court.status = '';
    }

    if (!gameWinner) return;

    // Record game winner
    if (gameWinner === 'A') court.gamesWonA++;
    else court.gamesWonB++;

    State.addLog(
      'scoring',
      `SCORING/${court.name}`,
      `Game ${court.currentGame + 1} won by ${gameWinner === 'A' ? court.teamA : court.teamB} (${a}–${b})`
    );

    // Check match winner (best of 3)
    if (court.gamesWonA === 2 || court.gamesWonB === 2) {
      court.complete  = true;
      court.winner    = court.gamesWonA === 2 ? court.teamA : court.teamB;
      court.endTime   = new Date().toLocaleString();
      court.status    = `Match won by ${court.winner}`;

      State.addLog(
        'tally',
        'TALLY',
        `${court.name} complete — ${court.winner} wins ${court.gamesWonA}–${court.gamesWonB}`
      );
    } else {
      // Start next game
      court.currentGame++;
      court.games.push({ a: 0, b: 0 });
      court.status = `Game ${court.currentGame + 1} begins`;
      State.addLog(
        'scoring',
        `SCORING/${court.name}`,
        `Starting game ${court.currentGame + 1}`
      );
    }
  }

  // ── Add a point ────────────────────────────────────────────────
  function addPoint(courtId, team) {
    const court = State.getCourt(courtId);
    if (!court || court.complete) return;

    // Snapshot for undo
    court.history = court.history || [];
    court.history.push(JSON.parse(JSON.stringify({
      games:              court.games,
      currentGame:        court.currentGame,
      gamesWonA:          court.gamesWonA,
      gamesWonB:          court.gamesWonB,
      serving:            court.serving,
      complete:           court.complete,
      winner:             court.winner,
      status:             court.status,
      teamA_rightPlayer:  court.teamA_rightPlayer,
      teamB_rightPlayer:  court.teamB_rightPlayer,
      servingPlayer:      court.servingPlayer,
      servingPlayerSide:  court.servingPlayerSide
    })));

    const prevServing = court.serving;
    const prevGame    = court.currentGame;

    // Apply point
    court.games[court.currentGame][team === 'A' ? 'a' : 'b']++;
    court.serving = team; // rally point: scorer serves next

    evaluateGame(court);

    // Update doubles serving positions
    if (court.format === 'Doubles') {
      ServingAgent.update(court, prevServing, team, prevGame);
      ServingAgent.fetchServingCommentary(court);
    }

    const g = court.games[Math.min(court.currentGame, court.games.length - 1)];
    State.addLog(
      'scoring',
      `SCORING/${court.name}`,
      `Point → ${team === 'A' ? court.teamA : court.teamB} | ${g.a}–${g.b} (G${court.currentGame + 1})`
    );

    State.save();

    // Sync to Firebase if connected
    if (FirebaseSync.isConnected()) FirebaseSync.pushCourt(court);

    // Re-render
    UI.renderCourts();
    UI.renderLog();

    // AI commentary (non-blocking)
    fetchCommentary(court);
  }

  // ── Undo last point ────────────────────────────────────────────
  function undoPoint(courtId) {
    const court = State.getCourt(courtId);
    if (!court || !court.history || !court.history.length) return;

    const prev = court.history.pop();
    Object.assign(court, prev);
    court.agentNote = '';

    State.addLog('warn', `SCORING/${court.name}`, 'Point undone by recorder');
    State.save();

    if (FirebaseSync.isConnected()) FirebaseSync.pushCourt(court);

    UI.renderCourts();
    UI.renderLog();
  }

  // ── AI commentary via Claude ───────────────────────────────────
  async function fetchCommentary(court) {
    const noteEl = document.getElementById(`note-${court.id}`);
    if (noteEl) noteEl.textContent = 'Agent thinking…';

    const g     = court.games[Math.min(court.currentGame, court.games.length - 1)];
    const games = court.games.map((gm, i) => `G${i + 1}: ${gm.a}–${gm.b}`).join(', ');

    try {
      const resp = await fetch(API_URL, {
        method:  'POST',
        headers: HEADERS,
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: 80,
          system:     'You are a BWF badminton scoring agent. Reply in 12 words or fewer. No preamble.',
          messages: [{
            role: 'user',
            content:
              `Court: ${court.name} | ${court.format} | Game ${court.currentGame + 1}\n` +
              `Score: ${court.teamA} ${g.a}–${g.b} ${court.teamB}\n` +
              `Games: ${court.gamesWonA}–${court.gamesWonB}\n` +
              `Serving: ${court.serving === 'A' ? court.teamA : court.teamB}\n` +
              `History: ${games}\n` +
              `Complete: ${court.complete}${court.winner ? ' | Winner: ' + court.winner : ''}\n` +
              `Give a brief rule reminder or congratulation.`
          }]
        })
      });

      if (!resp.ok) throw new Error(`API ${resp.status}`);

      const data = await resp.json();
      const note = data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      court.agentNote = note;

      const el = document.getElementById(`note-${court.id}`);
      if (el) el.textContent = note;

      State.addLog('scoring', `SCORING/${court.name}`, `Agent: "${note}"`);
      UI.renderLog();
    } catch (err) {
      const el = document.getElementById(`note-${court.id}`);
      if (el) el.textContent = '';
      State.addLog('error', `SCORING/${court.name}`, `Commentary error: ${err.message}`);
      UI.renderLog();
    }
  }

  return { addPoint, undoPoint };
})();

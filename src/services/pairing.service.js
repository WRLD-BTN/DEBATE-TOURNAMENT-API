/**
 * pairing.service.js
 *
 * Generates the next round's room draw from current standings, BP-style:
 * groups teams into "brackets" of 4 by current points (Swiss pairing —
 * teams on similar points face each other), then assigns each team a BP
 * position (OG/OO/CG/CO), avoiding rematches against teams they've
 * already debated whenever a rearrangement makes that possible.
 *
 * Kept pure (no Express/Prisma) for the same reason scoring.service.js is:
 * easy to unit test, and reusable outside an HTTP context.
 */

const POSITIONS = ['OG', 'OO', 'CG', 'CO'];

/**
 * @param {{teamId: string, totalTeamPoints: number, totalSpeakerPts: number}[]} standings
 *   Already sorted descending (as returned by aggregateStandings), one entry per team.
 * @param {Map<string, Set<string>>} history
 *   Map of teamId -> Set of teamIds it has already debated against, across all past rounds.
 * @returns {{rooms: {teams: {teamId:string, position:string}[]}[], warnings: string[]}}
 */
function generateNextRound(standings, history = new Map()) {
  if (standings.length % 4 !== 0) {
    throw new Error(
      `Swiss BP pairing requires a multiple of 4 teams; got ${standings.length}. ` +
        `Consider a bye/swing team if your tournament has a non-multiple-of-4 count.`
    );
  }

  const warnings = [];
  const pool = [...standings]; // ordered by points, already-decided ranking
  const rooms = [];

  // Walk down the standings 4 at a time — the "bracket" — and try to
  // avoid repeat matchups within that bracket by swapping with the next
  // bracket down when a clash is unavoidable otherwise.
  while (pool.length > 0) {
    let bracket = pool.splice(0, 4);

    if (hasRematch(bracket, history)) {
      const fixed = tryResolveRematch(bracket, pool, history);
      if (fixed) {
        bracket = fixed;
      } else {
        warnings.push(
          `Unavoidable rematch in room with teams [${bracket.map((t) => t.teamId).join(', ')}] — ` +
            `no swap with the remaining pool removed the clash.`
        );
      }
    }

    rooms.push({
      teams: assignPositions(bracket),
    });
  }

  return { rooms, warnings };
}

function hasRematch(bracket, history) {
  for (let i = 0; i < bracket.length; i++) {
    for (let j = i + 1; j < bracket.length; j++) {
      if (history.get(bracket[i].teamId)?.has(bracket[j].teamId)) return true;
    }
  }
  return false;
}

// Attempts a single swap between the clashing bracket and the next
// available team in the remaining pool to remove a rematch. Simple
// greedy approach — sufficient for typical university-tournament sizes
// (a handful of rooms), not a full constraint solver.
function tryResolveRematch(bracket, remainingPool, history) {
  for (let i = 0; i < bracket.length; i++) {
    for (let p = 0; p < remainingPool.length; p++) {
      const candidate = [...bracket];
      const swapped = remainingPool[p];
      candidate[i] = swapped;

      if (!hasRematch(candidate, history)) {
        // commit the swap: put the displaced team back into the pool
        // at the position the candidate was pulled from, to keep the
        // pool roughly points-ordered.
        remainingPool[p] = bracket[i];
        return candidate;
      }
    }
  }
  return null; // no swap in the remaining pool resolves it
}

// Assigns OG/OO/CG/CO in bracket order. A real tournament would also
// track each team's position history across rounds and balance who gets
// government vs. opposition over time (a fairness concern debaters care
// about); that's a documented extension, not implemented here to keep
// this function simple and deterministic.
function assignPositions(bracket) {
  return bracket.map((team, idx) => ({
    teamId: team.teamId,
    position: POSITIONS[idx],
  }));
}

/**
 * Builds the teamId -> Set(opponentIds) history map from raw past-round
 * team assignments, so it can be passed into generateNextRound.
 *
 * @param {{roomTeams: string[]}[]} pastRooms - one entry per past room, listing the teamIds that shared it
 */
function buildHistory(pastRooms) {
  const history = new Map();
  for (const room of pastRooms) {
    for (const teamId of room.roomTeams) {
      if (!history.has(teamId)) history.set(teamId, new Set());
      for (const other of room.roomTeams) {
        if (other !== teamId) history.get(teamId).add(other);
      }
    }
  }
  return history;
}

module.exports = { generateNextRound, buildHistory };

/**
 * scoring.service.js
 *
 * Pure functions implementing British Parliamentary (BP) scoring rules.
 * Kept free of Express/Prisma so they're trivial to unit test and reuse
 * (e.g. from a CLI or a future results-projection feature).
 *
 * BP team points per round, based on rank (1st-4th) among the 4 teams
 * in a room:
 *   1st -> 3 points   2nd -> 2 points   3rd -> 1 point   4th -> 0 points
 */

const RANK_TO_POINTS = { 1: 3, 2: 2, 3: 1, 4: 0 };

/**
 * Given an array of { teamId, speakerPts } for the 4 teams in one room,
 * rank them by total speaker points (ties broken by a provided tiebreaker
 * function, defaulting to stable input order) and assign BP team points.
 *
 * @param {{teamId: string, speakerPts: number}[]} teamsInRoom - exactly 4 entries
 * @param {(a, b) => number} [tiebreaker] - optional custom comparator for ties
 * @returns {{teamId: string, speakerPts: number, rank: number, teamPoints: number}[]}
 */
function rankRoom(teamsInRoom, tiebreaker) {
  if (!Array.isArray(teamsInRoom) || teamsInRoom.length !== 4) {
    throw new Error('A BP room must contain exactly 4 teams.');
  }

  const sorted = [...teamsInRoom].sort((a, b) => {
    if (b.speakerPts !== a.speakerPts) return b.speakerPts - a.speakerPts;
    if (tiebreaker) return tiebreaker(a, b);
    return 0; // stable sort preserves original (e.g. draw) order on ties
  });

  return sorted.map((team, idx) => {
    const rank = idx + 1;
    return { ...team, rank, teamPoints: RANK_TO_POINTS[rank] };
  });
}

/**
 * Aggregates a team's results across multiple rounds into tournament
 * standings: total team points, then total speaker points as tiebreaker.
 *
 * @param {{teamId: string, teamPoints: number, speakerPts: number}[]} roundResults
 *   Flat list of one entry per (team, round) the team competed in.
 * @returns {{teamId: string, totalTeamPoints: number, totalSpeakerPts: number, roundsPlayed: number}[]}
 *   Sorted descending by totalTeamPoints, then totalSpeakerPts.
 */
function aggregateStandings(roundResults) {
  const byTeam = new Map();

  for (const r of roundResults) {
    const entry = byTeam.get(r.teamId) || {
      teamId: r.teamId,
      totalTeamPoints: 0,
      totalSpeakerPts: 0,
      roundsPlayed: 0,
    };
    entry.totalTeamPoints += r.teamPoints;
    entry.totalSpeakerPts += r.speakerPts;
    entry.roundsPlayed += 1;
    byTeam.set(r.teamId, entry);
  }

  return [...byTeam.values()].sort((a, b) => {
    if (b.totalTeamPoints !== a.totalTeamPoints) return b.totalTeamPoints - a.totalTeamPoints;
    return b.totalSpeakerPts - a.totalSpeakerPts;
  });
}

/**
 * Determines which teams break (advance to elimination rounds).
 *
 * @param {ReturnType<typeof aggregateStandings>} standings - already sorted
 * @param {number} breakSize - number of teams that advance
 * @returns {{ breaking: typeof standings, cutoff: {totalTeamPoints:number, totalSpeakerPts:number}|null }}
 */
function calculateBreak(standings, breakSize) {
  if (breakSize <= 0) throw new Error('breakSize must be a positive integer.');
  if (standings.length < breakSize) {
    return { breaking: standings, cutoff: null };
  }

  const breaking = standings.slice(0, breakSize);
  const lastIn = breaking[breaking.length - 1];
  const firstOut = standings[breakSize];

  // Flag if there's an exact tie straddling the cutoff line — tournaments
  // typically resolve this manually (e.g. by countback or extra criteria),
  // so we surface it rather than silently picking a side.
  const tiedAtCutoff =
    firstOut &&
    firstOut.totalTeamPoints === lastIn.totalTeamPoints &&
    firstOut.totalSpeakerPts === lastIn.totalSpeakerPts;

  return {
    breaking,
    cutoff: { totalTeamPoints: lastIn.totalTeamPoints, totalSpeakerPts: lastIn.totalSpeakerPts },
    tiedAtCutoff: Boolean(tiedAtCutoff),
  };
}

module.exports = { rankRoom, aggregateStandings, calculateBreak, RANK_TO_POINTS };

const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { aggregateStandings, calculateBreak } = require('../services/scoring.service');
const { generateNextRound, buildHistory } = require('../services/pairing.service');
const { standingsToCsv, standingsToPdf } = require('../services/export.service');

const createTournament = asyncHandler(async (req, res) => {
  const tournament = await prisma.tournament.create({ data: req.body });
  res.status(201).json(tournament);
});

const listTournaments = asyncHandler(async (req, res) => {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: 'desc' },
  });
  res.json(tournaments);
});

const getTournament = asyncHandler(async (req, res) => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: req.params.id },
    include: { teams: true, rounds: { orderBy: { roundNumber: 'asc' } } },
  });
  if (!tournament) throw new ApiError(404, 'Tournament not found.');
  res.json(tournament);
});

// Shared by the JSON standings endpoint and both export endpoints, so
// "how standings are computed" lives in exactly one place.
async function computeStandingsWithNames(tournamentId) {
  const roundTeams = await prisma.roundTeam.findMany({
    where: { round: { tournamentId }, rank: { not: null } },
    select: { teamId: true, teamPoints: true, speakerPts: true },
  });

  if (roundTeams.length === 0) return [];

  const standings = aggregateStandings(roundTeams);

  const teams = await prisma.team.findMany({
    where: { id: { in: standings.map((s) => s.teamId) } },
    select: { id: true, name: true },
  });
  const nameById = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  return standings.map((s) => ({ ...s, teamName: nameById[s.teamId] }));
}

// Computed standings: pulls every RoundTeam result recorded so far for
// this tournament and aggregates via the pure scoring service.
const getStandings = asyncHandler(async (req, res) => {
  const standings = await computeStandingsWithNames(req.params.id);
  if (standings.length === 0) {
    return res.json({ standings: [], message: 'No results recorded yet.' });
  }
  res.json(standings);
});

const exportStandingsCsv = asyncHandler(async (req, res) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
  if (!tournament) throw new ApiError(404, 'Tournament not found.');

  const standings = await computeStandingsWithNames(req.params.id);
  if (standings.length === 0) throw new ApiError(404, 'No results recorded yet for this tournament.');

  const csv = standingsToCsv(standings);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${tournament.name.replace(/[^a-z0-9]/gi, '_')}_standings.csv"`
  );
  res.send(csv);
});

const exportStandingsPdf = asyncHandler(async (req, res) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
  if (!tournament) throw new ApiError(404, 'Tournament not found.');

  const standings = await computeStandingsWithNames(req.params.id);
  if (standings.length === 0) throw new ApiError(404, 'No results recorded yet for this tournament.');

  const pdfBuffer = await standingsToPdf(tournament.name, standings);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${tournament.name.replace(/[^a-z0-9]/gi, '_')}_standings.pdf"`
  );
  res.send(pdfBuffer);
});

const getBreak = asyncHandler(async (req, res) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
  if (!tournament) throw new ApiError(404, 'Tournament not found.');

  const roundTeams = await prisma.roundTeam.findMany({
    where: { round: { tournamentId: req.params.id, isElimination: false }, rank: { not: null } },
    select: { teamId: true, teamPoints: true, speakerPts: true },
  });

  const standings = aggregateStandings(roundTeams);
  const result = calculateBreak(standings, tournament.breakSize);
  res.json(result);
});

// Proposes the next round's room draw from current standings, avoiding
// rematches against teams already faced. Does NOT persist anything —
// returns a proposal the admin can review/adjust before creating the
// actual Round via POST /api/tournaments/:tournamentId/rounds.
const getNextRoundPairings = asyncHandler(async (req, res) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
  if (!tournament) throw new ApiError(404, 'Tournament not found.');

  const [roundTeams, allTeams, pastRounds] = await Promise.all([
    prisma.roundTeam.findMany({
      where: { round: { tournamentId: req.params.id, isElimination: false }, rank: { not: null } },
      select: { teamId: true, teamPoints: true, speakerPts: true },
    }),
    prisma.team.findMany({ where: { tournamentId: req.params.id }, select: { id: true, name: true } }),
    prisma.round.findMany({
      where: { tournamentId: req.params.id },
      include: { teams: { select: { teamId: true } } },
    }),
  ]);

  const nameById = Object.fromEntries(allTeams.map((t) => [t.id, t.name]));
  const history = buildHistory(
    pastRounds.map((r) => ({ roomTeams: r.teams.map((t) => t.teamId) }))
  );

  let standings;
  if (roundTeams.length === 0) {
    // Round 1: no results yet — seed standings in registration order so
    // every team still gets grouped into rooms of 4.
    standings = allTeams.map((t) => ({ teamId: t.id, totalTeamPoints: 0, totalSpeakerPts: 0 }));
  } else {
    standings = aggregateStandings(roundTeams);
    // Teams with zero rounds played (e.g. a late addition) still need a
    // standings entry to be included in the draw.
    const seen = new Set(standings.map((s) => s.teamId));
    for (const t of allTeams) {
      if (!seen.has(t.id)) standings.push({ teamId: t.id, totalTeamPoints: 0, totalSpeakerPts: 0 });
    }
  }

  const { rooms, warnings } = generateNextRound(standings, history);

  res.json({
    rooms: rooms.map((room) => ({
      teams: room.teams.map((t) => ({ ...t, teamName: nameById[t.teamId] })),
    })),
    warnings,
  });
});

module.exports = {
  createTournament,
  listTournaments,
  getTournament,
  getStandings,
  getBreak,
  getNextRoundPairings,
  exportStandingsCsv,
  exportStandingsPdf,
};

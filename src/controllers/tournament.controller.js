const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { aggregateStandings, calculateBreak } = require('../services/scoring.service');

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

// Computed standings: pulls every RoundTeam result recorded so far for
// this tournament and aggregates via the pure scoring service.
const getStandings = asyncHandler(async (req, res) => {
  const roundTeams = await prisma.roundTeam.findMany({
    where: {
      round: { tournamentId: req.params.id },
      rank: { not: null },
    },
    select: { teamId: true, teamPoints: true, speakerPts: true },
  });

  if (roundTeams.length === 0) {
    return res.json({ standings: [], message: 'No results recorded yet.' });
  }

  const standings = aggregateStandings(
    roundTeams.map((rt) => ({
      teamId: rt.teamId,
      teamPoints: rt.teamPoints,
      speakerPts: rt.speakerPts,
    }))
  );

  // Attach team names for a readable response
  const teams = await prisma.team.findMany({
    where: { id: { in: standings.map((s) => s.teamId) } },
    select: { id: true, name: true },
  });
  const nameById = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  res.json(standings.map((s) => ({ ...s, teamName: nameById[s.teamId] })));
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

module.exports = { createTournament, listTournaments, getTournament, getStandings, getBreak };

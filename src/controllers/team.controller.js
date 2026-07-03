const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const createTeam = asyncHandler(async (req, res) => {
  const { tournamentId } = req.params;
  const { name, debaterNames = [] } = req.body;

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new ApiError(404, 'Tournament not found.');

  const team = await prisma.team.create({
    data: {
      name,
      tournamentId,
      debaters: { create: debaterNames.map((n) => ({ name: n })) },
    },
    include: { debaters: true },
  });

  res.status(201).json(team);
});

const listTeams = asyncHandler(async (req, res) => {
  const teams = await prisma.team.findMany({
    where: { tournamentId: req.params.tournamentId },
    include: { debaters: true },
  });
  res.json(teams);
});

module.exports = { createTeam, listTeams };

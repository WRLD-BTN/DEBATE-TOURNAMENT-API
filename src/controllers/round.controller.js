const prisma = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const BP_POSITIONS = ['OG', 'OO', 'CG', 'CO'];

const createRound = asyncHandler(async (req, res) => {
  const { tournamentId } = req.params;
  const { roundNumber, isElimination, motionText, infoSlide, teamAssignments } = req.body;

  // teamAssignments: [{ teamId, position }] — must cover all 4 BP positions exactly once
  const positions = teamAssignments.map((a) => a.position);
  const uniquePositions = new Set(positions);
  if (positions.length !== 4 || uniquePositions.size !== 4 || ![...uniquePositions].every((p) => BP_POSITIONS.includes(p))) {
    throw new ApiError(400, 'teamAssignments must assign exactly one team to each of OG, OO, CG, CO.');
  }

  const round = await prisma.round.create({
    data: {
      tournamentId,
      roundNumber,
      isElimination: Boolean(isElimination),
      motion: motionText ? { create: { text: motionText, infoSlide } } : undefined,
      teams: { create: teamAssignments.map((a) => ({ teamId: a.teamId, position: a.position })) },
    },
    include: { teams: true, motion: true },
  });

  res.status(201).json(round);
});

// Records ballot results for a round: speaker points per team, from which
// rank and BP team points are derived via the scoring service.
const submitBallot = asyncHandler(async (req, res) => {
  const { rankRoom } = require('../services/scoring.service');
  const { roundId } = req.params;
  const { results } = req.body; // [{ teamId, speakerPts }] — exactly 4

  const roundTeams = await prisma.roundTeam.findMany({ where: { roundId } });
  if (roundTeams.length !== 4) throw new ApiError(400, 'Round does not have 4 assigned teams.');

  const ranked = rankRoom(results);

  const updates = await prisma.$transaction(
    ranked.map((r) =>
      prisma.roundTeam.update({
        where: { roundId_teamId: { roundId, teamId: r.teamId } },
        data: { speakerPts: r.speakerPts, rank: r.rank, teamPoints: r.teamPoints },
      })
    )
  );

  res.json(updates);
});

const assignAdjudicator = asyncHandler(async (req, res) => {
  const { roundId } = req.params;
  const { userId, isChair } = req.body;

  const assignment = await prisma.roundAdjudicator.create({
    data: { roundId, userId, isChair: Boolean(isChair) },
  });

  res.status(201).json(assignment);
});

module.exports = { createRound, submitBallot, assignAdjudicator };

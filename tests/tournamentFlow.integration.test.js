/**
 * Full-flow integration test: register an admin, create a tournament,
 * register 4 teams, create a round with BP position assignments, submit
 * a ballot, then confirm standings and the break reflect it correctly.
 *
 * This is the highest-value test in the suite because it proves the
 * pieces work together — routing, auth, validation, Prisma, and the
 * scoring service — not just each in isolation.
 *
 * Requires a reachable DATABASE_URL (see scoring.service.test.js /
 * auth.test.js for the same skip pattern); automatically skipped if
 * one isn't set.
 */
const request = require('supertest');

const hasDb = Boolean(process.env.DATABASE_URL);
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('Full tournament flow', () => {
  let app;
  let prisma;
  let adminToken;
  let tournamentId;
  const teamIds = {};

  beforeAll(async () => {
    app = require('../src/app');
    prisma = require('../src/config/db');

    const admin = await request(app).post('/api/auth/register').send({
      email: '[email protected]',
      password: 'FlowTestPass123',
      name: 'Flow Test Admin',
      role: 'ADMIN',
    });
    adminToken = admin.body.token;
  });

  afterAll(async () => {
    // Clean up everything this test created, in dependency order.
    if (tournamentId) {
      await prisma.tournament.delete({ where: { id: tournamentId } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email: '[email protected]' } });
    await prisma.$disconnect();
  });

  it('creates a tournament', async () => {
    const res = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Integration Test Cup',
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-02T00:00:00.000Z',
        breakSize: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Integration Test Cup');
    tournamentId = res.body.id;
  });

  it('registers 4 teams', async () => {
    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
    for (const name of names) {
      const res = await request(app)
        .post(`/api/tournaments/${tournamentId}/teams`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, debaterNames: [`${name} Speaker 1`, `${name} Speaker 2`] });

      expect(res.status).toBe(201);
      teamIds[name] = res.body.id;
    }
    expect(Object.keys(teamIds)).toHaveLength(4);
  });

  it('rejects a round with fewer than 4 team assignments', async () => {
    const res = await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roundNumber: 1,
        teamAssignments: [{ teamId: teamIds.Alpha, position: 'OG' }],
      });

    expect(res.status).toBe(400); // fails Zod's .length(4) check
  });

  let roundId;

  it('creates a round with all 4 BP positions assigned', async () => {
    const res = await request(app)
      .post(`/api/tournaments/${tournamentId}/rounds`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roundNumber: 1,
        motionText: 'This House Would test its own API.',
        teamAssignments: [
          { teamId: teamIds.Alpha, position: 'OG' },
          { teamId: teamIds.Bravo, position: 'OO' },
          { teamId: teamIds.Charlie, position: 'CG' },
          { teamId: teamIds.Delta, position: 'CO' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.teams).toHaveLength(4);
    roundId = res.body.id;
  });

  it('submits a ballot and derives correct ranks/team points', async () => {
    const res = await request(app)
      .post(`/api/rounds/${roundId}/ballot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        results: [
          { teamId: teamIds.Alpha, speakerPts: 160 }, // expect rank 1, 3 pts
          { teamId: teamIds.Bravo, speakerPts: 150 }, // rank 2, 2 pts
          { teamId: teamIds.Charlie, speakerPts: 145 }, // rank 3, 1 pt
          { teamId: teamIds.Delta, speakerPts: 140 }, // rank 4, 0 pts
        ],
      });

    expect(res.status).toBe(200);
    const byTeam = Object.fromEntries(res.body.map((r) => [r.teamId, r]));
    expect(byTeam[teamIds.Alpha].rank).toBe(1);
    expect(byTeam[teamIds.Alpha].teamPoints).toBe(3);
    expect(byTeam[teamIds.Delta].rank).toBe(4);
    expect(byTeam[teamIds.Delta].teamPoints).toBe(0);
  });

  it('reflects the ballot in computed standings, sorted correctly', async () => {
    const res = await request(app).get(`/api/tournaments/${tournamentId}/standings`);

    expect(res.status).toBe(200);
    expect(res.body[0].teamId).toBe(teamIds.Alpha); // highest team points first
    expect(res.body[0].totalTeamPoints).toBe(3);
    expect(res.body[3].teamId).toBe(teamIds.Delta); // lowest last
  });

  it('computes the break correctly given breakSize=2', async () => {
    const res = await request(app).get(`/api/tournaments/${tournamentId}/break`);

    expect(res.status).toBe(200);
    expect(res.body.breaking).toHaveLength(2);
    expect(res.body.breaking.map((t) => t.teamId)).toEqual([teamIds.Alpha, teamIds.Bravo]);
  });

  it('exports standings as a downloadable CSV', async () => {
    const res = await request(app).get(`/api/tournaments/${tournamentId}/standings/export.csv`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Alpha');
  });

  it('rejects ballot submission from an unauthenticated request', async () => {
    const res = await request(app)
      .post(`/api/rounds/${roundId}/ballot`)
      .send({ results: [] });

    expect(res.status).toBe(401);
  });
});

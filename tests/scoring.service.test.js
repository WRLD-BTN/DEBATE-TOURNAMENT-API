const { rankRoom, aggregateStandings, calculateBreak } = require('../src/services/scoring.service');

describe('rankRoom', () => {
  it('ranks 4 teams by speaker points and assigns correct BP team points', () => {
    const room = [
      { teamId: 'A', speakerPts: 150 },
      { teamId: 'B', speakerPts: 160 },
      { teamId: 'C', speakerPts: 140 },
      { teamId: 'D', speakerPts: 155 },
    ];

    const result = rankRoom(room);
    const byTeam = Object.fromEntries(result.map((r) => [r.teamId, r]));

    expect(byTeam.B.rank).toBe(1);
    expect(byTeam.B.teamPoints).toBe(3);
    expect(byTeam.D.rank).toBe(2);
    expect(byTeam.D.teamPoints).toBe(2);
    expect(byTeam.A.rank).toBe(3);
    expect(byTeam.A.teamPoints).toBe(1);
    expect(byTeam.C.rank).toBe(4);
    expect(byTeam.C.teamPoints).toBe(0);
  });

  it('throws if the room does not have exactly 4 teams', () => {
    expect(() => rankRoom([{ teamId: 'A', speakerPts: 100 }])).toThrow(
      'A BP room must contain exactly 4 teams.'
    );
  });

  it('uses a custom tiebreaker when speaker points are equal', () => {
    const room = [
      { teamId: 'A', speakerPts: 150 },
      { teamId: 'B', speakerPts: 150 },
      { teamId: 'C', speakerPts: 140 },
      { teamId: 'D', speakerPts: 130 },
    ];
    // Tiebreaker: team 'B' always ranks above 'A' on equal points
    const tiebreaker = (a, b) => (a.teamId === 'B' ? -1 : 1);
    const result = rankRoom(room, tiebreaker);
    const byTeam = Object.fromEntries(result.map((r) => [r.teamId, r]));

    expect(byTeam.B.rank).toBe(1);
    expect(byTeam.A.rank).toBe(2);
  });
});

describe('aggregateStandings', () => {
  it('sums team points and speaker points per team across rounds', () => {
    const roundResults = [
      { teamId: 'A', teamPoints: 3, speakerPts: 150 },
      { teamId: 'A', teamPoints: 2, speakerPts: 148 },
      { teamId: 'B', teamPoints: 1, speakerPts: 140 },
      { teamId: 'B', teamPoints: 3, speakerPts: 155 },
    ];

    const standings = aggregateStandings(roundResults);
    const a = standings.find((s) => s.teamId === 'A');
    const b = standings.find((s) => s.teamId === 'B');

    expect(a.totalTeamPoints).toBe(5);
    expect(a.totalSpeakerPts).toBe(298);
    expect(a.roundsPlayed).toBe(2);
    expect(b.totalTeamPoints).toBe(4);
  });

  it('sorts standings descending by team points, then speaker points', () => {
    const roundResults = [
      { teamId: 'A', teamPoints: 4, speakerPts: 300 },
      { teamId: 'B', teamPoints: 4, speakerPts: 310 },
      { teamId: 'C', teamPoints: 6, speakerPts: 250 },
    ];
    const standings = aggregateStandings(roundResults);
    expect(standings.map((s) => s.teamId)).toEqual(['C', 'B', 'A']);
  });
});

describe('calculateBreak', () => {
  const standings = [
    { teamId: 'A', totalTeamPoints: 9, totalSpeakerPts: 450 },
    { teamId: 'B', totalTeamPoints: 8, totalSpeakerPts: 440 },
    { teamId: 'C', totalTeamPoints: 7, totalSpeakerPts: 430 },
    { teamId: 'D', totalTeamPoints: 6, totalSpeakerPts: 420 },
    { teamId: 'E', totalTeamPoints: 5, totalSpeakerPts: 410 },
  ];

  it('returns the top N teams by standings for the given break size', () => {
    const result = calculateBreak(standings, 4);
    expect(result.breaking.map((t) => t.teamId)).toEqual(['A', 'B', 'C', 'D']);
    expect(result.tiedAtCutoff).toBe(false);
  });

  it('flags a tie straddling the cutoff line instead of silently deciding', () => {
    const tiedStandings = [
      { teamId: 'A', totalTeamPoints: 9, totalSpeakerPts: 450 },
      { teamId: 'B', totalTeamPoints: 6, totalSpeakerPts: 420 },
      { teamId: 'C', totalTeamPoints: 6, totalSpeakerPts: 420 }, // tied with B
    ];
    const result = calculateBreak(tiedStandings, 2);
    expect(result.tiedAtCutoff).toBe(true);
  });

  it('returns all teams if fewer teams than the break size are present', () => {
    const result = calculateBreak(standings.slice(0, 2), 4);
    expect(result.breaking).toHaveLength(2);
    expect(result.cutoff).toBeNull();
  });

  it('throws for a non-positive break size', () => {
    expect(() => calculateBreak(standings, 0)).toThrow('breakSize must be a positive integer.');
  });
});

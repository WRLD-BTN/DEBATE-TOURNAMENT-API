const { generateNextRound, buildHistory } = require('../src/services/pairing.service');

const standings = (n) =>
  Array.from({ length: n }, (_, i) => ({
    teamId: `T${i + 1}`,
    totalTeamPoints: n - i, // already "sorted" descending, like real standings
    totalSpeakerPts: 100,
  }));

describe('buildHistory', () => {
  it('records every pairwise opponent from a set of past rooms', () => {
    const history = buildHistory([{ roomTeams: ['T1', 'T2', 'T3', 'T4'] }]);
    expect(history.get('T1').has('T2')).toBe(true);
    expect(history.get('T1').has('T4')).toBe(true);
    expect(history.get('T1').has('T1')).toBe(false); // never itself
  });
});

describe('generateNextRound', () => {
  it('throws if team count is not a multiple of 4', () => {
    expect(() => generateNextRound(standings(6))).toThrow(
      'Swiss BP pairing requires a multiple of 4 teams'
    );
  });

  it('groups every team into a room of exactly 4, assigning all 4 BP positions', () => {
    const result = generateNextRound(standings(8));
    expect(result.rooms).toHaveLength(2);
    for (const room of result.rooms) {
      expect(room.teams).toHaveLength(4);
      const positions = room.teams.map((t) => t.position).sort();
      expect(positions).toEqual(['CG', 'CO', 'OG', 'OO']);
    }
  });

  it('includes every team from standings exactly once across all rooms', () => {
    const result = generateNextRound(standings(12));
    const allTeamIds = result.rooms.flatMap((r) => r.teams.map((t) => t.teamId));
    expect(allTeamIds.sort()).toEqual(standings(12).map((s) => s.teamId).sort());
  });

  it('avoids a rematch when a swap with the remaining pool can resolve it', () => {
    // Only T1 and T2 have previously met (e.g. from separate past rooms,
    // not a full shared room) — a single swap should be enough to
    // separate them without needing to touch T3/T4.
    const history = new Map([
      ['T1', new Set(['T2'])],
      ['T2', new Set(['T1'])],
    ]);
    const result = generateNextRound(standings(8), history);

    const firstRoomIds = result.rooms[0].teams.map((t) => t.teamId);
    const bothTogether = firstRoomIds.includes('T1') && firstRoomIds.includes('T2');
    expect(bothTogether).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it('reports a warning instead of silently pairing when no swap can avoid a rematch', () => {
    // Only 4 teams total, all of whom already played each other — no
    // other team exists to swap in, so a rematch is unavoidable.
    const history = buildHistory([{ roomTeams: ['T1', 'T2', 'T3', 'T4'] }]);
    const result = generateNextRound(standings(4), history);

    expect(result.rooms).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/Unavoidable rematch/);
  });
});

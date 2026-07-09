const { standingsToCsv, standingsToPdf } = require('../src/services/export.service');

const sampleStandings = [
  { teamId: 'a', teamName: 'Team Alpha', totalTeamPoints: 9, totalSpeakerPts: 450, roundsPlayed: 3 },
  { teamId: 'b', teamName: 'Team Bravo', totalTeamPoints: 6, totalSpeakerPts: 430, roundsPlayed: 3 },
];

describe('standingsToCsv', () => {
  it('produces a header row plus one row per team, in standings order', () => {
    const csv = standingsToCsv(sampleStandings);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2 teams
    expect(lines[0]).toBe('"Rank","Team","Team Points","Speaker Points","Rounds Played"');
  });

  it('assigns rank based on array position, not any field on the row', () => {
    const csv = standingsToCsv(sampleStandings);
    const lines = csv.trim().split('\n');
    expect(lines[1]).toContain('Team Alpha');
    expect(lines[1].startsWith('1,')).toBe(true);
    expect(lines[2].startsWith('2,')).toBe(true);
  });
});

describe('standingsToPdf', () => {
  it('produces a valid, non-empty PDF buffer', async () => {
    const buffer = await standingsToPdf('Test Tournament', sampleStandings);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.slice(0, 4).toString()).toBe('%PDF'); // valid PDF file signature
  });
});

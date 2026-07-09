/**
 * export.service.js
 *
 * Turns computed standings into downloadable CSV or PDF documents.
 * Kept separate from the controller so the "how to render a document"
 * concern doesn't bleed into "how to handle an HTTP request."
 */

const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

/**
 * @param {{teamName: string, totalTeamPoints: number, totalSpeakerPts: number, roundsPlayed: number}[]} standings
 * @returns {string} CSV text
 */
function standingsToCsv(standings) {
  const withRank = standings.map((row, i) => ({ rank: i + 1, ...row }));
  const parser = new Parser({
    fields: [
      { label: 'Rank', value: 'rank' },
      { label: 'Team', value: 'teamName' },
      { label: 'Team Points', value: 'totalTeamPoints' },
      { label: 'Speaker Points', value: 'totalSpeakerPts' },
      { label: 'Rounds Played', value: 'roundsPlayed' },
    ],
  });
  return parser.parse(withRank);
}

/**
 * @param {string} tournamentName
 * @param {{teamName: string, totalTeamPoints: number, totalSpeakerPts: number, roundsPlayed: number}[]} standings
 * @returns {Promise<Buffer>} PDF file contents
 */
function standingsToPdf(tournamentName, standings) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(`${tournamentName} — Standings`, { align: 'center' });
    doc.moveDown();

    const colX = { rank: 50, team: 90, points: 300, speaks: 400, rounds: 480 };
    const rowHeight = 22;
    let y = doc.y + 10;

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Rank', colX.rank, y);
    doc.text('Team', colX.team, y);
    doc.text('Pts', colX.points, y);
    doc.text('Speaks', colX.speaks, y);
    doc.text('Rounds', colX.rounds, y);
    y += rowHeight;
    doc.moveTo(50, y - 4).lineTo(545, y - 4).stroke();

    doc.font('Helvetica');
    standings.forEach((row, i) => {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      doc.text(String(i + 1), colX.rank, y);
      doc.text(row.teamName || row.teamId, colX.team, y);
      doc.text(String(row.totalTeamPoints), colX.points, y);
      doc.text(String(row.totalSpeakerPts), colX.speaks, y);
      doc.text(String(row.roundsPlayed ?? '-'), colX.rounds, y);
      y += rowHeight;
    });

    doc.end();
  });
}

module.exports = { standingsToCsv, standingsToPdf };

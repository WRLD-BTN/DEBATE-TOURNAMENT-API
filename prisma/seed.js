const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('AdminPass123', 10);
  const admin = await prisma.user.upsert({
    where: { email: '[email protected]' },
    update: {},
    create: {
      email: '[email protected]',
      name: 'Tournament Admin',
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
    },
  });

  const tournament = await prisma.tournament.create({
    data: {
      name: 'BUSE Easters 2026',
      location: 'Bindura University of Science Education',
      startDate: new Date('2026-04-10'),
      endDate: new Date('2026-04-12'),
      breakSize: 4,
      teams: {
        create: [
          { name: 'Team Alpha', debaters: { create: [{ name: 'Tino M.' }, { name: 'Rue K.' }] } },
          { name: 'Team Bravo', debaters: { create: [{ name: 'Kuda S.' }, { name: 'Nyasha T.' }] } },
          { name: 'Team Charlie', debaters: { create: [{ name: 'Tapiwa R.' }, { name: 'Vimbai C.' }] } },
          { name: 'Team Delta', debaters: { create: [{ name: 'Farai N.' }, { name: 'Chido M.' }] } },
        ],
      },
    },
    include: { teams: true },
  });

  const [alpha, bravo, charlie, delta] = tournament.teams;

  await prisma.round.create({
    data: {
      tournamentId: tournament.id,
      roundNumber: 1,
      motion: { create: { text: 'This House Would abolish standardized testing.' } },
      teams: {
        create: [
          { teamId: alpha.id, position: 'OG', speakerPts: 152, rank: 1, teamPoints: 3 },
          { teamId: bravo.id, position: 'OO', speakerPts: 148, rank: 2, teamPoints: 2 },
          { teamId: charlie.id, position: 'CG', speakerPts: 145, rank: 3, teamPoints: 1 },
          { teamId: delta.id, position: 'CO', speakerPts: 140, rank: 4, teamPoints: 0 },
        ],
      },
    },
  });

  console.log('Seed complete.');
  console.log(`Admin login -> email: ${admin.email}  password: AdminPass123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

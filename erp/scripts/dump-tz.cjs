const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const row = await prisma.setting.findUnique({ where: { key: 'timezone' } });
  console.log('typeof value:', typeof row?.value);
  console.log('value:', JSON.stringify(row?.value));
  await prisma.$disconnect();
})();

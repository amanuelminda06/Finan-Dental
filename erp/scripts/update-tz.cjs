const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  await prisma.setting.upsert({
    where: { key: 'timezone' },
    update: { value: 'Africa/Addis Ababa' },
    create: { key: 'timezone', value: 'Africa/Addis Ababa' },
  });
  console.log('done');
  await prisma.$disconnect();
})();

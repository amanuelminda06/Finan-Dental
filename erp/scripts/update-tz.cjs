const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: process.env.DEFAULT_TENANT_SLUG || 'finan' },
    select: { id: true },
  });
  if (!tenant) throw new Error('default tenant not found');
  await prisma.setting.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'timezone' } },
    update: { value: 'Africa/Addis Ababa' },
    create: { tenantId: tenant.id, key: 'timezone', value: 'Africa/Addis Ababa' },
  });
  console.log('done');
  await prisma.$disconnect();
})();

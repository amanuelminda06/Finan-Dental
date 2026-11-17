const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: process.env.DEFAULT_TENANT_SLUG || 'finan' },
    select: { id: true },
  });
  if (!tenant) throw new Error('default tenant not found');
  const row = await prisma.setting.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key: 'timezone' } },
  });
  console.log('typeof value:', typeof row?.value);
  console.log('value:', JSON.stringify(row?.value));
  await prisma.$disconnect();
})();

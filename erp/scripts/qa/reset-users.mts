import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { readFileSync } from 'node:fs';
import { TRIAL_LOGINS } from '../../src/lib/trial-credentials';

const dotenv = readFileSync('.env', 'utf8');
const val = (k: string): string => {
  const m = dotenv.split('\n').find((l) => l.startsWith(`${k}=`));
  return m ? m.slice(k.length + 1).replace(/^"|"$/g, '') : '';
};

const prisma = new PrismaClient();
const tenantId = (
  await prisma.tenant.findUnique({
    where: { slug: val('DEFAULT_TENANT_SLUG') || 'finan' },
    select: { id: true },
  })
)?.id;
if (!tenantId) throw new Error('default tenant not found');

// Fixed trial logins are role-based, so reset by role — no credential env vars.
for (const login of TRIAL_LOGINS) {
  const passwordHash = await hash(login.password);
  await prisma.user.updateMany({
    where: { tenantId, role: login.role },
    data: {
      passwordHash,
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
      active: true,
    },
  });
  console.log(`reset ${login.shortName} (${login.role}, mustChange=false)`);
}

await prisma.$disconnect();

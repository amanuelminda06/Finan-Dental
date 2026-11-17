import { PrismaClient } from '@prisma/client';
const tables = ['Appointment','Audience','AuditLog','Campaign','CampaignBatch','Feedback','FollowUp','LeaveRequest','MessageDraft','MessageLibraryItem','MessageTask','MessageTemplate','Patient','PatientSickLeave','PatientTag','ReceiptCounter','Sale','SaleLine','Service','ServicePriceHistory','Setting','Shift','ShiftTemplate','SiteContent','Staff','StoredFile','Tag','User'];
const p = new PrismaClient();
const tenant = await p.tenant.findFirst({ select: { id: true } });
if (!tenant) throw new Error('no tenant');
for (const t of tables) {
  const n = await p.$executeRawUnsafe(`UPDATE "${t}" SET "tenantId" = $1 WHERE "tenantId" IS NULL`, tenant.id);
  if (n) console.log(`backfilled ${t}: ${n}`);
}
console.log('tenant:', tenant.id);
await p.$disconnect();

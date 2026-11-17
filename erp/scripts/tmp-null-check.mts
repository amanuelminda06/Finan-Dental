import { PrismaClient } from '@prisma/client';
const tables = ['Appointment','Audience','AuditLog','Campaign','CampaignBatch','Feedback','FollowUp','LeaveRequest','MessageDraft','MessageLibraryItem','MessageTask','MessageTemplate','Patient','PatientSickLeave','PatientTag','ReceiptCounter','Sale','SaleLine','Service','ServicePriceHistory','Setting','Shift','ShiftTemplate','SiteContent','Staff','StoredFile','Tag','User'];
const p = new PrismaClient();
let bad = 0;
for (const t of tables) {
  const rows = await p.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}" WHERE "tenantId" IS NULL`);
  const n = (rows as {n:number}[])[0].n;
  if (n > 0) { console.log('NULL', t, n); bad += n; }
}
console.log(bad === 0 ? 'OK: zero NULL tenantId across all 28 tables' : `ABORT: ${bad} NULL rows`);
await p.$disconnect();

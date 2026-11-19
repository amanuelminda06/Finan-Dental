/**
 * Client data export: dumps all patients and all sales (line-level) to CSV.
 * Runs with the app's own DB access — no PostgreSQL client tools required.
 *
 *   npm run export:client -- [output-dir]
 *
 * Intended as a portable, human-readable copy of the clinic's data (e.g. when
 * handing records back to the client). Includes the doctor-only clinical chart
 * tables so the exported copy is complete.
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

async function main() {
  const outDir = process.argv[2] ?? `exports/${new Date().toISOString().slice(0, 10)}`;
  mkdirSync(outDir, { recursive: true });

  const patients = await prisma.patient.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fullName: true,
      phoneE164: true,
      sex: true,
      birthDate: true,
      preferredLanguage: true,
      doNotMessage: true,
      active: true,
      createdAt: true,
    },
  });
  const patientsCsv = toCsv(
    ['id', 'fullName', 'phone', 'sex', 'birthDate', 'language', 'doNotMessage', 'active', 'createdAt'],
    patients.map((p) => [
      p.id,
      p.fullName,
      p.phoneE164,
      p.sex ?? '',
      p.birthDate ? p.birthDate.toISOString().slice(0, 10) : '',
      p.preferredLanguage,
      p.doNotMessage,
      p.active,
      p.createdAt.toISOString(),
    ]),
  );
  writeFileSync(join(outDir, 'patients.csv'), patientsCsv);

  // Doctor-only clinical chart (free text preserved exactly as stored).
  const [profiles, textItems, teeth, visits, planItems] = await Promise.all([
    prisma.clinicalProfile.findMany({
      orderBy: { patientId: 'asc' },
      select: {
        tenantId: true,
        patientId: true,
        historyNotes: true,
        updatedAt: true,
        patient: { select: { fullName: true } },
      },
    }),
    prisma.clinicalTextItem.findMany({
      orderBy: [{ patientId: 'asc' }, { kind: 'asc' }, { text: 'asc' }],
      select: {
        tenantId: true,
        patientId: true,
        kind: true,
        text: true,
        createdAt: true,
        patient: { select: { fullName: true } },
      },
    }),
    prisma.clinicalTooth.findMany({
      orderBy: [{ patientId: 'asc' }, { toothNumber: 'asc' }],
      select: {
        tenantId: true,
        patientId: true,
        toothNumber: true,
        finding: true,
        findingIsCustom: true,
        note: true,
        surfaces: { select: { surface: true, note: true }, orderBy: { surface: 'asc' } },
        patient: { select: { fullName: true } },
      },
    }),
    prisma.clinicalVisit.findMany({
      orderBy: [{ patientId: 'asc' }, { visitDate: 'asc' }],
      select: {
        tenantId: true,
        patientId: true,
        visitDate: true,
        body: true,
        subjective: true,
        objective: true,
        assessment: true,
        plan: true,
        diagnosis: true,
        materials: true,
        anesthesia: true,
        createdAt: true,
        patient: { select: { fullName: true } },
      },
    }),
    prisma.clinicalPlanItem.findMany({
      orderBy: [{ patientId: 'asc' }, { createdAt: 'asc' }],
      select: {
        tenantId: true,
        patientId: true,
        procedureName: true,
        unitPrice: true,
        toothNumber: true,
        status: true,
        notes: true,
        saleId: true,
        createdAt: true,
        service: { select: { name: true } },
        patient: { select: { fullName: true } },
      },
    }),
  ]);

  writeFileSync(
    join(outDir, 'clinical-history.csv'),
    toCsv(
      ['tenantId', 'patientId', 'patient', 'kind', 'text', 'historyNotes', 'recordedAt'],
      [
        ...profiles.map((row) => [
          row.tenantId,
          row.patientId,
          row.patient.fullName,
          'profileNote',
          '',
          row.historyNotes ?? '',
          row.updatedAt.toISOString(),
        ]),
        ...textItems.map((row) => [
          row.tenantId,
          row.patientId,
          row.patient.fullName,
          row.kind,
          row.text,
          '',
          row.createdAt.toISOString(),
        ]),
      ],
    ),
  );

  writeFileSync(
    join(outDir, 'clinical-teeth.csv'),
    toCsv(
      ['tenantId', 'patientId', 'patient', 'toothNumber', 'finding', 'customFinding', 'toothNote', 'surfaceNotes'],
      teeth.map((row) => [
        row.tenantId,
        row.patientId,
        row.patient.fullName,
        row.toothNumber,
        row.finding ?? '',
        row.findingIsCustom,
        row.note ?? '',
        row.surfaces.map((surface) => `${surface.surface}: ${surface.note ?? ''}`).join('; '),
      ]),
    ),
  );

  writeFileSync(
    join(outDir, 'clinical-visits.csv'),
    toCsv(
      [
        'tenantId',
        'patientId',
        'patient',
        'visitDate',
        'body',
        'subjective',
        'objective',
        'assessment',
        'plan',
        'diagnosis',
        'materials',
        'anesthesia',
        'recordedAt',
      ],
      visits.map((row) => [
        row.tenantId,
        row.patientId,
        row.patient.fullName,
        row.visitDate.toISOString().slice(0, 10),
        row.body ?? '',
        row.subjective ?? '',
        row.objective ?? '',
        row.assessment ?? '',
        row.plan ?? '',
        row.diagnosis ?? '',
        row.materials ?? '',
        row.anesthesia ?? '',
        row.createdAt.toISOString(),
      ]),
    ),
  );

  writeFileSync(
    join(outDir, 'clinical-plan.csv'),
    toCsv(
      [
        'tenantId',
        'patientId',
        'patient',
        'procedureName',
        'catalogService',
        'unitPrice',
        'toothNumber',
        'status',
        'notes',
        'saleId',
        'createdAt',
      ],
      planItems.map((row) => [
        row.tenantId,
        row.patientId,
        row.patient.fullName,
        row.procedureName,
        row.service?.name ?? '',
        row.unitPrice?.toString() ?? '',
        row.toothNumber ?? '',
        row.status,
        row.notes ?? '',
        row.saleId ?? '',
        row.createdAt.toISOString(),
      ]),
    ),
  );

  const sales = await prisma.sale.findMany({
    orderBy: { saleDate: 'asc' },
    select: {
      receiptNumber: true,
      saleDate: true,
      status: true,
      paymentMethod: true,
      total: true,
      patient: { select: { fullName: true, phoneE164: true } },
      doctor: { select: { fullName: true } },
      lines: {
        select: {
          serviceNameSnapshot: true,
          qty: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });
  const salesRows: Array<Array<string | number>> = [];
  for (const sale of sales) {
    if (sale.lines.length === 0) {
      salesRows.push([
        sale.receiptNumber,
        sale.saleDate.toISOString(),
        sale.patient?.fullName ?? '',
        sale.patient?.phoneE164 ?? '',
        sale.doctor?.fullName ?? '',
        sale.status,
        sale.paymentMethod,
        sale.total.toString(),
        '',
        '',
        '',
        '',
      ]);
      continue;
    }
    for (const line of sale.lines) {
      salesRows.push([
        sale.receiptNumber,
        sale.saleDate.toISOString(),
        sale.patient?.fullName ?? '',
        sale.patient?.phoneE164 ?? '',
        sale.doctor?.fullName ?? '',
        sale.status,
        sale.paymentMethod,
        sale.total.toString(),
        line.serviceNameSnapshot,
        line.qty,
        line.unitPrice.toString(),
        line.lineTotal.toString(),
      ]);
    }
  }
  const salesCsv = toCsv(
    [
      'receiptNumber',
      'saleDate',
      'patient',
      'patientPhone',
      'doctor',
      'status',
      'paymentMethod',
      'saleTotal',
      'service',
      'qty',
      'unitPrice',
      'lineTotal',
    ],
    salesRows,
  );
  writeFileSync(join(outDir, 'sales.csv'), salesCsv);

  console.log(
    `✓ exported ${patients.length} patients, ${sales.length} sales and ` +
      `${profiles.length + textItems.length + teeth.length + visits.length + planItems.length} clinical rows to ${outDir}/`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
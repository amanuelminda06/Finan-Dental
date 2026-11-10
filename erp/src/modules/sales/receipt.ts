import type { Prisma } from '@prisma/client';
import { clinicDateKey } from '@/lib/datetime';

/**
 * Gap-free, per-year receipt numbers (`2026-000123`).
 *
 * The counter is claimed with ONE atomic statement:
 *   INSERT … ON CONFLICT ("year") DO UPDATE SET "lastNumber" = … + 1 RETURNING …
 * Postgres takes a row lock for the conflicting row, so concurrent claims
 * serialize and never share a number. Called inside the sale transaction, so a
 * failed sale rolls the counter back too — no gaps.
 */

export const RECEIPT_PAD = 6;

/** `formatReceiptNumber(2026, 123)` → `2026-000123`. */
export function formatReceiptNumber(year: number, value: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid receipt number: ${year}-${value}`);
  }
  return `${year}-${String(value).padStart(RECEIPT_PAD, '0')}`;
}

/** Calendar year of a sale instant in the clinic timezone. */
export function receiptYear(date: Date, timeZone: string): number {
  return Number(clinicDateKey(date, timeZone).slice(0, 4));
}

/**
 * Clamps a claimed counter value so it can never hand out a receipt that
 * already exists.
 *
 * The counter can drift behind reality (restored backups, imports, deleted
 * rows, manual edits). Without this clamp every sale would fail on the
 * `Sale.receiptNumber` unique constraint until someone fixed the row by hand.
 */
export function clampReceiptClaim(claimed: number, highestExisting: number): number {
  const base = Number.isFinite(claimed) && claimed > 0 ? Math.floor(claimed) : 1;
  const existing =
    Number.isFinite(highestExisting) && highestExisting > 0 ? Math.floor(highestExisting) : 0;
  return Math.max(base, existing + 1);
}

/** Highest receipt number already issued for `year` (0 when none). */
async function highestExistingReceiptNumber(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ highest: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("receiptNumber" FROM '^[0-9]+-([0-9]+)$') AS INT)) AS "highest"
    FROM "Sale"
    WHERE "receiptNumber" LIKE ${`${year}-%`}
  `;
  return Number(rows[0]?.highest ?? 0);
}

/** Claims the next integer for `year` (atomic — safe under concurrency). */
export async function claimReceiptNumber(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ lastNumber: number }>>`
    INSERT INTO "ReceiptCounter" ("year", "lastNumber")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastNumber" = "ReceiptCounter"."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  const claimed = Number(rows[0]?.lastNumber ?? 1);
  const highest = await highestExistingReceiptNumber(tx, year);
  const next = clampReceiptClaim(claimed, highest);

  // Repair the drifted counter inside the same transaction, so the next sale
  // continues from here instead of healing again.
  if (next !== claimed) {
    await tx.$executeRaw`UPDATE "ReceiptCounter" SET "lastNumber" = ${next} WHERE "year" = ${year}`;
  }
  return next;
}

/** Claims + formats in one call (inside the sale transaction). */
export async function nextReceiptNumber(
  tx: Prisma.TransactionClient,
  date: Date,
  timeZone: string,
): Promise<string> {
  const year = receiptYear(date, timeZone);
  return formatReceiptNumber(year, await claimReceiptNumber(tx, year));
}

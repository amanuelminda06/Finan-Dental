import { connection, NextResponse } from 'next/server';
import { env } from '@/env';
import { basePrisma } from '@/lib/prisma-base';
import { runWithTenant } from '@/lib/tenant-scope';
import { cronTenantWhere } from '@/lib/tenant-status';
import { runMessageJobs, type JobSummary } from '@/modules/messaging/generate';

/**
 * Scheduled message generation + expiry. Called by an external cron (every 15
 * minutes, plus a nightly run) with `Authorization: Bearer $CRON_SECRET`.
 * Disabled when CRON_SECRET is unset. Safe to call repeatedly (idempotent).
 *
 * The URL tenant is only the carrier for this endpoint: jobs must run for every
 * serving clinic, each inside its own `runWithTenant()` scope so no task,
 * setting or audit row leaks into another tenant.
 */
export async function POST(request: Request) {
  await connection();

  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'disabled' }, { status: 503 });
  }
  const header = request.headers.get('authorization') ?? '';
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const tenants = await basePrisma.tenant.findMany({
    where: cronTenantWhere(now),
    select: { id: true, slug: true },
    orderBy: { slug: 'asc' },
  });

  const results: Array<{ tenant: string; summary: JobSummary }> = [];
  for (const tenant of tenants) {
    const summary = await runWithTenant(tenant.id, () => runMessageJobs(now));
    results.push({ tenant: tenant.slug, summary });
  }

  return NextResponse.json(
    { ok: true, tenants: results.length, results },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

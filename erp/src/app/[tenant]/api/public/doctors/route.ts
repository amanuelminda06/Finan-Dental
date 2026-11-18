import { connection } from 'next/server';
import { getPublicDoctorStatus } from '@/modules/hr';

/**
 * Public, unauthenticated "who is on duty now" feed for the clinic website.
 *
 * The projection is an allow-list (see `buildPublicDoctorStatus`): no phone,
 * email, leave reasons or any internal identifiers ever leave the clinic. The
 * route is not session-gated by `src/proxy.ts` (the proxy only requires a
 * session under `/erp`), but the tenant is still resolved from the URL, and
 * the response is cached for 60 seconds at the HTTP layer.
 */
export async function GET() {
  await connection();
  const doctors = await getPublicDoctorStatus();

  return Response.json(
    { doctors, generatedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    },
  );
}

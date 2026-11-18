import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { getRequestTenantId } from '@/lib/tenant-request';

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** The only storage keys a tenant brand may publish. */
const BRAND_KEY_FIELDS = [
  'logoKey',
  'logoDarkKey',
  'heroKey',
  'heroSecondaryKey',
  'doctorPhotoKey',
] as const;

/**
 * Public, read-only access to a clinic's own brand images.
 *
 * Two independent checks stop cross-tenant reads: the storage key must start
 * with the URL-resolved tenant id, and the exact key must still be referenced
 * by that tenant's TenantBrand row (an old, replaced image is not served).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  await connection();
  const tenantId = await getRequestTenantId();
  if (!tenantId) return new Response(null, { status: 404 });

  const { key } = await params;
  if (key.length !== 2) return new Response(null, { status: 404 });

  let name: string;
  try {
    name = `${decodeURIComponent(key[0])}/${decodeURIComponent(key[1])}`;
  } catch {
    return new Response(null, { status: 404 });
  }
  if (name.split('/')[0] !== tenantId) return new Response(null, { status: 404 });

  const brand = await prisma.tenantBrand.findUnique({
    where: { tenantId },
    select: {
      logoKey: true,
      logoDarkKey: true,
      heroKey: true,
      heroSecondaryKey: true,
      doctorPhotoKey: true,
    },
  });
  if (!brand || !BRAND_KEY_FIELDS.some((field) => brand[field] === name)) {
    return new Response(null, { status: 404 });
  }

  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return new Response(null, { status: 404 });

  const bytes = await storage.get(name);
  if (!bytes) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

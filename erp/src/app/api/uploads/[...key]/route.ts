import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { storage } from '@/lib/storage';

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Serves uploaded files (staff photos) to signed-in users only.
 * The proxy skips /api/* so the session check happens right here.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 404 });

  const { key } = await params;
  // Storage keys are tenant-prefixed: /api/uploads/<tenantId>/<file>.
  if (key.length !== 2 || !session.user.tenantId) return new Response(null, { status: 404 });
  let name: string;
  try {
    name = `${decodeURIComponent(key[0])}/${decodeURIComponent(key[1])}`;
  } catch {
    return new Response(null, { status: 404 });
  }
  if (name.split('/')[0] !== session.user.tenantId) return new Response(null, { status: 404 });
  const ext = name.includes('.') ? (name.split('.').pop()?.toLowerCase() ?? '') : '';
  const contentType = CONTENT_TYPE_BY_EXT[ext];
  if (!contentType) return new Response(null, { status: 404 });

  const data = await storage.get(name);
  if (!data) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

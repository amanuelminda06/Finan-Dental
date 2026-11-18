'use client';

import Image, { type ImageProps } from 'next/image';
import { useTenantHrefIn } from '@/components/tenant-navigation';
import type { TenantArea } from '@/lib/tenant-path';

/**
 * `next/image` with a tenant-resolved `src`. Use for stored site-relative
 * asset paths (`/services/x.png`, `/api/public/.../image`) so they point into
 * the current clinic's URL tree instead of the platform root. Stored assets
 * live in the public tree, so `area` defaults to `public` even in the ERP.
 */
export default function TenantImage({
  src,
  alt,
  area = 'public',
  ...props
}: Omit<ImageProps, 'src' | 'alt'> & { src: string; alt: string; area?: TenantArea }) {
  const resolve = useTenantHrefIn(area);
  return <Image src={resolve(src)} alt={alt} {...props} />;
}

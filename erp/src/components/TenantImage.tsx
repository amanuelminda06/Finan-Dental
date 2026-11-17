'use client';

import Image, { type ImageProps } from 'next/image';
import { useTenantHref } from '@/components/tenant-navigation';

/**
 * `next/image` with a tenant-resolved `src`. Use for stored site-relative
 * asset paths (`/services/x.png`, `/api/public/.../image`) so they point into
 * the current clinic's URL tree instead of the platform root.
 */
export default function TenantImage({
  src,
  alt,
  ...props
}: Omit<ImageProps, 'src' | 'alt'> & { src: string; alt: string }) {
  const resolve = useTenantHref();
  return <Image src={resolve(src)} alt={alt} {...props} />;
}

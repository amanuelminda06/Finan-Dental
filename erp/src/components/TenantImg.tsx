'use client';

import type { ImgHTMLAttributes } from 'react';
import { useTenantHrefIn } from '@/components/tenant-navigation';
import type { TenantArea } from '@/lib/tenant-path';

/**
 * Plain `<img>` with a tenant-resolved `src`, for stored upload URLs rendered
 * in admin forms/tables. Like TenantImage, stored assets default to the
 * public tree (`/services/x.png`) rather than the caller's current area.
 */
export default function TenantImg({
  src,
  alt = '',
  area = 'public',
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string; area?: TenantArea }) {
  const resolve = useTenantHrefIn(area);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolve(src)} alt={alt} {...props} />;
}

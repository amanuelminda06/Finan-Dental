'use client';

/**
 * Client-side URL helpers. Every in-app link/router navigation goes through
 * these wrappers, so a component only ever knows its old root-relative path
 * (`/patients`, `/api/search`, `/about`) while the rendered href carries the
 * tenant and the correct sibling tree.
 */
import Link from 'next/link';
import { useRouter as useNextRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { tenantHref, type TenantArea } from '@/lib/tenant-path';

type TenantNavContextValue = { slug: string; area: TenantArea };

const TenantNavContext = createContext<TenantNavContextValue | null>(null);

export function TenantPathProvider({
  slug,
  area = 'public',
  children,
}: {
  slug: string;
  area?: TenantArea;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ slug, area }), [slug, area]);
  return <TenantNavContext.Provider value={value}>{children}</TenantNavContext.Provider>;
}

function useTenantNav(): TenantNavContextValue {
  const value = useContext(TenantNavContext);
  if (!value) {
    throw new Error('TenantLink/useTenantRouter must be rendered inside TenantPathProvider');
  }
  return value;
}

/** Switch the area for a sibling tree (the ERP and login use `app`). */
export function TenantAreaProvider({
  area,
  children,
}: {
  area: TenantArea;
  children: ReactNode;
}) {
  const { slug } = useTenantNav();
  const value = useMemo(() => ({ slug, area }), [slug, area]);
  return <TenantNavContext.Provider value={value}>{children}</TenantNavContext.Provider>;
}

/** Resolve a root-relative path against the current tenant and area. */
export function useTenantHref(): (href: string) => string {
  const { slug, area } = useTenantNav();
  return useMemo(() => (href: string) => tenantHref(href, slug, area), [slug, area]);
}

type TenantLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

/** Drop-in replacement for `next/link` that tenant-prefixes its href. */
export function TenantLink({ href, ...props }: TenantLinkProps) {
  const resolve = useTenantHref();
  return <Link href={resolve(href)} {...props} />;
}

/** Drop-in replacement for `useRouter()` that tenant-prefixes navigations. */
export function useTenantRouter(): ReturnType<typeof useNextRouter> {
  const router = useNextRouter();
  const resolve = useTenantHref();
  return useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(resolve(href), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(resolve(href), options),
      prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) =>
        router.prefetch(resolve(href), options),
    }),
    [router, resolve],
  );
}

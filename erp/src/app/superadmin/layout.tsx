/** The platform area is tenantless; it deliberately has no tenant chrome. */
export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import { TenantAreaProvider } from '@/components/tenant-navigation';

/** Login is inside the ERP URL tree but outside its authenticated layout. */
export default function ErpLoginLayout({ children }: { children: React.ReactNode }) {
  return <TenantAreaProvider area="erp">{children}</TenantAreaProvider>;
}

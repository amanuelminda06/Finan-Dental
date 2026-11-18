import { TenantAreaProvider } from '@/components/tenant-navigation';

/** Login navigates into the ERP, so its paths resolve in the `app` tree. */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <TenantAreaProvider area="erp">{children}</TenantAreaProvider>;
}

import { notFound } from 'next/navigation';
import { requireSuperadmin } from '@/lib/superadmin-auth';
import TenantEditor from '@/modules/superadmin/components/TenantEditor';
import { getTenantEditData } from '@/modules/superadmin/service';

/** Platform editor for one explicitly addressed tenant. */
export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSuperadmin();
  const { slug } = await params;
  const data = await getTenantEditData(slug);
  if (!data) notFound();
  return <TenantEditor data={data} />;
}

import { redirect } from 'next/navigation';
import { tenantServerHref } from '@/lib/tenant-server-path';

/** Campaigns are created from the same New Message screen. */
export default async function NewCampaignPage() {
  redirect(await tenantServerHref('/messages/new'));
}

import { redirect } from 'next/navigation';

/** Campaigns are created from the same New Message screen. */
export default function NewCampaignPage() {
  redirect('/messages/new');
}

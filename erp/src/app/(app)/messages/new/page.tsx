import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requirePageRole } from '@/lib/require-role';
import { getSettingsMap } from '@/modules/settings';
import { MESSAGE_ROLES, canSendCampaigns } from '@/modules/messaging';
import { listTemplates } from '@/modules/messaging/queries';
import SimpleComposer from '@/modules/messaging/components/SimpleComposer';

export default async function NewMessagePage() {
  const user = await requirePageRole(MESSAGE_ROLES);
  const t = await getTranslations('messages');
  const [settings, templates] = await Promise.all([getSettingsMap(), listTemplates()]);
  const canCreateCampaigns = canSendCampaigns(
    user.role,
    settings.reception_can_send_campaigns === true,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{t('newMessage')}</h1>
        <Link href="/messages" className="btn-secondary">
          {t('backToMessages')}
        </Link>
      </div>
      <SimpleComposer
        templates={templates.map((template) => ({
          id: template.id,
          key: template.key,
          language: template.language,
          body: template.body,
        }))}
        canCreateCampaigns={canCreateCampaigns}
      />
    </div>
  );
}

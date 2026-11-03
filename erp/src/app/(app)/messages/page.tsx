import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requirePageRole } from '@/lib/require-role';
import { getSettingsMap, timezoneFrom } from '@/modules/settings';
import { MESSAGE_ROLES } from '@/modules/messaging';
import { listOutbox } from '@/modules/messaging/queries';
import OutboxBoard from '@/modules/messaging/components/OutboxBoard';
import RunJobsButton from '@/modules/messaging/components/RunJobsButton';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  try {
    const user = await requirePageRole(MESSAGE_ROLES);
    const t = await getTranslations('messages');
    const [settings, groups] = await Promise.all([getSettingsMap(), listOutbox()]);
    const tz = timezoneFrom(settings);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
            <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/messages/new" className="btn-primary">
              {t('newMessageLink')}
            </Link>
            {user.role === 'OWNER' ? <RunJobsButton /> : null}
            <Link href="/messages/templates" className="btn-secondary">
              {t('templatesLink')}
            </Link>
            <Link href="/messages/campaigns" className="btn-secondary">
              {t('campaignsLink')}
            </Link>
          </div>
        </div>

        <OutboxBoard groups={groups} timeZone={tz} />
      </div>
    );
  } catch (error) {
    console.error('Messages page error:', error);
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-slate-900">Messages</h1>
        <p className="mt-2 text-sm text-slate-600">Unable to load messages. Please try again.</p>
      </div>
    );
  }
}

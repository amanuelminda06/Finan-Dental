'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { CampaignBatchRow, CampaignQueueItem } from '../queries';
import { MESSAGE_STATUS_LABEL_KEYS } from '../constants';
import { detectPlatform, groupSmsHref, smsHref, type Platform } from '../provider';
import { sendTaskNowAction, setCampaignBatchStatusAction } from '../actions';

const subscribeToNothing = () => () => {};

type Props = {
  campaignId: string;
  items: CampaignQueueItem[];
  canManage: boolean;
  deliveryMode: 'INDIVIDUAL' | 'GROUP';
  batches: CampaignBatchRow[];
  progress: { sent: number; pending: number; skipped: number; total: number };
};

/**
 * Campaign queue. Each Send is a plain `sms:` link, so the phone's SMS app
 * opens directly; the message is recorded as sent at the same tap.
 */
export default function CampaignQueue({
  campaignId,
  items,
  deliveryMode,
  batches,
  progress,
}: Props) {
  void campaignId;
  const t = useTranslations('messages');
  const router = useRouter();
  const platform = useSyncExternalStore(
    subscribeToNothing,
    () => detectPlatform(navigator.userAgent),
    () => 'android' as Platform,
  );

  const isGroup = deliveryMode === 'GROUP';
  const pending = items.filter((item) => item.status === 'PENDING' || item.status === 'OPENED');
  const pct = progress.total ? Math.round((progress.sent / progress.total) * 100) : 0;

  const markTaskSent = (item: CampaignQueueItem) => {
    const fd = new FormData();
    fd.set('id', item.id);
    void sendTaskNowAction(null, fd).then(() => router.refresh());
  };

  const markBatchSent = (batch: CampaignBatchRow) => {
    const fd = new FormData();
    fd.set('batchId', batch.id);
    fd.set('status', 'SENT');
    void setCampaignBatchStatusAction(null, fd).then(() => router.refresh());
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-2 p-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-slate-600">
          {t('progress', { sent: progress.sent, total: progress.total, skipped: progress.skipped })}
        </p>
      </div>

      {isGroup ? (
        <ul className="card divide-y divide-slate-100">
          {batches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">{t('noBatches')}</li>
          ) : (
            batches.map((batch) => {
              const href = groupSmsHref(batch.phones, batch.message, platform);
              return (
                <li key={batch.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">
                      {t('batchLabel', { number: batch.batchNumber, count: batch.size })}
                    </span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      {batch.status === 'SENT' ? t('statusSent') : t('statusPending')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {batch.sample.map((row) => `${row.fullName} ${row.phoneE164}`).join(' · ')}
                    {batch.size > batch.sample.length
                      ? ` · ${t('sampleOf', { shown: batch.sample.length, total: batch.size })}`
                      : ''}
                  </p>
                  <p className="whitespace-pre-wrap text-xs text-slate-600">{batch.message}</p>
                  {batch.status === 'PENDING' && href ? (
                    <a className="btn-primary" href={href} onClick={() => markBatchSent(batch)}>
                      {t('sendThisBatch')}
                    </a>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {pending.length === 0 && items.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">{t('noMessages')}</li>
          ) : (
            items.map((item) => {
              const href = smsHref(item.patientPhoneE164, item.renderedMessage, platform);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-slate-900">{item.patientName}</span>{' '}
                    <span className="text-xs text-slate-500">{item.patientPhoneE164}</span>
                    <p className="whitespace-pre-wrap text-xs text-slate-600">
                      {item.renderedMessage}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {t(MESSAGE_STATUS_LABEL_KEYS[item.status] as never)}
                  </span>
                  {(item.status === 'PENDING' || item.status === 'OPENED') && href ? (
                    <a className="btn-primary" href={href} onClick={() => markTaskSent(item)}>
                      {t('send')}
                    </a>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      )}

      <p className="text-xs text-slate-500">{t('sendFromClinicPhoneList')}</p>
    </div>
  );
}

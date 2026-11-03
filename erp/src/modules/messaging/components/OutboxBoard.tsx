'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { MessageTaskRow } from '../queries';
import {
  BLOCKED_REASON_LABEL_KEYS,
  MESSAGE_STATUS_LABEL_KEYS,
  type BlockedReason,
} from '../constants';
import { detectPlatform, smsHref, type Platform } from '../provider';
import { sendTaskNowAction } from '../actions';

type Props = {
  groups: {
    dueNow: MessageTaskRow[];
    laterToday: MessageTaskRow[];
    overdue: MessageTaskRow[];
    doneToday: MessageTaskRow[];
    blocked: MessageTaskRow[];
  };
  timeZone: string;
};

/**
 * One simple list of messages. "Send" is a real `sms:` link, so the phone's
 * SMS app opens from the tap itself — no `window.location` after an `await`,
 * which browsers block when the user gesture is gone.
 */
export default function OutboxBoard({ groups, timeZone }: Props) {
  const t = useTranslations('messages');
  const router = useRouter();
  const platform: Platform = typeof navigator !== 'undefined' ? detectPlatform(navigator.userAgent) : 'android';

  const toSend = useMemo(() => {
    try {
      return [...(groups?.overdue || []), ...(groups?.dueNow || []), ...(groups?.laterToday || [])];
    } catch {
      return [];
    }
  }, [groups]);

  const markSent = (task: MessageTaskRow) => {
    try {
      const fd = new FormData();
      fd.set('id', task.id);
      void sendTaskNowAction(null, fd).then(() => router.refresh());
    } catch (e) {
      console.error('markSent error', e);
    }
  };

  const dueLabel = (task: MessageTaskRow) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      }).format(new Date(task.dueAt));
    } catch {
      return '';
    }
  };

  const row = (task: MessageTaskRow, tone: 'send' | 'blocked' | 'done') => {
    try {
      const href = smsHref(task.patientPhoneE164, task.renderedMessage, platform);
      return (
        <li key={task.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{task.patientName}</span>
              <span className="text-xs text-slate-500">{task.patientPhoneE164}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                {t(MESSAGE_STATUS_LABEL_KEYS[task.status] as never)}
              </span>
              {tone === 'send' ? (
                <span className="text-[11px] text-slate-400">
                  {t('due')} {dueLabel(task)}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">
              {task.renderedMessage}
            </p>
            {task.blockedReason ? (
              <p className="mt-0.5 text-xs font-medium text-red-600">
                {t(BLOCKED_REASON_LABEL_KEYS[task.blockedReason as BlockedReason] as never)}
              </p>
            ) : null}
          </div>
          {tone === 'send' && href ? (
            <a className="btn-primary" href={href} onClick={() => markSent(task)}>
              {t('send')}
            </a>
          ) : null}
        </li>
      );
    } catch (e) {
      console.error('row render error', e);
      return null;
    }
  };

  const blockedList = groups?.blocked || [];
  const doneList = groups?.doneToday || [];

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
          {t('toSend')} ({toSend.length})
        </h2>
        {toSend.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">{t('noMessages')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">{toSend.map((task) => row(task, 'send')).filter(Boolean)}</ul>
        )}
      </section>

      {blockedList.length > 0 ? (
        <section className="card">
          <h2 className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            {t('groupBlocked')} ({blockedList.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {blockedList.map((task) => row(task, 'blocked')).filter(Boolean)}
          </ul>
        </section>
      ) : null}

      {doneList.length > 0 ? (
        <section className="card">
          <h2 className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            {t('groupDoneToday')} ({doneList.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {doneList.map((task) => row(task, 'done')).filter(Boolean)}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-slate-500">{t('sendFromClinicPhoneList')}</p>
    </div>
  );
}

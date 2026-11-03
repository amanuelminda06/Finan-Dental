'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ActionResult } from '@/lib/action';
import {
  createCampaignAction,
  findRecipientsAction,
  markMessageSentAction,
  prepareMessageAction,
  searchPatientsAction,
  type PreparedRecipient,
} from '../actions';
import { countSms, scanSensitiveContent } from '../templates';
import { TEMPLATE_LABEL_KEYS } from '../constants';
import type { MessageTemplateKey } from '@prisma/client';
import { detectPlatform, smsHref, type Platform } from '../provider';

type TemplateOption = { id: string; key: string; language: string; body: string };
type Pickable = { id: string; fullName: string; phoneE164: string };
type Range = '' | 'thisMonth' | 'last30' | 'last90' | 'thisYear';

const subscribeToNothing = () => () => {};

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Turns the quick range into the last-visit date window the filter understands. */
function rangeDates(range: Range): { from: string; to: string } {
  const now = new Date();
  const to = isoDate(now);
  if (!range) return { from: '2000-01-01', to };
  if (range === 'thisMonth') return { from: `${to.slice(0, 7)}-01`, to };
  if (range === 'thisYear') return { from: `${to.slice(0, 4)}-01-01`, to };
  const days = range === 'last30' ? 29 : range === 'last90' ? 89 : 0;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { from: days ? isoDate(start) : '', to: days ? to : '' };
}

export default function SimpleComposer({
  templates,
  canCreateCampaigns,
}: {
  templates: TemplateOption[];
  canCreateCampaigns: boolean;
}) {
  const t = useTranslations('messages');
  const tc = useTranslations('common');
  const router = useRouter();

  const platform = useSyncExternalStore(
    subscribeToNothing,
    () => detectPlatform(navigator.userAgent),
    () => 'android' as Platform,
  );
  const [selected, setSelected] = useState<Pickable[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Pickable[]>([]);
  const [searching, setSearching] = useState(false);
  const [range, setRange] = useState<Range>('thisMonth');
  const [addingAll, setAddingAll] = useState(false);
  const [body, setBody] = useState('');
  const [language, setLanguage] = useState('en');
  const [templateId, setTemplateId] = useState('');
  const [prepared, setPrepared] = useState<PreparedRecipient[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [stage, setStage] = useState<'compose' | 'send'>('compose');
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isSelected = useCallback(
    (id: string) => selected.some((patient) => patient.id === id),
    [selected],
  );

  const addPatient = useCallback((patient: Pickable) => {
    setSelected((current) =>
      current.some((row) => row.id === patient.id) ? current : [...current, patient],
    );
  }, []);

  const removePatient = useCallback((id: string) => {
    setSelected((current) => current.filter((row) => row.id !== id));
  }, []);

  const runSearch = useCallback(async () => {
    setSearching(true);
    const fd = new FormData();
    fd.set('query', query);
    const result = await searchPatientsAction(null, fd);
    if (result.ok && result.data) setResults(result.data);
    setSearching(false);
  }, [query]);

  const addAllFiltered = useCallback(async () => {
    setAddingAll(true);
    const dates = rangeDates(range);
    const fd = new FormData();
    fd.set('lastVisitFrom', dates.from);
    fd.set('lastVisitTo', dates.to);
    const result = await findRecipientsAction(null, fd);
    if (result.ok && result.data) {
      setSelected((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...result.data!.filter((row) => !seen.has(row.id))];
      });
    } else if (!result.ok) {
      setError(result.error ?? 'unknownError');
    }
    setAddingAll(false);
  }, [range]);

  const chooseTemplate = useCallback(
    (id: string) => {
      setTemplateId(id);
      const template = templates.find((row) => row.id === id);
      if (!template) return;
      setBody(template.body);
      setLanguage(template.language);
    },
    [templates],
  );

  const smsText = useMemo(() => {
    const check = countSms(body);
    return { ...check, sensitive: scanSensitiveContent(body) };
  }, [body]);

  const eligible = useMemo(() => (prepared ?? []).filter((row) => !row.blockedReason), [prepared]);

  const singleHref =
    eligible.length === 1 ? smsHref(eligible[0].phoneE164, eligible[0].message, platform) : null;

  const errorText = (key: string) => {
    const messageKeys = [
      'messageRequired',
      'messageTooLong',
      'unknownVariable',
      'noPatientsSelected',
      'campaignOverCap',
    ];
    return messageKeys.includes(key) ? t(key as never) : tc(key as never);
  };

  const openSms = (recipient: PreparedRecipient) => {
    const fd = new FormData();
    fd.set('patientId', recipient.patientId);
    fd.set('message', recipient.message);
    // No await before navigation: the tap itself opens the SMS app, and the
    // send is recorded automatically in the background.
    void markMessageSentAction(null, fd).then((result) => {
      if (result.ok) {
        setSentIds((current) => [...new Set([...current, recipient.patientId])]);
        setConfirming(false);
        setStage('send');
      }
      router.refresh();
    });
  };

  const send = async () => {
    setError('');
    if (selected.length === 0) {
      setError('noPatientsSelected');
      return;
    }
    if (!body.trim()) {
      setError('messageRequired');
      return;
    }
    setBusy(true);
    const fd = new FormData();
    for (const patient of selected) fd.append('patientIds', patient.id);
    fd.set('body', body);
    fd.set('language', language);
    const result = await prepareMessageAction(null, fd);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? tc('unknownError'));
      return;
    }
    setPrepared(result.data?.recipients ?? []);
    setSentIds([]);
    setConfirming(true);
  };

  const openCampaign = async (deliveryMode: 'INDIVIDUAL' | 'GROUP') => {
    setBusy(true);
    setError('');
    const fd = new FormData();
    for (const patient of selected) fd.append('handPickedIds', patient.id);
    fd.set('title', '');
    fd.set('templateKey', 'CUSTOM');
    fd.set('customBody', body);
    fd.set('languageMode', 'FIXED');
    fd.set('fixedLanguage', language);
    fd.set('deliveryMode', deliveryMode);
    fd.set('expiresAt', '');
    fd.set('acknowledgedGroupWarning', 'true');
    const result: ActionResult<{ id: string; created: number; batches: number }> =
      await createCampaignAction(null, fd);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? tc('unknownError'));
      return;
    }
    const id = result.data?.id;
    if (id) router.push(`/messages/campaigns/${id}`);
  };

  if (stage === 'send') {
    return (
      <div className="space-y-4">
        <div className="card space-y-2 p-4">
          <h2 className="text-sm font-semibold text-slate-800">{t('sendStep')}</h2>
          <p className="text-xs text-slate-500">{t('sendStepHint')}</p>
        </div>
        <ul className="card divide-y divide-slate-100">
          {(prepared ?? []).map((recipient) => {
            const sent = sentIds.includes(recipient.patientId);
            const href = smsHref(recipient.phoneE164, recipient.message, platform);
            return (
              <li
                key={recipient.patientId}
                className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{recipient.fullName}</span>
                    <span className="text-xs text-slate-500">{recipient.phoneE164}</span>
                    {sent ? (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700">
                        {t('statusSent')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">
                    {recipient.message}
                  </p>
                  {recipient.blockedReason ? (
                    <p className="mt-0.5 text-xs font-medium text-red-600">
                      {recipient.blockedReason === 'doNotMessage'
                        ? t('blockedDoNotMessage')
                        : recipient.blockedReason === 'inactive'
                          ? t('blockedInactive')
                          : t('blockedInvalidPhone')}
                    </p>
                  ) : null}
                </div>
                {recipient.blockedReason || !href ? null : (
                  <a className="btn-primary" href={href} onClick={() => openSms(recipient)}>
                    {t('openSmsApp')}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-slate-500">{t('sentAutomatically')}</p>
        <button type="button" className="btn-secondary" onClick={() => router.push('/messages')}>
          {t('backToMessages')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1 — Recipients */}
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-slate-800">{t('recipientsStep')}</h2>

        <div className="flex flex-wrap gap-2">
          <input
            className="input-field flex-1"
            value={query}
            placeholder={t('searchPlaceholder')}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void runSearch();
              }
            }}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={searching}
            onClick={() => void runSearch()}
          >
            {searching ? tc('loading') : t('searchPatients')}
          </button>
        </div>

        {results.length > 0 ? (
          <ul className="max-h-52 overflow-auto rounded-md border border-slate-100">
            {results.map((patient) => (
              <li key={patient.id} className="flex items-center justify-between px-2 py-1 text-sm">
                <span>
                  {patient.fullName}{' '}
                  <span className="text-xs text-slate-500">{patient.phoneE164}</span>
                </span>
                <button
                  type="button"
                  className={isSelected(patient.id) ? 'btn-secondary' : 'btn-primary'}
                  onClick={() =>
                    isSelected(patient.id) ? removePatient(patient.id) : addPatient(patient)
                  }
                >
                  {isSelected(patient.id) ? t('pickRemove') : t('pickAdd')}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div className="flex-1">
            <label className="text-xs uppercase text-slate-500">{t('filterVisited')}</label>
            <select
              className="input-field"
              value={range}
              onChange={(event) => setRange(event.target.value as Range)}
            >
              <option value="thisMonth">{t('filterThisMonth')}</option>
              <option value="last30">{t('filterLast30')}</option>
              <option value="last90">{t('filterLast90')}</option>
              <option value="thisYear">{t('filterThisYear')}</option>
              <option value="">{t('filterAllTime')}</option>
            </select>
          </div>
          <button
            type="button"
            className="btn-secondary"
            disabled={addingAll}
            onClick={() => void addAllFiltered()}
          >
            {addingAll ? tc('loading') : t('addAllFiltered')}
          </button>
        </div>

        {selected.length > 0 ? (
          <>
            <p className="text-xs text-slate-600">
              {t('handPickedCount', { count: selected.length })}
            </p>
            <ul className="flex flex-wrap gap-1">
              {selected.map((patient) => (
                <li
                  key={patient.id}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                >
                  {patient.fullName}
                  <button
                    type="button"
                    className="ml-1 text-red-500"
                    onClick={() => removePatient(patient.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-slate-500">{t('noPatientsSelected')}</p>
        )}
      </section>

      {/* 2 — Message */}
      <section className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-slate-800">{t('messageStep')}</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase text-slate-500">{t('template')}</label>
            <select
              className="input-field"
              value={templateId}
              onChange={(event) => chooseTemplate(event.target.value)}
            >
              <option value="">{t('writeNewMessage')}</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {t(TEMPLATE_LABEL_KEYS[template.key as MessageTemplateKey] as never)} (
                  {template.language})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">{t('messageLanguage')}</label>
            <select
              className="input-field"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="en">English</option>
              <option value="am">አማርኛ</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase text-slate-500">{t('messageBody')}</label>
          <textarea
            className="input-field min-h-32"
            value={body}
            placeholder={t('messageBody')}
            onChange={(event) => {
              setBody(event.target.value);
              setTemplateId('');
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            {smsText.length} {t('characters')} · {smsText.parts} {t('parts')}
          </p>
          {smsText.sensitive.length > 0 ? (
            <p className="text-xs text-amber-700">
              {t('sensitiveContentWarning', { terms: smsText.sensitive.join(', ') })}
            </p>
          ) : null}
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{errorText(error)}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void send()}>
          {busy ? tc('loading') : t('send')}
        </button>
        <span className="text-xs text-slate-500">{t('sendFromClinicPhone')}</span>
      </div>

      {/* Final confirmation */}
      {confirming && prepared ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">{t('confirmTitle')}</h3>
            <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              {eligible.length === 1 ? eligible[0].message : body}
            </p>
            <p className="text-xs text-slate-500">
              {t('confirmRecipients', { count: eligible.length })}
            </p>
            {prepared.some((row) => row.blockedReason) ? (
              <p className="text-xs text-red-600">
                {t('confirmBlocked', {
                  count: prepared.filter((row) => row.blockedReason).length,
                })}
              </p>
            ) : null}

            {error ? <p className="text-sm text-red-600">{errorText(error)}</p> : null}

            <div className="flex flex-wrap gap-2">
              {eligible.length === 1 && singleHref ? (
                <a className="btn-primary" href={singleHref} onClick={() => openSms(eligible[0])}>
                  {t('openSmsApp')}
                </a>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={eligible.length === 0}
                  onClick={() => {
                    setConfirming(false);
                    setStage('send');
                  }}
                >
                  {t('sendNow')}
                </button>
              )}
              {canCreateCampaigns ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => void openCampaign('INDIVIDUAL')}
                  >
                    {t('sendAsCampaign')}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => void openCampaign('GROUP')}
                  >
                    {t('sendAsGroup')}
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex justify-end">
              <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
                {tc('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

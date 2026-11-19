'use client';

import { useActionState, useEffect, useRef } from 'react';
import { TenantLink as Link, useTenantRouter as useRouter } from '@/components/tenant-navigation';
import { useTranslations } from 'next-intl';
import ActionError from '@/components/ActionError';
import type { ActionResult } from '@/lib/action';
import { formatMoney } from '@/lib/money';
import { PAYMENT_LABEL_KEYS, PAYMENT_METHODS, type PaymentMethodValue } from '@/modules/sales/constants';
import {
  convertClinicalPlanItemAction,
  saveClinicalPlanItemAction,
  updateClinicalPlanStatusAction,
} from '../actions';
import { PLAN_STATUSES, PLAN_STATUS_LABEL_KEYS, TOOTH_NUMBERS, type PlanStatus } from '../constants';

type Service = { id: string; name: string; currentPrice: string | null };
type Suggestion = { id: string; label: string };

export type ClinicalPlanItemData = {
  id: string;
  procedureName: string;
  serviceName: string | null;
  unitPrice: string | null;
  toothNumber: number | null;
  status: PlanStatus;
  notes: string | null;
  saleId: string | null;
};

type Props = {
  patientId: string;
  services: Service[];
  procedureSuggestions: Suggestion[];
  items: ClinicalPlanItemData[];
};

export default function TreatmentPlan({ patientId, services, procedureSuggestions, items }: Props) {
  const t = useTranslations('clinical');
  const tc = useTranslations('common');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const procedureRef = useRef<HTMLInputElement | null>(null);
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(saveClinicalPlanItemAction, null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{t('planTitle')}</h2>
            <p className="mt-1 text-xs text-slate-500">{t('planIntro')}</p>
          </div>
          <Link href={`/clinical/${patientId}/plan/print`} className="btn-secondary">
            {t('printPlan')}
          </Link>
        </div>

        <form ref={formRef} action={formAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="status" value="PLANNED" />

          <div>
            <label className="label text-xs" htmlFor="clinical-plan-service">
              {t('catalogService')}
            </label>
            <select
              id="clinical-plan-service"
              name="serviceId"
              className="input-field text-sm"
              defaultValue=""
              onChange={(event) => {
                const selected = services.find((service) => service.id === event.target.value);
                if (selected && procedureRef.current) procedureRef.current.value = selected.name;
              }}
            >
              <option value="">{t('customProcedure')}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-xs" htmlFor="clinical-plan-procedure">
              {t('procedureName')}
            </label>
            <input
              ref={procedureRef}
              id="clinical-plan-procedure"
              name="procedureName"
              className="input-field text-sm"
              list="clinical-procedure-suggestions"
              maxLength={120}
            />
            <datalist id="clinical-procedure-suggestions">
              {procedureSuggestions.map((suggestion) => (
                <option key={suggestion.id} value={suggestion.label} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="label text-xs" htmlFor="clinical-plan-price">
              {t('manualPrice')}
            </label>
            <input
              id="clinical-plan-price"
              name="manualPrice"
              className="input-field text-sm"
              inputMode="decimal"
              placeholder="0.00"
              maxLength={12}
            />
          </div>

          <div>
            <label className="label text-xs" htmlFor="clinical-plan-tooth">
              {t('toothNumber')}
            </label>
            <select id="clinical-plan-tooth" name="toothNumber" className="input-field text-sm" defaultValue="">
              <option value="">{tc('notSet')}</option>
              {TOOTH_NUMBERS.map((number) => (
                <option key={number} value={number}>
                  {number}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="label text-xs" htmlFor="clinical-plan-notes">
              {t('procedureNotes')}
            </label>
            <textarea
              id="clinical-plan-notes"
              name="notes"
              className="input-field min-h-16"
              rows={2}
              maxLength={4000}
            />
          </div>

          <div className="md:col-span-2">
            <ActionError error={state && !state.ok ? state.error : undefined} />
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? tc('saving') : t('addPlanItem')}
            </button>
          </div>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800">{t('planItems')}</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t('noPlanItems')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {items.map((item) => (
              <PlanItemRow key={item.id} patientId={patientId} item={item} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlanItemRow({ patientId, item }: { patientId: string; item: ClinicalPlanItemData }) {
  const t = useTranslations('clinical');
  const ts = useTranslations('sales');
  const tc = useTranslations('common');
  const router = useRouter();
  const [statusState, statusAction, statusPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateClinicalPlanStatusAction, null);
  const [invoiceState, invoiceAction, invoicePending] = useActionState<
    ActionResult<{ saleId: string; receiptNumber: string }> | null,
    FormData
  >(convertClinicalPlanItemAction, null);

  useEffect(() => {
    if (statusState?.ok || invoiceState?.ok) router.refresh();
  }, [statusState, invoiceState, router]);

  return (
    <li className="space-y-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {item.serviceName ?? item.procedureName}
            {item.serviceName && item.serviceName !== item.procedureName
              ? ` — ${item.procedureName}`
              : ''}
          </p>
          <p className="text-xs text-slate-500">
            {item.toothNumber ? `${t('toothLabel')} ${item.toothNumber} · ` : ''}
            {item.unitPrice ? formatMoney(item.unitPrice) : t('noPrice')}
          </p>
          {item.notes ? <p className="mt-1 text-xs text-slate-600">{item.notes}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {t(PLAN_STATUS_LABEL_KEYS[item.status] as never)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action={statusAction} className="flex items-center gap-2">
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="id" value={item.id} />
          <label className="sr-only" htmlFor={`clinical-status-${item.id}`}>
            {t('status')}
          </label>
          <select
            id={`clinical-status-${item.id}`}
            name="status"
            className="input-field w-auto text-xs"
            defaultValue={item.status}
          >
            {PLAN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(PLAN_STATUS_LABEL_KEYS[status] as never)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary text-xs" disabled={statusPending}>
            {t('statusUpdate')}
          </button>
        </form>

        {item.saleId ? (
          <Link href={`/clinical/receipts/${item.saleId}`} className="btn-secondary text-xs">
            {t('receipt')}
          </Link>
        ) : item.status === 'CANCELLED' ? null : (
          <form action={invoiceAction} className="flex items-center gap-2">
            <input type="hidden" name="patientId" value={patientId} />
            <input type="hidden" name="id" value={item.id} />
            <label className="sr-only" htmlFor={`clinical-payment-${item.id}`}>
              {ts('paymentMethod')}
            </label>
            <select
              id={`clinical-payment-${item.id}`}
              name="paymentMethod"
              className="input-field w-auto text-xs"
              defaultValue="CASH"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {ts(PAYMENT_LABEL_KEYS[method as PaymentMethodValue] as never)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary text-xs" disabled={invoicePending}>
              {invoicePending ? tc('saving') : t('invoice')}
            </button>
          </form>
        )}
      </div>

      <ActionError error={statusState && !statusState.ok ? statusState.error : undefined} />
      <ActionError error={invoiceState && !invoiceState.ok ? invoiceState.error : undefined} />
    </li>
  );
}

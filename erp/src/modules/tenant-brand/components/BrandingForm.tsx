'use client';

import { useActionState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import ActionError from '@/components/ActionError';
import { useTenantRouter as useRouter } from '@/components/tenant-navigation';
import type { ActionResult } from '@/lib/action';
import { saveTenantBrandAction } from '../actions';
import type { TenantBrandData } from '../defaults';
import { BRAND_FORM_LOCALES } from '../schemas';

type Props = { initial: TenantBrandData };

const IMAGE_FIELDS = [
  { name: 'logo', labelKey: 'logo' },
  { name: 'logoDark', labelKey: 'logoDark' },
  { name: 'hero', labelKey: 'hero' },
  { name: 'heroSecondary', labelKey: 'heroSecondary' },
  { name: 'doctorPhoto', labelKey: 'doctorPhoto' },
] as const;

export default function BrandingForm({ initial }: Props) {
  const t = useTranslations('branding');
  const tc = useTranslations('common');
  const tv = useTranslations('validation');
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveTenantBrandAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const timezones = useMemo(() => {
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return [...new Set([initial.timezone, ...zones])];
  }, [initial.timezone]);

  const fields = !state?.ok ? state?.fields : undefined;
  const error = (key: string): string | undefined =>
    fields?.[key] ? tv(fields[key] as never) : undefined;

  const field = (
    name: string,
    labelKey: string,
    value: string,
    options: { type?: string; required?: boolean; rows?: number } = {},
  ) => (
    <div key={name}>
      <label className="label" htmlFor={name}>
        {t(labelKey as never)}
        {options.required ? ' *' : ''}
      </label>
      {options.rows ? (
        <textarea
          className="input-field"
          id={name}
          name={name}
          rows={options.rows}
          defaultValue={value}
          disabled={pending}
          aria-invalid={!!error(name)}
        />
      ) : (
        <input
          className="input-field"
          id={name}
          name={name}
          type={options.type ?? 'text'}
          defaultValue={value}
          disabled={pending}
          required={options.required}
          aria-invalid={!!error(name)}
        />
      )}
      {error(name) ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error(name)}
        </p>
      ) : null}
    </div>
  );

  return (
    <form action={formAction} className="space-y-6" encType="multipart/form-data">
      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('identitySection')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('clinicName', 'clinicName', initial.clinicName, { required: true })}
          {field('shortName', 'shortName', initial.shortName, { required: true })}
          <div className="sm:col-span-2">
            {field('tagline', 'tagline', initial.tagline)}
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="label">{t('locales')} *</legend>
          <div className="flex flex-wrap gap-4">
            {BRAND_FORM_LOCALES.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="locales"
                  value={code}
                  defaultChecked={initial.locales.includes(code)}
                  disabled={pending}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {t(code as never)}
              </label>
            ))}
          </div>
          {error('locales') ? (
            <p role="alert" className="text-xs font-medium text-red-600">
              {error('locales')}
            </p>
          ) : null}
        </fieldset>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('contactSection')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{field('address', 'address', initial.address)}</div>
          {field('phones', 'phones', initial.phones.join(', '))}
          {field('email', 'email', initial.email, { type: 'email' })}
          {field('instagram', 'instagram', initial.socials.instagram)}
          {field('telegram', 'telegram', initial.socials.telegram)}
          {field('tiktok', 'tiktok', initial.socials.tiktok)}
          {field('website', 'website', initial.socials.website)}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('messagingSection')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('smsSenderName', 'smsSenderName', initial.smsSenderName, { required: true })}
          {field('currency', 'currency', initial.currency, { required: true })}
          <div>
            <label className="label" htmlFor="timezone">
              {t('timezone')} *
            </label>
            <select
              className="input-field"
              id="timezone"
              name="timezone"
              defaultValue={initial.timezone}
              disabled={pending}
            >
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('colorsSection')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {field('colorPrimary', 'colorPrimary', initial.colors.primary, { required: true })}
          {field('colorSecondary', 'colorSecondary', initial.colors.secondary, { required: true })}
          {field('colorAccent', 'colorAccent', initial.colors.accent, { required: true })}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('doctorSection')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field('doctorName', 'doctorName', initial.doctorName)}
          {field('doctorTitle', 'doctorTitle', initial.doctorTitle)}
          <div className="sm:col-span-2">{field('doctorBio', 'doctorBio', initial.doctorBio, { rows: 3 })}</div>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('imagesSection')}
        </h2>
        <p className="text-xs text-slate-500">{t('imageHint')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {IMAGE_FIELDS.map((image) => (
            <div key={image.name}>
              <label className="label" htmlFor={image.name}>
                {t(image.labelKey as never)}
              </label>
              <input
                className="input-field"
                id={image.name}
                name={image.name}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={pending}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t('trialSection')}
        </h2>
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="trialBanner"
            value="true"
            defaultChecked={initial.trialBanner}
            disabled={pending}
            className="h-4 w-4 rounded border-slate-300"
          />
          {t('trialBanner')}
        </label>
        {field('trialBannerText', 'trialBannerText', initial.trialBannerText)}
      </section>

      <ActionError error={state && !state.ok ? state.error : null} />
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? tc('saving') : tc('save')}
        </button>
      </div>
    </form>
  );
}

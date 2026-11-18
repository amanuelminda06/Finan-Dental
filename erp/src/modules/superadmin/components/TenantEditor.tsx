'use client';

import { useActionState, type ReactNode } from 'react';
import type { ActionResult } from '@/lib/action';
import { SUPERADMIN_PATH } from '@/lib/superadmin-constants';
import { CONTENT_KEYS } from '@/modules/public-site/content';
import { BRAND_FORM_LOCALES } from '@/modules/tenant-brand/schemas';
import { WEEKDAYS } from '@/modules/settings/schemas';
import {
  activateTenantAction,
  deleteTenantAction,
  saveBrandAction,
  saveContentAction,
  saveSettingsAction,
  superadminLogoutAction,
  suspendTenantAction,
  updateTenantAction,
} from '../actions';
import type { TenantEditData } from '../service';

const IMAGE_FIELDS = [
  { name: 'logo', label: 'Logo' },
  { name: 'logoDark', label: 'Dark logo' },
  { name: 'hero', label: 'Hero image' },
  { name: 'heroSecondary', label: 'Secondary hero image' },
  { name: 'doctorPhoto', label: 'Doctor photo' },
] as const;

function Feedback({ state, success = 'Saved.' }: { state: ActionResult | null; success?: string }) {
  if (!state) return null;
  return state.ok ? (
    <p className="text-sm font-medium text-emerald-600">{success}</p>
  ) : (
    <p role="alert" className="text-sm font-medium text-red-600">
      {state.error || 'Something went wrong'}
    </p>
  );
}

function TextField({
  id,
  name,
  label,
  value,
  type = 'text',
  required = false,
  rows,
  disabled = false,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  value: string | number;
  type?: string;
  required?: boolean;
  rows?: number;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      {rows ? (
        <textarea
          className="input-field"
          id={id}
          name={name}
          rows={rows}
          defaultValue={value}
          disabled={disabled}
          required={required}
        />
      ) : (
        <input
          className="input-field"
          id={id}
          name={name}
          type={type}
          defaultValue={value}
          disabled={disabled}
          required={required}
        />
      )}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function BooleanSelect({
  id,
  name,
  label,
  value,
}: {
  id: string;
  name: string;
  label: string;
  value: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select className="input-field" id={id} name={name} defaultValue={value ? 'true' : 'false'}>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  open = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="card" open={open}>
      <summary className="cursor-pointer px-6 py-4 text-lg font-semibold text-slate-900">
        {title}
      </summary>
      <div className="space-y-4 border-t border-slate-100 px-6 py-5">
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        {children}
      </div>
    </details>
  );
}

function dateTimeValue(iso: string | null): string {
  return iso ? iso.slice(0, 16) : '';
}

function contentLabel(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Full per-tenant platform editor. Each section submits its own server action. */
export default function TenantEditor({ data }: { data: TenantEditData }) {
  const { tenant, brand, content, settings } = data;

  const [identityState, identityAction, identityPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateTenantAction, null);
  const [activateState, activateAction, activatePending] = useActionState<
    ActionResult | null,
    FormData
  >(activateTenantAction, null);
  const [suspendState, suspendAction, suspendPending] = useActionState<
    ActionResult | null,
    FormData
  >(suspendTenantAction, null);
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(
    deleteTenantAction,
    null,
  );
  const [brandState, brandAction, brandPending] = useActionState<ActionResult | null, FormData>(
    saveBrandAction,
    null,
  );
  const [contentState, contentAction, contentPending] = useActionState<
    ActionResult | null,
    FormData
  >(saveContentAction, null);
  const [settingsState, settingsAction, settingsPending] = useActionState<
    ActionResult | null,
    FormData
  >(saveSettingsAction, null);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a className="text-sm text-slate-500 underline underline-offset-2" href={SUPERADMIN_PATH}>
            ← All tenants
          </a>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {brand.clinicName || tenant.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            <code>/{tenant.slug}</code> · {tenant.status}
            {tenant.protected ? ' · protected platform tenant' : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <a
              className="text-slate-700 underline underline-offset-2"
              href={`/${tenant.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              Public site ↗
            </a>
            <a
              className="text-slate-700 underline underline-offset-2"
              href={`/${tenant.slug}/erp/login`}
              target="_blank"
              rel="noreferrer"
            >
              ERP login ↗
            </a>
          </div>
        </div>
        <form action={superadminLogoutAction}>
          <button type="submit" className="btn-secondary">
            Sign out
          </button>
        </form>
      </header>

      <Section
        title="Tenant identity & lifecycle"
        description={
          tenant.protected
            ? 'The protected platform tenant stays ACTIVE at its original URL and never expires. Its name can still be edited.'
            : 'Rename the clinic, change its URL, adjust the trial window, or change its serving status.'
        }
        open
      >
        <form action={identityAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="slug" value={tenant.slug} />
          <TextField
            id="tenant-name"
            name="name"
            label="Directory name"
            value={tenant.name}
            required
            disabled={identityPending}
          />
          {tenant.protected ? (
            <>
              <input type="hidden" name="newSlug" value={tenant.slug} />
              <input type="hidden" name="status" value="ACTIVE" />
              <input type="hidden" name="trialEndsAt" value="" />
              <TextField
                id="tenant-slug"
                name="slug-display"
                label="URL slug"
                value={tenant.slug}
                disabled
              />
            </>
          ) : (
            <>
              <TextField
                id="tenant-slug"
                name="newSlug"
                label="URL slug"
                value={tenant.slug}
                required
                disabled={identityPending}
              />
              <div>
                <label className="label" htmlFor="tenant-status">
                  Status
                </label>
                <select
                  className="input-field"
                  id="tenant-status"
                  name="status"
                  defaultValue={tenant.status}
                  disabled={identityPending}
                >
                  <option value="TRIAL">TRIAL</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
              <TextField
                id="tenant-trial"
                name="trialEndsAt"
                label="Trial ends at"
                type="datetime-local"
                value={dateTimeValue(tenant.trialEndsAt)}
                hint="Leave blank for no expiry."
                disabled={identityPending}
              />
            </>
          )}
          <Feedback state={identityState} success="Tenant identity saved." />
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={identityPending}>
              {identityPending ? 'Saving…' : 'Save identity'}
            </button>
          </div>
        </form>

        {!tenant.protected ? (
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            <form action={activateAction}>
              <input type="hidden" name="slug" value={tenant.slug} />
              <button type="submit" className="btn-primary" disabled={activatePending}>
                {activatePending ? 'Activating…' : 'Activate'}
              </button>
              {activateState && !activateState.ok ? (
                <span role="alert" className="ml-2 text-sm text-red-600">
                  {activateState.error}
                </span>
              ) : null}
            </form>
            <form action={suspendAction}>
              <input type="hidden" name="slug" value={tenant.slug} />
              <button type="submit" className="btn-secondary" disabled={suspendPending}>
                {suspendPending ? 'Suspending…' : 'Suspend'}
              </button>
              {suspendState && !suspendState.ok ? (
                <span role="alert" className="ml-2 text-sm text-red-600">
                  {suspendState.error}
                </span>
              ) : null}
            </form>
            <form
              action={deleteAction}
              onSubmit={(event) => {
                if (!window.confirm(`Delete tenant "${tenant.slug}" and all of its data?`)) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="slug" value={tenant.slug} />
              <button type="submit" className="btn-danger" disabled={deletePending}>
                {deletePending ? 'Deleting…' : 'Delete tenant'}
              </button>
              {deleteState && !deleteState.ok ? (
                <span role="alert" className="ml-2 text-sm text-red-600">
                  {deleteState.error}
                </span>
              ) : null}
            </form>
          </div>
        ) : null}
      </Section>

      <Section
        title="Branding & contact"
        description="Website identity, address, contacts, palette, doctor profile and images."
      >
        <form action={brandAction} className="space-y-5" encType="multipart/form-data">
          <input type="hidden" name="slug" value={tenant.slug} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="brand-clinic"
              name="clinicName"
              label="Clinic name"
              value={brand.clinicName}
              required
              disabled={brandPending}
            />
            <TextField
              id="brand-short"
              name="shortName"
              label="Short name"
              value={brand.shortName}
              required
              disabled={brandPending}
            />
            <div className="sm:col-span-2">
              <TextField
                id="brand-tagline"
                name="tagline"
                label="Tagline"
                value={brand.tagline}
                disabled={brandPending}
              />
            </div>
            <div className="sm:col-span-2">
              <TextField
                id="brand-address"
                name="address"
                label="Address"
                value={brand.address}
                disabled={brandPending}
              />
            </div>
            <TextField
              id="brand-phones"
              name="phones"
              label="Phones (comma or newline separated)"
              value={brand.phones.join(', ')}
              disabled={brandPending}
            />
            <TextField
              id="brand-email"
              name="email"
              label="Email"
              type="email"
              value={brand.email}
              disabled={brandPending}
            />
            <TextField
              id="brand-instagram"
              name="instagram"
              label="Instagram"
              value={brand.socials.instagram}
              disabled={brandPending}
            />
            <TextField
              id="brand-telegram"
              name="telegram"
              label="Telegram"
              value={brand.socials.telegram}
              disabled={brandPending}
            />
            <TextField
              id="brand-tiktok"
              name="tiktok"
              label="TikTok"
              value={brand.socials.tiktok}
              disabled={brandPending}
            />
            <TextField
              id="brand-website"
              name="website"
              label="Website"
              value={brand.socials.website}
              disabled={brandPending}
            />
            <TextField
              id="brand-sms"
              name="smsSenderName"
              label="SMS sender name"
              value={brand.smsSenderName}
              required
              disabled={brandPending}
            />
            <TextField
              id="brand-currency"
              name="currency"
              label="Currency"
              value={brand.currency}
              required
              disabled={brandPending}
            />
            <TextField
              id="brand-timezone"
              name="timezone"
              label="Timezone"
              value={brand.timezone}
              required
              disabled={brandPending}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="label">Languages</legend>
            <div className="flex flex-wrap gap-4">
              {BRAND_FORM_LOCALES.map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="locales"
                    value={code}
                    defaultChecked={brand.locales.includes(code)}
                    disabled={brandPending}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {code.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['colorPrimary', 'Primary color', brand.colors.primary],
                ['colorSecondary', 'Secondary color', brand.colors.secondary],
                ['colorAccent', 'Accent color', brand.colors.accent],
              ] as const
            ).map(([name, label, value]) => (
              <div key={name}>
                <label className="label" htmlFor={`brand-${name}`}>
                  {label}
                </label>
                <input
                  className="h-11 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
                  id={`brand-${name}`}
                  name={name}
                  type="color"
                  defaultValue={value}
                  disabled={brandPending}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="doctor-name"
              name="doctorName"
              label="Doctor name"
              value={brand.doctorName}
              disabled={brandPending}
            />
            <TextField
              id="doctor-title"
              name="doctorTitle"
              label="Doctor title"
              value={brand.doctorTitle}
              disabled={brandPending}
            />
            <div className="sm:col-span-2">
              <TextField
                id="doctor-bio"
                name="doctorBio"
                label="Doctor bio"
                value={brand.doctorBio}
                rows={3}
                disabled={brandPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {IMAGE_FIELDS.map((image) => (
              <div key={image.name}>
                <label className="label" htmlFor={`image-${image.name}`}>
                  {image.label}
                </label>
                <input
                  className="input-field"
                  id={`image-${image.name}`}
                  name={image.name}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={brandPending}
                />
                <p className="mt-1 text-xs text-slate-500">PNG, JPEG or WebP · max 2 MB</p>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="trialBanner"
              value="true"
              defaultChecked={brand.trialBanner}
              disabled={brandPending}
              className="h-4 w-4 rounded border-slate-300"
            />
            Show trial banner
          </label>
          <TextField
            id="trial-banner-text"
            name="trialBannerText"
            label="Trial banner text"
            value={brand.trialBannerText}
            disabled={brandPending}
          />

          <Feedback state={brandState} success="Branding saved." />
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={brandPending}>
              {brandPending ? 'Saving…' : 'Save branding'}
            </button>
          </div>
        </form>
      </Section>

      <Section
        title="Website content"
        description="Bilingual public-site copy. JSON fields (FAQ, announcements, testimonials) remain plain text."
      >
        <form action={contentAction} className="space-y-4">
          <input type="hidden" name="slug" value={tenant.slug} />
          {CONTENT_KEYS.map((key) => {
            if (key === 'announcement_active') {
              return (
                <div key={key} className="sm:max-w-xs">
                  <label className="label" htmlFor="content-announcement-active">
                    Announcement active
                  </label>
                  <select
                    className="input-field"
                    id="content-announcement-active"
                    name="announcement_active"
                    defaultValue={content[key].en === 'true' ? 'true' : 'false'}
                    disabled={contentPending}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              );
            }
            const value = content[key];
            return (
              <fieldset key={key} className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id={`content-${key}-en`}
                  name={`${key}_en`}
                  label={`${contentLabel(key)} (EN)`}
                  value={value.en}
                  rows={2}
                  disabled={contentPending}
                />
                <TextField
                  id={`content-${key}-am`}
                  name={`${key}_am`}
                  label={`${contentLabel(key)} (AM)`}
                  value={value.am}
                  rows={2}
                  disabled={contentPending}
                />
              </fieldset>
            );
          })}
          <Feedback state={contentState} success="Website content saved." />
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={contentPending}>
              {contentPending ? 'Saving…' : 'Save content'}
            </button>
          </div>
        </form>
      </Section>

      <Section title="ERP settings" description="Clinic operations, messaging and working hours.">
        <form action={settingsAction} className="space-y-5">
          <input type="hidden" name="slug" value={tenant.slug} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="setting-clinic-name"
              name="clinic_name"
              label="Clinic name"
              value={settings.clinic_name}
              required
              disabled={settingsPending}
            />
            <TextField
              id="setting-currency"
              name="currency"
              label="Currency"
              value={settings.currency}
              required
              disabled={settingsPending}
            />
            <TextField
              id="setting-timezone"
              name="timezone"
              label="Timezone"
              value={settings.timezone}
              required
              disabled={settingsPending}
            />
            <TextField
              id="setting-reminder-time"
              name="reminder_send_time"
              label="Reminder send time"
              value={settings.reminder_send_time}
              required
              disabled={settingsPending}
            />
            <TextField
              id="setting-reminder-offset"
              name="reminder_send_by_offset_minutes"
              label="Reminder offset (minutes)"
              type="number"
              value={settings.reminder_send_by_offset_minutes}
              required
              disabled={settingsPending}
            />
            <TextField
              id="setting-followup"
              name="followup_lead_days"
              label="Follow-up lead days"
              type="number"
              value={settings.followup_lead_days}
              required
              disabled={settingsPending}
            />
            <TextField
              id="setting-recall"
              name="recall_months"
              label="Recall months"
              type="number"
              value={settings.recall_months}
              required
              disabled={settingsPending}
            />
            <TextField
              id="setting-review-link"
              name="review_link"
              label="Review link"
              value={settings.review_link}
              disabled={settingsPending}
            />
            <div>
              <label className="label" htmlFor="setting-sms-mode">
                SMS mode
              </label>
              <select
                className="input-field"
                id="setting-sms-mode"
                name="sms_mode"
                defaultValue={settings.sms_mode}
                disabled={settingsPending}
              >
                <option value="MANUAL_LINK">MANUAL_LINK</option>
                <option value="GATEWAY">GATEWAY</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="setting-language">
                Default language
              </label>
              <select
                className="input-field"
                id="setting-language"
                name="default_language"
                defaultValue={settings.default_language}
                disabled={settingsPending}
              >
                <option value="en">English</option>
                <option value="am">Amharic</option>
              </select>
            </div>
            <TextField
              id="setting-campaign-limit"
              name="campaign_max_recipients"
              label="Campaign recipient limit"
              type="number"
              value={settings.campaign_max_recipients}
              required
              disabled={settingsPending}
            />
            <TextField
              id="setting-group-limit"
              name="group_sms_max_recipients"
              label="Group SMS recipient limit"
              type="number"
              value={settings.group_sms_max_recipients}
              required
              disabled={settingsPending}
            />
            <TextField
              id="setting-digest-email"
              name="digest_email"
              label="Digest email"
              type="email"
              value={settings.digest_email}
              disabled={settingsPending}
            />
            <BooleanSelect
              id="setting-reception-campaigns"
              name="reception_can_send_campaigns"
              label="Reception can send campaigns"
              value={settings.reception_can_send_campaigns}
            />
            <BooleanSelect
              id="setting-digest-enabled"
              name="digest_enabled"
              label="Digest enabled"
              value={settings.digest_enabled}
            />
            <BooleanSelect
              id="setting-group-filtered"
              name="group_sms_allow_for_filtered"
              label="Group SMS for filtered patients"
              value={settings.group_sms_allow_for_filtered}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="label">Working hours</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {WEEKDAYS.map((day) => (
                <div key={day} className="rounded border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-medium uppercase text-slate-600">{day}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      className="input-field"
                      name={`working_hours.${day}.open`}
                      type="time"
                      defaultValue={settings.working_hours[day].open}
                      disabled={settingsPending}
                      aria-label={`${day} open`}
                    />
                    <input
                      className="input-field"
                      name={`working_hours.${day}.close`}
                      type="time"
                      defaultValue={settings.working_hours[day].close}
                      disabled={settingsPending}
                      aria-label={`${day} close`}
                    />
                    <select
                      className="input-field"
                      name={`working_hours.${day}.closed`}
                      defaultValue={settings.working_hours[day].closed ? 'true' : 'false'}
                      disabled={settingsPending}
                      aria-label={`${day} closed`}
                    >
                      <option value="false">Open</option>
                      <option value="true">Closed</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <Feedback state={settingsState} success="ERP settings saved." />
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={settingsPending}>
              {settingsPending ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      </Section>
    </main>
  );
}

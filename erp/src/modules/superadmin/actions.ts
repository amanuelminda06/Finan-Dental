'use server';

import type { TenantStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { fail, ok, type ActionResult } from '@/lib/action';
import { validate, ValidationError } from '@/lib/errors';
import {
  clearSuperadminSession,
  createSuperadminSession,
  requireSuperadmin,
  verifySuperadminCredentials,
} from '@/lib/superadmin-auth';
import { SUPERADMIN_PATH } from '@/lib/superadmin-constants';
import { brandingFormSchema } from '@/modules/tenant-brand/schemas';
import { CONTENT_KEYS } from '@/modules/public-site/content';
import { contentEditSchema } from '@/modules/public-site/schemas';
import { settingsFormSchema, WEEKDAYS } from '@/modules/settings/schemas';
import {
  activateTenant,
  createTenant,
  deleteTenant,
  IMAGE_FIELDS,
  saveBrand,
  saveContent,
  saveSettings,
  suspendTenant,
  SuperadminError,
  updateTenant,
} from './service';

function string(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '');
}

async function run(action: () => Promise<ActionResult>): Promise<ActionResult> {
  await requireSuperadmin();
  try {
    const result = await action();
    revalidatePath(SUPERADMIN_PATH);
    revalidatePath(`${SUPERADMIN_PATH}/tenants/[slug]`);
    return result;
  } catch (error) {
    if (error instanceof ValidationError) return fail('validationError', error.fields);
    if (error instanceof SuperadminError) return fail(error.message);
    throw error;
  }
}

function refreshTenant(slug: string): void {
  revalidatePath(`${SUPERADMIN_PATH}/tenants/${slug}`);
}

export async function superadminLoginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!verifySuperadminCredentials(formData.get('username'), formData.get('password'))) {
    return fail('Invalid username or password');
  }
  await createSuperadminSession();
  redirect(SUPERADMIN_PATH);
}

export async function superadminLogoutAction(): Promise<void> {
  await clearSuperadminSession();
  redirect(SUPERADMIN_PATH);
}

export async function createTenantAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = string(formData, 'slug').trim().toLowerCase();
  const result = await run(async () => {
    await createTenant({
      slug,
      name: string(formData, 'name'),
      ownerEmail: string(formData, 'ownerEmail'),
      demoData: formData.get('demoData') === 'true',
    });
    return ok();
  });
  if (!result.ok) return result;
  redirect(`${SUPERADMIN_PATH}/tenants/${slug}`);
}

export async function updateTenantAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = string(formData, 'slug');
  const newSlug = string(formData, 'newSlug').trim().toLowerCase();
  const result = await run(async () => {
    const status = string(formData, 'status');
    if (!['TRIAL', 'ACTIVE', 'SUSPENDED'].includes(status)) {
      throw new SuperadminError('Invalid tenant status');
    }
    const trial = string(formData, 'trialEndsAt');
    if (trial && Number.isNaN(Date.parse(trial))) {
      throw new SuperadminError('Invalid trial end date');
    }
    await updateTenant(slug, {
      name: string(formData, 'name'),
      newSlug,
      status: status as TenantStatus,
      trialEndsAt: trial ? new Date(trial).toISOString() : null,
    });
    refreshTenant(slug);
    return ok();
  });
  if (result.ok && newSlug !== slug) redirect(`${SUPERADMIN_PATH}/tenants/${newSlug}`);
  return result;
}

export async function activateTenantAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = string(formData, 'slug');
  return run(async () => {
    await activateTenant(slug);
    refreshTenant(slug);
    return ok();
  });
}

export async function suspendTenantAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = string(formData, 'slug');
  return run(async () => {
    await suspendTenant(slug);
    refreshTenant(slug);
    return ok();
  });
}

export async function deleteTenantAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = string(formData, 'slug');
  const result = await run(async () => {
    await deleteTenant(slug);
    return ok();
  });
  if (result.ok) redirect(SUPERADMIN_PATH);
  return result;
}

export async function saveBrandAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = string(formData, 'slug');
  return run(async () => {
    const raw = {
      clinicName: string(formData, 'clinicName'),
      shortName: string(formData, 'shortName'),
      tagline: string(formData, 'tagline'),
      address: string(formData, 'address'),
      phones: string(formData, 'phones'),
      email: string(formData, 'email'),
      instagram: string(formData, 'instagram'),
      telegram: string(formData, 'telegram'),
      tiktok: string(formData, 'tiktok'),
      website: string(formData, 'website'),
      smsSenderName: string(formData, 'smsSenderName'),
      currency: string(formData, 'currency'),
      timezone: string(formData, 'timezone'),
      locales: formData.getAll('locales').map(String),
      colorPrimary: string(formData, 'colorPrimary'),
      colorSecondary: string(formData, 'colorSecondary'),
      colorAccent: string(formData, 'colorAccent'),
      doctorName: string(formData, 'doctorName'),
      doctorTitle: string(formData, 'doctorTitle'),
      doctorBio: string(formData, 'doctorBio'),
      trialBanner: formData.get('trialBanner') === 'true',
      trialBannerText: string(formData, 'trialBannerText'),
    };
    validate(brandingFormSchema, raw);
    const uploads: Partial<Record<(typeof IMAGE_FIELDS)[number], File>> = {};
    for (const field of IMAGE_FIELDS) {
      const value = formData.get(field);
      if (value instanceof File && value.size > 0) uploads[field] = value;
    }
    await saveBrand(slug, raw, uploads);
    refreshTenant(slug);
    return ok();
  });
}

export async function saveContentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = string(formData, 'slug');
  return run(async () => {
    const raw: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') raw[key] = value;
    }
    validate(contentEditSchema, raw);
    const next: Record<string, { en: string; am: string }> = {};
    for (const key of CONTENT_KEYS) {
      next[key] =
        key === 'announcement_active'
          ? { en: raw.announcement_active === 'true' ? 'true' : 'false', am: '' }
          : {
              en: (raw[`${key}_en`] ?? '').trim(),
              am: (raw[`${key}_am`] ?? '').trim(),
            };
    }
    await saveContent(slug, next);
    refreshTenant(slug);
    return ok();
  });
}

function dayFrom(formData: FormData, day: (typeof WEEKDAYS)[number]) {
  return {
    open: string(formData, `working_hours.${day}.open`),
    close: string(formData, `working_hours.${day}.close`),
    closed: formData.get(`working_hours.${day}.closed`) === 'true',
  };
}

export async function saveSettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const slug = string(formData, 'slug');
  return run(async () => {
    const raw = {
      clinic_name: string(formData, 'clinic_name'),
      currency: string(formData, 'currency'),
      timezone: string(formData, 'timezone'),
      working_hours: Object.fromEntries(WEEKDAYS.map((day) => [day, dayFrom(formData, day)])),
      reminder_send_time: string(formData, 'reminder_send_time'),
      reminder_send_by_offset_minutes: string(formData, 'reminder_send_by_offset_minutes'),
      followup_lead_days: string(formData, 'followup_lead_days'),
      recall_months: string(formData, 'recall_months'),
      review_link: string(formData, 'review_link'),
      sms_mode: string(formData, 'sms_mode'),
      reception_can_send_campaigns: formData.get('reception_can_send_campaigns') === 'true',
      campaign_max_recipients: string(formData, 'campaign_max_recipients'),
      digest_enabled: formData.get('digest_enabled') === 'true',
      digest_email: string(formData, 'digest_email'),
      default_language: string(formData, 'default_language'),
      group_sms_allow_for_filtered: formData.get('group_sms_allow_for_filtered') === 'true',
      group_sms_max_recipients: string(formData, 'group_sms_max_recipients'),
    };
    const values = validate(settingsFormSchema, raw);
    await saveSettings(slug, values);
    refreshTenant(slug);
    return ok();
  });
}

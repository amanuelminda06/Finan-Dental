import { z } from 'zod';

/** OWNER-facing branding form validation. Messages are i18n keys. */
export const BRAND_FORM_LOCALES = ['en', 'am'] as const;
const HEX = /^#[0-9a-fA-F]{6}$/;

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const brandingFormSchema = z.object({
  clinicName: z.string().trim().min(2, 'required').max(120, 'tooLong'),
  shortName: z.string().trim().min(1, 'required').max(40, 'tooLong'),
  tagline: z.string().trim().max(160, 'tooLong'),
  address: z.string().trim().max(300, 'tooLong'),
  phones: z.string().trim().max(300, 'tooLong'),
  email: z.union([z.literal(''), z.email('invalidEmail')]),
  instagram: z.string().trim().max(200, 'tooLong'),
  telegram: z.string().trim().max(200, 'tooLong'),
  tiktok: z.string().trim().max(200, 'tooLong'),
  website: z.string().trim().max(200, 'tooLong'),
  smsSenderName: z.string().trim().min(2, 'required').max(11, 'tooLong'),
  currency: z.string().trim().min(1, 'required').max(8, 'tooLong'),
  timezone: z.string().trim().refine(validTimezone, 'invalidTimezone'),
  locales: z.array(z.enum(BRAND_FORM_LOCALES)).min(1, 'required'),
  colorPrimary: z.string().regex(HEX, 'invalidColor'),
  colorSecondary: z.string().regex(HEX, 'invalidColor'),
  colorAccent: z.string().regex(HEX, 'invalidColor'),
  doctorName: z.string().trim().max(120, 'tooLong'),
  doctorTitle: z.string().trim().max(120, 'tooLong'),
  doctorBio: z.string().trim().max(600, 'tooLong'),
  trialBanner: z.boolean(),
  trialBannerText: z.string().trim().max(160, 'tooLong'),
});

export type BrandingFormValues = z.infer<typeof brandingFormSchema>;

/** Comma/newline separated phone input → stored string array. */
export function parsePhones(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((phone) => phone.trim())
    .filter(Boolean)
    .slice(0, 5);
}

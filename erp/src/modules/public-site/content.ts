import type { Locale } from '@/i18n/config';
import { brand } from '@/config/brand';

/**
 * CMS-lite content keys. Values live in the `SiteContent` table (bilingual) and
 * fall back to the placeholders below when a row is missing. Amharic values are
 * drafts that need a native-speaker review (surfaced in the editor).
 *
 * PLACEHOLDER TEXT: the defaults below are safe starting copy, not the clinic's
 * real wording. The clinic must review/replace them (see README).
 */
export const CONTENT_KEYS = [
  'hero_title',
  'hero_subtitle',
  'hero_promise',
  'home_intro',
  'footer_note',
  'privacy_body',
  'announcement_text',
  'announcement_active',
  'announcement_start',
  'announcement_end',
  'announcements_items',
  'faq_items',
  'testimonials_items',
  'contact_address',
  'contact_phone_primary',
  'contact_phone_backup',
  'contact_map_url',
  'social_tiktok',
  'social_instagram',
  'social_telegram',
  'doctors_intro',
  'city',
  'country',
  'specialty',
  'og_title',
  'og_subtitle',
  'og_city',
  'map_lat',
  'map_lng',
  'map_zoom',
] as const;

export type SiteContentKey = (typeof CONTENT_KEYS)[number];

export type Bilingual = { en: string; am: string };

export const DEFAULT_CONTENT: Record<SiteContentKey, Bilingual> = {
  hero_title: {
    en: 'A healthier smile starts here',
    am: 'ጤናማ ፈገግታ እዚህ ይጀምራል',
  },
  hero_subtitle: {
    en: 'Thoughtful dental care for your family, from preventive visits to advanced treatments.',
    am: 'ከመከላከያ ምርመራ እስከ ዘመናዊ ሕክምና፣ ለቤተሰብዎ በጥንቃቄ የሚሰጥ የጥርስ እንክብካቤ።',
  },
  hero_promise: {
    en: 'Comfortable, patient-first dental care in Addis Ababa.',
    am: 'በአዲስ አበባ ታካሚን ያማከለና ምቹ የጥርስ እንክብካቤ።',
  },
  home_intro: {
    en: 'Our experienced dentists provide comprehensive dental care — from routine checkups and cleanings to restorative and cosmetic treatments with a patient-first approach.',
    am: 'ልምድ ያላቸው የጥርስ ሐኪሞቻችን ሙሉ የጥርስ አገልግሎት ይሰጣሉ — ከመደበኛ ፍተሻ እና ጽዳት ጀምሮ እስከ መልሶ ማቋቋም እና ውብ ህክምናዎች ድረስ።',
  },
  footer_note: {
    en: 'This website is for general information only and does not replace a medical consultation.',
    am: 'ይህ ድህረ ገጽ ለአጠቃላይ መረጃ ብቻ ነው፤ የህክምና ምክርን አይተካም።',
  },
  privacy_body: {
    en: `PLACEHOLDER — This privacy policy has not been finalised. ${brand.clinicName} collects the information you submit through the appointment request form (your name, phone number, preferred date and time) only to contact you about your request. We do not ask for or store medical details on this website. The clinic must replace this text with its reviewed privacy policy before launch.`,
    am: 'ጊዜያዊ — ይህ የግላዊነት ፖሊሲ አልተጠናቀቀም። ፊናን ስፔሻሊቲ የጥርስ ክሊኒክ በቀጠሮ ጥያቄ ቅጽ የሚያስገቡትን መረጃ (ስምዎን፣ ስልክ ቁጥርዎን፣ የሚፈልጉትን ቀንና ሰዓት) ስለ ጥያቄዎ ለማግኘት ብቻ ይሰበስባል። በዚህ ድህረ ገጽ የህክምና ዝርዝር አንጠይቅም አናከማችም። ክሊኒኩ ከመጀመሩ በፊት ይህን ጽሑፍ በተገመገመ የግላዊነት ፖሊሲ መተካት አለበት።',
  },
  announcement_text: {
    en: '',
    am: '',
  },
  announcement_active: {
    en: 'true',
    am: 'true',
  },
  announcement_start: {
    en: '',
    am: '',
  },
  announcement_end: {
    en: '',
    am: '',
  },
  faq_items: {
    en: JSON.stringify([
      {
        question: 'Do I need an appointment?',
        answer:
          'Walk-ins are welcome, but booking ahead means less waiting. Use the booking form and we will call you to confirm.',
      },
      {
        question: 'What should I bring?',
        answer:
          'Bring any current dental records, a list of medicines you take, and previous treatment details if you have them.',
      },
      {
        question: 'Is dental treatment painful?',
        answer:
          'We aim to keep your visit comfortable. Your dentist will explain what to expect before treatment begins.',
      },
    ]),
    am: JSON.stringify([
      {
        question: 'ቀጠሮ ያስፈልጋል?',
        answer:
          'ያለቀጠሮ መምጣት ይቻላል፣ ነገር ግን ቀድመው መያዝ ጥበቃን ይቀንሳል። የቀጠሮ ቅጹን ይጠቀሙ፤ እኛም ለማረጋገጥ እንደውልልዎታለን።',
      },
      {
        question: 'ምን ማምጣት አለብኝ?',
        answer: 'ያለዎትን ብርጭቆ ወይም የዓይን ሌንስ፣ የሚወስዱትን መድሃኒት ዝርዝር እና ቀድሞ የነበረዎትን የዓይን መዝገብ ይዘው ይምጡ።',
      },
      {
        question: 'የጥርስ ሕክምና ያማል?',
        answer: 'ጉብኝትዎ ምቹ እንዲሆን እንጥራለን። ሕክምናው ከመጀመሩ በፊት የጥርስ ሐኪምዎ ምን እንደሚጠብቁ ያብራራል።',
      },
    ]),
  },
  testimonials_items: {
    en: JSON.stringify([
      {
        name: 'Sample patient',
        text: 'Placeholder testimonial — replace with a real, consented patient review.',
      },
      {
        name: 'Sample patient',
        text: 'Placeholder testimonial — replace with a real, consented patient review.',
      },
    ]),
    am: JSON.stringify([
      { name: 'ናሙና ታካሚ', text: 'ጊዜያዊ ምስክርነት — በእውነተኛ ፈቃድ በተሰጠ የታካሚ ግምገማ ይተኩ።' },
      { name: 'ናሙና ታካሚ', text: 'ጊዜያዊ ምስክርነት — በእውነተኛ ፈቃድ በተሰጠ የታካሚ ግምገማ ይተኩ።' },
    ]),
  },
  contact_address: {
    en: brand.address,
    am: brand.address,
  },
  contact_phone_primary: {
    en: brand.phones[0],
    am: brand.phones[0],
  },
  contact_phone_backup: {
    en: brand.phones[1],
    am: brand.phones[1],
  },
  contact_map_url: {
    en: 'https://maps.app.goo.gl/Cyye5QKD3qjUWVXA6',
    am: 'https://maps.app.goo.gl/Cyye5QKD3qjUWVXA6',
  },
  social_tiktok: {
    en: '',
    am: '',
  },
  social_instagram: {
    en: '',
    am: '',
  },
  social_telegram: {
    en: `https://t.me/${brand.telegram.slice(1)}`,
    am: `https://t.me/${brand.telegram.slice(1)}`,
  },
  doctors_intro: {
    en: 'Meet our dental team — skilled dentists combining modern equipment with attentive, personal care.',
    am: 'የጥርስ ቡድናችንን ይገናኙ — ዘመናዊ መሳሪያዎችን በመጠቀም በጥንቃቄ እና በግል እንክብካቤ የሚያገለግሉ ልምድ ያላቸው የጥርስ ሐኪሞች።',
  },
  announcements_items: {
    en: JSON.stringify([
      {
        title: 'Book a dental visit',
        message: 'Contact our team to find a convenient time for your dental visit.',
      },
    ]),
    am: JSON.stringify([
      {
        title: 'ቀጠሮ ይያዙ',
        message: 'ለጥርስ ጉብኝትዎ ምቹ ጊዜ ለመምረጥ ቡድናችንን ያነጋግሩ።',
      },
    ]),
  },
city: {
    en: 'Addis Ababa',
    am: 'PLACEHOLDER — city',
  },
  country: {
    en: 'Ethiopia',
    am: 'PLACEHOLDER — country',
  },
  specialty: {
    en: 'Dentistry',
    am: 'የጥርስ ሕክምና',
  },
  og_title: {
    en: 'Dental care for every smile',
    am: 'ለሁሉም ፈገግታ የጥርስ እንክብካቤ',
  },
  og_subtitle: {
    en: 'Consultations · Cleaning · Restorative and specialist dental care',
    am: 'ምክር · ጽዳት · የጥርስ ጥገናና ልዩ እንክብካቤ',
  },
  og_city: {
    en: 'Addis Ababa, Ethiopia',
    am: 'PLACEHOLDER — open-graph city',
  },
  map_lat: {
    en: '8.896235398615133',
    am: '8.896235398615133',
  },
  map_lng: {
    en: '38.77100409325467',
    am: '38.77100409325467',
  },
  map_zoom: {
    en: '15',
    am: '15',
  },
};

export type SiteContentMap = Record<SiteContentKey, Bilingual>;

/** Merges DB rows (partial) over the placeholder defaults. */
export function resolveContent(
  rows: Array<{ key: string; valueEn: string; valueAm: string }>,
): SiteContentMap {
  const map = { ...DEFAULT_CONTENT } as SiteContentMap;
  const byKey = new Map(rows.map((row) => [row.key, row]));
  for (const key of CONTENT_KEYS) {
    const row = byKey.get(key);
    if (row) {
      map[key] = { en: row.valueEn, am: row.valueAm || row.valueEn };
    }
  }
  return map;
}

/** Picks a locale value, falling back to English when the Amharic text is blank. */
export function pick(locale: Locale | string, value: Bilingual): string {
  if (locale === 'am') return value.am || value.en;
  return value.en;
}

export type FaqItem = { question: string; answer: string };

/** Parses a FAQ/testimonial JSON column defensively (never throws). */
export function parseItems<T>(json: string, validate: (value: unknown) => value is T): T[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validate);
  } catch {
    return [];
  }
}

export function isFaqItem(value: unknown): value is FaqItem {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as FaqItem).question === 'string' &&
    typeof (value as FaqItem).answer === 'string'
  );
}

export type Testimonial = { name: string; text: string };

export function isTestimonial(value: unknown): value is Testimonial {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Testimonial).name === 'string' &&
    typeof (value as Testimonial).text === 'string'
  );
}

export type AnnouncementItem = { title: string; message: string };

export function isAnnouncementItem(value: unknown): value is AnnouncementItem {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as AnnouncementItem).title === 'string' &&
    typeof (value as AnnouncementItem).message === 'string'
  );
}

function truthy(value: string): boolean {
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Whether the announcement banner should show right now. Active flag plus an
 * optional inclusive clinic-local date window (`YYYY-MM-DD`). Pure & tested.
 */
export function isAnnouncementVisible(
  content: SiteContentMap,
  now: Date,
  timeZone: string,
  clinicDateKeyFn: (input: Date, tz: string) => string,
): boolean {
  if (!truthy(content.announcement_active.en)) return false;
  if (!content.announcement_text.en.trim() && !content.announcement_text.am.trim()) return false;

  const today = clinicDateKeyFn(now, timeZone);
  const start = content.announcement_start.en.trim();
  const end = content.announcement_end.en.trim();
  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

import { normalizePhone } from '../src/lib/phone';

/**
 * Fake demo patients for `prisma/seed.ts` (20 rows).
 * Invented names, obviously fake phones, dental visit notes only.
 */

export const TAG_NAMES = [
  'cleaning',
  'filling',
  'extraction',
  'braces',
  'whitening',
  'implant',
] as const;

export type SeedPatient = {
  fullName: string;
  phone: string;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  birthDate: string;
  preferredLanguage: 'en' | 'am';
  doNotMessage?: boolean;
  doNotMessageReason?: string;
  active?: boolean;
  notesNonClinical?: string;
  tags: string[];
};

export const PATIENTS: SeedPatient[] = [
  { fullName: 'Demo Patient One', phone: '+251 900 000 001', sex: 'FEMALE', birthDate: '1990-01-01', preferredLanguage: 'en', tags: ['cleaning'], notesNonClinical: 'Routine cleaning' },
  { fullName: 'Demo Patient Two', phone: '+251 900 000 002', sex: 'MALE', birthDate: '1988-02-02', preferredLanguage: 'am', tags: ['filling'], notesNonClinical: 'Cavity filling' },
  { fullName: 'Demo Patient Three', phone: '+251 900 000 003', sex: 'FEMALE', birthDate: '1992-03-03', preferredLanguage: 'en', tags: ['extraction'], notesNonClinical: 'Tooth extraction' },
  { fullName: 'Demo Patient Four', phone: '+251 900 000 004', sex: 'MALE', birthDate: '1985-04-04', preferredLanguage: 'am', tags: ['braces'], notesNonClinical: 'Braces follow-up' },
  { fullName: 'Demo Patient Five', phone: '+251 900 000 005', sex: 'FEMALE', birthDate: '1995-05-05', preferredLanguage: 'en', tags: ['whitening'], notesNonClinical: 'Teeth whitening' },
  { fullName: 'Demo Patient Six', phone: '+251 900 000 006', sex: 'MALE', birthDate: '1980-06-06', preferredLanguage: 'am', tags: ['implant'], notesNonClinical: 'Implant consult' },
  { fullName: 'Demo Patient Seven', phone: '+251 900 000 007', sex: 'FEMALE', birthDate: '1993-07-07', preferredLanguage: 'en', tags: ['cleaning'], notesNonClinical: 'Cleaning' },
  { fullName: 'Demo Patient Eight', phone: '+251 900 000 008', sex: 'MALE', birthDate: '1987-08-08', preferredLanguage: 'am', tags: ['filling'], notesNonClinical: 'Filling' },
  { fullName: 'Demo Patient Nine', phone: '+251 900 000 009', sex: 'FEMALE', birthDate: '1991-09-09', preferredLanguage: 'en', tags: ['extraction'], notesNonClinical: 'Extraction' },
  { fullName: 'Demo Patient Ten', phone: '+251 900 000 010', sex: 'MALE', birthDate: '1986-10-10', preferredLanguage: 'am', tags: ['braces'], notesNonClinical: 'Braces' },
  { fullName: 'Demo Patient Eleven', phone: '+251 900 000 011', sex: 'FEMALE', birthDate: '1994-11-11', preferredLanguage: 'en', tags: ['whitening'], notesNonClinical: 'Whitening' },
  { fullName: 'Demo Patient Twelve', phone: '+251 900 000 012', sex: 'MALE', birthDate: '1982-12-12', preferredLanguage: 'am', tags: ['implant'], notesNonClinical: 'Implant' },
  { fullName: 'Demo Patient Thirteen', phone: '+251 900 000 013', sex: 'FEMALE', birthDate: '1996-01-13', preferredLanguage: 'en', tags: ['cleaning'], notesNonClinical: 'Cleaning' },
  { fullName: 'Demo Patient Fourteen', phone: '+251 900 000 014', sex: 'MALE', birthDate: '1989-02-14', preferredLanguage: 'am', tags: ['filling'], notesNonClinical: 'Filling' },
  { fullName: 'Demo Patient Fifteen', phone: '+251 900 000 015', sex: 'FEMALE', birthDate: '1997-03-15', preferredLanguage: 'en', tags: ['extraction'], notesNonClinical: 'Extraction' },
  { fullName: 'Demo Patient Sixteen', phone: '+251 900 000 016', sex: 'MALE', birthDate: '1984-04-16', preferredLanguage: 'am', tags: ['braces'], notesNonClinical: 'Braces' },
  { fullName: 'Demo Patient Seventeen', phone: '+251 900 000 017', sex: 'FEMALE', birthDate: '1998-05-17', preferredLanguage: 'en', tags: ['whitening'], notesNonClinical: 'Whitening' },
  { fullName: 'Demo Patient Eighteen', phone: '+251 900 000 018', sex: 'MALE', birthDate: '1981-06-18', preferredLanguage: 'am', tags: ['implant'], notesNonClinical: 'Implant' },
  { fullName: 'Demo Patient Nineteen', phone: '+251 900 000 019', sex: 'FEMALE', birthDate: '1999-07-19', preferredLanguage: 'en', tags: ['cleaning'], notesNonClinical: 'Cleaning' },
  { fullName: 'Demo Patient Twenty', phone: '+251 900 000 020', sex: 'MALE', birthDate: '1983-08-20', preferredLanguage: 'am', tags: ['filling'], notesNonClinical: 'Filling' },
];

export function seedPatientRows() {
  return PATIENTS.map((p) => ({
    fullName: p.fullName,
    phone: p.phone,
    phoneE164: normalizePhone(p.phone),
    sex: p.sex,
    birthDate: p.birthDate,
    birthDateDate: new Date(p.birthDate),
    preferredLanguage: p.preferredLanguage,
    doNotMessage: p.doNotMessage ?? false,
    doNotMessageReason: p.doNotMessageReason ?? null,
    active: p.active ?? true,
    notesNonClinical: p.notesNonClinical ?? null,
    tags: p.tags,
  }));
}

export function tagColorFor(name: string): string {
  const map: Record<string, string> = {
    cleaning: '#2563eb',
    filling: '#1d4ed8',
    extraction: '#1e40af',
    braces: '#60a5fa',
    whitening: '#93c5fd',
    implant: '#3b82f6',
  };
  return map[name] ?? '#2563eb';
}

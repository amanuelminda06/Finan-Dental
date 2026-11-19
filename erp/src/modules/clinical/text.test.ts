import { describe, expect, it } from 'vitest';
import { CLINICAL_ROLES } from './constants';
import {
  buildClinicalSearchText,
  normalizeSuggestionLabel,
  normalizeTextItems,
  segmentToothMentions,
  toothMentionsIn,
} from './text';

describe('clinical roles', () => {
  it('grants chart access to owners and staff', () => {
    expect(CLINICAL_ROLES).toEqual(['OWNER', 'STAFF']);
  });
});

describe('normalizeTextItems', () => {
  it('trims, de-duplicates case-insensitively and accepts any wording', () => {
    expect(normalizeTextItems([' Penicillin ', 'penicillin', '', 'Latex gloves'])).toEqual([
      'Penicillin',
      'Latex gloves',
    ]);
  });

  it('normalizes suggestion keys for tenant-owned suggestions', () => {
    expect(normalizeSuggestionLabel('  Root   Canal Treated ')).toBe('root canal treated');
  });
});

describe('segmentToothMentions', () => {
  it('links #36 and tooth 36 mentions without changing the surrounding note', () => {
    const segments = segmentToothMentions('Reviewed #36 and tooth 36 again.');
    expect(segments).toEqual([
      { type: 'text', value: 'Reviewed ' },
      { type: 'tooth', value: '#36', toothNumber: 36 },
      { type: 'text', value: ' and ' },
      { type: 'tooth', value: 'tooth 36', toothNumber: 36 },
      { type: 'text', value: ' again.' },
    ]);
  });

  it('matches uppercase TOOTH and optional spacing', () => {
    expect(toothMentionsIn('TOOTH 11, # 21 and tooth 99')).toEqual([11, 21]);
  });

  it('leaves invalid or out-of-range numbers as plain text', () => {
    const segments = segmentToothMentions('#0 #99 #48');
    expect(segments).toEqual([
      { type: 'text', value: '#0 #99 ' },
      { type: 'tooth', value: '#48', toothNumber: 48 },
    ]);
  });
});

describe('buildClinicalSearchText', () => {
  it('includes history, findings, surfaces, visits and plan text', () => {
    const text = buildClinicalSearchText({
      patientName: 'Test Patient',
      idNo: 'P-1',
      historyNotes: 'sensitive teeth',
      items: [{ kind: 'allergy', text: 'penicillin' }],
      teeth: [
        {
          toothNumber: 36,
          finding: 'caries',
          note: 'deep',
          surfaces: [{ surface: 'occlusal', note: 'discoloured' }],
        },
      ],
      visits: [{ visitDate: '2026-11-19', body: 'pain in #36' }],
      plans: [{ procedureName: 'filling', status: 'PLANNED', toothNumber: 36 }],
    });

    expect(text).toContain('patient: Test Patient');
    expect(text).toContain('allergy: penicillin');
    expect(text).toContain('history notes: sensitive teeth');
    expect(text).toContain('tooth 36 occlusal: discoloured');
    expect(text).toContain('visit 2026-11-19: pain in #36');
    expect(text).toContain('plan tooth 36: filling');
  });
});

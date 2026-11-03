import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMEZONE } from '@/lib/datetime';
import { settingsFromMap, timezoneFrom } from './queries';

describe('timezoneFrom', () => {
  it('keeps a valid IANA timezone', () => {
    expect(timezoneFrom({ timezone: 'Africa/Addis_Ababa' })).toBe('Africa/Addis_Ababa');
  });

  it('keeps valid aliases that Intl accepts but supportedValuesOf omits', () => {
    expect(timezoneFrom({ timezone: 'UTC' })).toBe('UTC');
  });

  it('falls back to the default for a legacy/invalid timezone', () => {
    expect(timezoneFrom({ timezone: 'Africa/Addis Ababa' })).toBe(DEFAULT_TIMEZONE);
    expect(timezoneFrom({ timezone: 'Mars/Olympus' })).toBe(DEFAULT_TIMEZONE);
  });

  it('falls back to the default for missing or non-string values', () => {
    expect(timezoneFrom({})).toBe(DEFAULT_TIMEZONE);
    expect(timezoneFrom({ timezone: '' })).toBe(DEFAULT_TIMEZONE);
    expect(timezoneFrom({ timezone: 42 })).toBe(DEFAULT_TIMEZONE);
  });
});

describe('settingsFromMap', () => {
  it('uses the default timezone when the stored value is invalid', () => {
    expect(settingsFromMap({ timezone: 'Africa/Addis Ababa' }).timezone).toBe(DEFAULT_TIMEZONE);
  });
});

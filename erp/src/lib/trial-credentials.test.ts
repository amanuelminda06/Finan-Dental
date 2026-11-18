import { describe, expect, it } from 'vitest';
import { resolveTrialRole, TRIAL_LOGINS, trialEmail, trialLogin } from './trial-credentials';

describe('trial credentials', () => {
  it('defines one fixed login per trial role', () => {
    expect(TRIAL_LOGINS.map((login) => login.shortName)).toEqual(['owner', 'reception', 'doctor']);
    for (const login of TRIAL_LOGINS) expect(login.password).toBe(`${login.shortName}123`);
  });

  it('maps short names to roles without exposing them globally', () => {
    expect(resolveTrialRole('OWNER')).toBe('OWNER');
    expect(resolveTrialRole(' doctor ')).toBe('STAFF');
    expect(resolveTrialRole('reception')).toBe('RECEPTION');
    expect(resolveTrialRole('someone@example.test')).toBeNull();
  });

  it('scopes generated emails to the tenant', () => {
    expect(trialEmail('bright-dental', 'OWNER')).toBe('owner@bright-dental.test');
    expect(trialLogin('STAFF').name).toBe('Clinic Dentist');
  });
});

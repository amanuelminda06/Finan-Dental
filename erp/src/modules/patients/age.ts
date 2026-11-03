/**
 * Patients are entered as an age in years and stored as an approximate birth
 * date (the moment they were that age), so birthday-based messaging still has
 * a date to work with.
 */
export const MAX_AGE_YEARS = 150;

/** Whole years between `birthDate` and `now`. */
export function ageInYears(birthDate: Date, now: Date = new Date()): number {
  const years = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const months = now.getUTCMonth() - birthDate.getUTCMonth();
  if (months < 0) return years - 1;
  if (months === 0 && now.getUTCDate() < birthDate.getUTCDate()) return years - 1;
  return years;
}

/** Midnight UTC calendar date for someone who is `age` years old today. */
export function birthDateFromAge(age: number, now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), now.getUTCDate()),
  );
}

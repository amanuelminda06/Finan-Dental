export const brand = {
  clinicName: "Finan Speciality Dental Clinic",
  shortName: "Finan",
  dentist: "Dr. Selamawit Abraham",
  tagline: "",
  address: "Abrams Building, 2nd Floor",
  phones: ["0948023831", "0911055655"],
  email: "shalomwordi@gmail.com",
  telegram: "@finan8",
  smsSenderName: process.env.SMS_SENDER_NAME ?? 'FinanDental',
  currency: "ETB",
  timezone: "Africa/Addis_Ababa",
  locales: ["en", "am"] as const,
  colors: {
    primary: "#129CF4",
    secondary: "#80BD08",
    accent: "#FFFFFF",
  },
  trialBanner: process.env.NEXT_PUBLIC_TRIAL_BANNER === "true",
} as const;

export function telLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("0")
    ? "+251" + digits.slice(1)
    : digits.startsWith("251")
      ? "+" + digits
      : "+" + digits;
  return `tel:${intl}`;
}

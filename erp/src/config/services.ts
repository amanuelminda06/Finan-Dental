export type ServiceItem = {
  id: string;
  nameEn: string;
  nameAm: string;
  descriptionEn: string;
  descriptionAm: string;
  price: number | null;
};

export const services: ServiceItem[] = [
  { id: "free-consultation", nameEn: "Free Consultation", nameAm: "ነፃ የምክር አገልግሎት", descriptionEn: "Initial consultation at no cost.", descriptionAm: "የመጀመሪያ ምክር በነፃ.", price: 0 },
  { id: "cleaning", nameEn: "Modern Teeth Cleaning and Polishing", nameAm: "በዘመናዊ መንገድ ጥርስ ማጠብና ማጽዳት", descriptionEn: "Professional cleaning and polishing.", descriptionAm: "ሙያዊ ማጽዳትና ማንጣት.", price: null },
  { id: "gum-treatment", nameEn: "Gum Treatment", nameAm: "የድድ ሕክምና", descriptionEn: "Treatment for gum disease.", descriptionAm: "የድድ በሽታ ሕክምና.", price: null },
  { id: "filling", nameEn: "Dental Filling and Treatment of Cavities", nameAm: "የተቦረቦሩ ጥርሶችን ማከምና መሙላት", descriptionEn: "Fillings and cavity treatment.", descriptionAm: "የተቦረቦረ ጥርስ ማከምና መሙላት.", price: null },
  { id: "braces", nameEn: "Braces and Orthodontic Treatment", nameAm: "የአበቃቀል ችግር ያለባቸውን እና የተዛነፉ ጥርሶችን በብሬስ ማስተካከል", descriptionEn: "Correction of misaligned teeth and bite problems.", descriptionAm: "የተዛነፉ ጥርሶችን እና የአበቃቀል ችግር ማስተካከል.", price: null },
  { id: "implants", nameEn: "Permanent Dental Implants", nameAm: "ሰው ሰራሽ ጥርስ በቋሚነት መትከል", descriptionEn: "Permanent artificial tooth implants.", descriptionAm: "ቋሚ ሰው ሰራሽ ጥርስ መትከል.", price: null },
  { id: "extraction", nameEn: "Tooth Extraction", nameAm: "በሕክምና መዳን የማይችል ጥርስ መንቀል", descriptionEn: "Removal of unsalvageable teeth.", descriptionAm: "መዳን የማይችል ጥርስ መንቀል.", price: null },
  { id: "whitening", nameEn: "Modern Teeth Whitening", nameAm: "ጥርስን በዘመናዊ መሳሪያ ማንጣት", descriptionEn: "Modern teeth whitening.", descriptionAm: "በዘመናዊ መሳሪያ ጥርስ ማንጣት.", price: null },
  { id: "halitosis", nameEn: "Bad Breath (Halitosis) Treatment", nameAm: "መጥፎ የአፍ ሽታ ሕክምና", descriptionEn: "Treatment for bad breath.", descriptionAm: "መጥፎ የአፍ ሽታ ሕክምና.", price: null },
];

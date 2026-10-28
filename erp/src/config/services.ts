export type Service = {
  nameEn: string;
  nameAm: string;
  descriptionEn: string;
  descriptionAm: string;
  category: string;
  price: number | null;
};

/** Shared public and ERP service catalog. Prices are deliberately unset until supplied by the clinic. */
export const SERVICES: Service[] = [
  { nameEn: 'Free Consultation', nameAm: 'ነፃ የምክር አገልግሎት', descriptionEn: 'A complimentary dental consultation and oral health assessment.', descriptionAm: 'ነፃ የጥርስ ምክር እና የአፍ ጤና ግምገማ ያግኙ።', category: 'consultation', price: 0 },
  { nameEn: 'Modern Teeth Cleaning and Polishing', nameAm: 'በዘመናዊ መንገድ ጥርስ ማጠብና ማጽዳት', descriptionEn: 'Professional teeth cleaning and polishing with modern equipment.', descriptionAm: 'በዘመናዊ መሣሪያዎች ሙያዊ የጥርስ ማጽዳት እና ማለስለስ።', category: 'other', price: null },
  { nameEn: 'Gum Treatment', nameAm: 'የድድ ሕክምና', descriptionEn: 'Assessment and care for gum health concerns.', descriptionAm: 'የድድ ጤና ችግሮችን ለመመርመርና ለማከም የሚሰጥ እንክብካቤ።', category: 'specialist', price: null },
  { nameEn: 'Dental Filling and Treatment of Cavities', nameAm: 'የተቦረቦሩ ጥርሶችን ማከምና መሙላት', descriptionEn: 'Care to treat cavities and restore affected teeth with fillings.', descriptionAm: 'የተቦረቦሩ ጥርሶችን ለማከምና በሙሌት ለመጠገን የሚሰጥ እንክብካቤ።', category: 'other', price: null },
  { nameEn: 'Braces and Orthodontic Treatment', nameAm: 'የአበቃቀል ችግር ያለባቸውን እና የተዛነፉ ጥርሶችን በብሬስ ማስተካከል', descriptionEn: 'Orthodontic care to align teeth with braces.', descriptionAm: 'ጥርሶችን በብሬስ ለማስተካከል የሚሰጥ የአበቃቀል ሕክምና።', category: 'specialist', price: null },
  { nameEn: 'Permanent Dental Implants', nameAm: 'ሰው ሰራሽ ጥርስ በቋሚነት መትከል', descriptionEn: 'Dental implants to replace missing teeth permanently.', descriptionAm: 'የጠፉ ጥርሶችን በቋሚ የጥርስ ተከላ ለመተካት የሚሰጥ አገልግሎት።', category: 'other', price: null },
  { nameEn: 'Tooth Extraction', nameAm: 'በሕክምና መዳን የማይችል ጥርስ መንቀል', descriptionEn: 'Safe removal of a tooth that cannot be restored.', descriptionAm: 'በሕክምና መዳን የማይችል ጥርስን በደህንነት ለማንቀል የሚሰጥ አገልግሎት።', category: 'surgery', price: null },
  { nameEn: 'Modern Teeth Whitening', nameAm: 'ጥርስን በዘመናዊ መሳሪያ ማንጣት', descriptionEn: 'Professional teeth whitening using modern equipment.', descriptionAm: 'በዘመናዊ መሣሪያ የሚደረግ ሙያዊ የጥርስ ማንጣት።', category: 'other', price: null },
  { nameEn: 'Bad Breath (Halitosis) Treatment', nameAm: 'መጥፎ የአፍ ሽታ ሕክምና', descriptionEn: 'Assessment and care to help address bad breath.', descriptionAm: 'የመጥፎ የአፍ ሽታ መንስኤን ለመመርመርና ለማከም የሚሰጥ እንክብካቤ።', category: 'specialist', price: null },
];
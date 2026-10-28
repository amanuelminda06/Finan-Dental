export type Service = {
  nameEn: string;
  nameAm: string;
  descriptionEn: string;
  descriptionAm: string;
  price: number | null;
};

export const SERVICES: Service[] = [
  { nameEn: 'Free Consultation', nameAm: 'ነፃ የምክር አገልግሎት', descriptionEn: 'Complimentary dental consultation and oral health assessment.', descriptionAm: 'ነፃ የጥርስ ምክር እና የአፍ ጤና ግምገማ።', price: 0 },
  { nameEn: 'Modern Teeth Cleaning and Polishing', nameAm: 'በዘመናዊ መንገድ ጥርስ ማጠብና ማጽዳት', descriptionEn: 'Professional cleaning and polishing using modern equipment.', descriptionAm: 'በዘመናዊ መሳሪያዎች ሙያዊ ጽዳት እና ማጽዳት።', price: null },
  { nameEn: 'Gum Treatment', nameAm: 'የድድ ሕክምና', descriptionEn: 'Treatment for gum disease and inflammation.', descriptionAm: 'የድድ በሽታ እና ትኩሳት ሕክምና።', price: null },
  { nameEn: 'Dental Filling and Treatment of Cavities', nameAm: 'የተቦረቦሩ ጥርሶችን ማከምና መሙላት', descriptionEn: 'Filling and restoration of decayed teeth.', descriptionAm: 'የተ Derne decomposition ጥርሶች ሕክምና እና መሙላት።', price: null },
  { nameEn: 'Braces and Orthodontic Treatment', nameAm: 'የአበቃቀል ችግር ያለባቸውን እና የተዛነፉ ጥርሶችን በብሬስ ማስተካከል', descriptionEn: 'Orthodontic correction of misaligned teeth with braces.', descriptionAm: 'የተዛነፉ ጥርሶችን በብሬስ ማስተካከል።', price: null },
  { nameEn: 'Permanent Dental Implants', nameAm: 'ሰው ሰራሽ ጥርስ በቋሚነት መትከል', descriptionEn: 'Permanent replacement of missing teeth with implants.', descriptionAm: 'የጠፉ ጥርሶች በቋሚነት መተካት።', price: null },
  { nameEn: 'Tooth Extraction', nameAm: 'በሕክምና መዳን የማይችል ጥርስ መንቀል', descriptionEn: 'Extraction of teeth that cannot be saved.', descriptionAm: 'መዳን የማይችሉ ጥርሶችን መንቀል።', price: null },
  { nameEn: 'Modern Teeth Whitening', nameAm: 'ጥርስን በዘመናዊ መሳሪያ ማንጣት', descriptionEn: 'Professional teeth whitening with modern equipment.', descriptionAm: 'በዘመናዊ መሳሪያ ሙያዊ ጥርስ ማንጣት።', price: null },
  { nameEn: 'Bad Breath (Halitosis) Treatment', nameAm: 'መጥፎ የአፍ ሽታ ሕክምና', descriptionEn: 'Diagnosis and treatment of chronic bad breath.', descriptionAm: 'የረጅም ጊዜ የአፍ ሽታ ምርመራ እና ሕክምና።', price: null },
];
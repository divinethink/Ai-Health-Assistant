// MyCare — UI-লেবেল (bn/en) এক জায়গায়। enum-মান carePrefsSchema.js-এর সাথে মেলে। pure।
export const CAT_META = [
  ["skin", "ত্বক", "Skin Care", "#1F7A5C"],
  ["hair", "চুল", "Hair Care", "#3B82B6"],
  ["oral", "দাঁত ও মুখ", "Oral Care", "#D08A2E"],
  ["body", "শরীর", "Body Care", "#7A5BB0"],
  ["seasonal", "ঋতুভিত্তিক", "Seasonal Care", "#C25B3A"],
  ["natural", "প্রাকৃতিক", "Natural Care", "#3F7F6A"],
];

const P = (bn, en) => ({ bn, en });
export const LABELS = {
  skinType: { oily: P("তৈলাক্ত", "Oily"), dry: P("শুষ্ক", "Dry"), normal: P("স্বাভাবিক", "Normal"), combination: P("মিশ্র", "Combination"), sensitive: P("সংবেদনশীল", "Sensitive") },
  hairType: { oily: P("তৈলাক্ত", "Oily"), dry: P("শুষ্ক", "Dry"), normal: P("স্বাভাবিক", "Normal"), curly: P("কোঁকড়া", "Curly") },
  skinConcerns: { acne: P("ব্রণ", "Acne"), scars: P("দাগ", "Marks"), dryness: P("শুষ্কতা", "Dryness"), irritation: P("জ্বালা", "Irritation"), itching: P("চুলকানি", "Itching") },
  hairConcerns: { dandruff: P("খুশকি", "Dandruff"), itching: P("চুলকানি", "Itching"), oiliness: P("তৈলাক্ততা", "Oiliness"), hairfall: P("চুল পড়া", "Hair fall"), dryness: P("রুক্ষতা", "Dryness") },
  oralConcerns: { gums: P("মাড়ি", "Gums"), sensitivity: P("সংবেদনশীলতা", "Sensitivity"), "bad-breath": P("মুখের গন্ধ", "Bad breath"), stains: P("দাঁতের দাগ", "Stains"), "dry-mouth": P("মুখ শুকনো", "Dry mouth") },
  preferences: { general: P("সাধারণ", "General"), herbal: P("ভেষজ", "Herbal"), ayurvedic: P("আয়ুর্বেদিক", "Ayurvedic"), budget: P("বাজেট", "Budget") },
  avoidIf: { pregnancy: P("গর্ভাবস্থা", "Pregnancy"), breastfeeding: P("বুকের দুধ খাওয়ানো", "Breastfeeding"), under18: P("১৮ বছরের নিচে", "Under 18"), under2: P("২ বছরের নিচে", "Under 2"), kidney: P("কিডনি রোগ", "Kidney disease"), liver: P("লিভারের রোগ", "Liver disease") },
  sex: { male: P("পুরুষ", "Male"), female: P("নারী", "Female") },
};

// "অন্যের জন্য" মোডের বয়স-পরিসর → প্রতিনিধি বয়স (বছর)
export const AGE_BANDS = [
  ["under2", "২ বছরের নিচে", "Under 2", 1],
  ["child", "২–১১ বছর", "2–11 yrs", 6],
  ["teen", "১২–১৭ বছর", "12–17 yrs", 15],
  ["adult", "১৮–৫৯ বছর", "18–59 yrs", 30],
  ["senior", "৬০+ বছর", "60+ yrs", 65],
];

// ধরন/সমস্যা-তালিকা বিভাগ-অনুযায়ী (ধাপ ৪-এ skin/hair/oral)
export const CONCERN_KEY = { skin: "skinConcerns", hair: "hairConcerns", oral: "oralConcerns" };
export const TYPE_KEY = { skin: "skinType", hair: "hairType" };

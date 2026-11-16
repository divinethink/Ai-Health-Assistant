// "সাধারণ চিকিৎসা ▸ Homeopathy" — শুধু ধারণার জন্য ঐতিহ্যগত তথ্য (কোডে স্থির; Firestore-এ নয়)।
// উৎস: Boericke-এর Materia Medica (Homoeopathic Materia Medica) ও National Center for Homeopathy-র ঐতিহ্যগত ব্যবহার-তালিকা।
// নিয়ম (Roadmap §৬): Evidence Level ৩ (ঐতিহ্যগত); "কার্যকর/নিরাময়" ভাষা নয়; ডোজ এই ফাইলে নেই — সাধারণ-জ্ঞান মাত্রা আলাদা `commonCareDose.js`-এ।
// kid:true = শিশু-কেন্দ্রিক এন্ট্রি। ফার্মাসিস্ট/হোমিও-চিকিৎসক রিভিউ হয়নি (draft)।
export const HOMEO_SOURCE = "Boericke Materia Medica · NCH";
export const HOMEO_DISCLAIMER = "নিয়ন্ত্রিত বৈজ্ঞানিক পর্যালোচনায় placebo-র তুলনায় অতিরিক্ত কার্যকারিতার নির্ভরযোগ্য প্রমাণ পাওয়া যায়নি। নিচের তালিকা শুধু ঐতিহ্যগত ব্যবহারের ধারণা; এটি চিকিৎসার পরামর্শ নয়।";
export const COMMON_HOMEO_DEFAULTS = [
  { key: "h-fever", disease: "জ্বর (শুরুর দিকে)", items: ["Aconitum napellus", "Belladonna", "Ferrum phosphoricum"], note: "৩ দিনের বেশি জ্বর, শিশুর জ্বর বা ডেঙ্গুর সন্দেহে আগে ডাক্তার।" },
  { key: "h-cold", disease: "সর্দি / নাক দিয়ে পানি পড়া", items: ["Allium cepa", "Nux vomica", "Arsenicum album"], note: "জ্বর, শ্বাসকষ্ট বা ১০ দিনের বেশি থাকলে ডাক্তার।" },
  { key: "h-dry-cough", disease: "শুকনো কাশি", items: ["Bryonia alba", "Drosera rotundifolia", "Rumex crispus"], note: "দুই সপ্তাহের বেশি কাশি হলে ডাক্তার (TB-র সম্ভাবনা বাদ দিতে)।" },
  { key: "h-wet-cough", disease: "কফওয়ালা কাশি", items: ["Antimonium tartaricum", "Pulsatilla nigricans", "Ipecacuanha"], note: "দ্রুত শ্বাস, বুক দেবে যাওয়া বা ঠোঁট নীলচে হলে জরুরি চিকিৎসা।" },
  { key: "h-throat", disease: "গলাব্যথা", items: ["Belladonna", "Mercurius solubilis", "Phytolacca decandra"], note: "গিলতে বা শ্বাসে কষ্ট হলে অপেক্ষা নয়, ডাক্তার।" },
  { key: "h-headache", disease: "মাথাব্যথা", items: ["Belladonna", "Bryonia alba", "Natrum muriaticum", "Gelsemium sempervirens"], note: "হঠাৎ তীব্র ব্যথা, জ্বরসহ ঘাড় শক্ত, বা বারবার হলে ডাক্তার।" },
  { key: "h-gas", disease: "গ্যাস / পেট ফাঁপা", items: ["Carbo vegetabilis", "Lycopodium clavatum", "China officinalis"], note: "তীব্র ব্যথা, বমি বা পায়খানা বন্ধ হলে ডাক্তার।" },
  { key: "h-acidity", disease: "অম্বল / বুক জ্বালা", items: ["Nux vomica", "Robinia pseudoacacia", "Natrum phosphoricum"], note: "বুকে চাপ/ব্যথা হৃদরোগের লক্ষণ হতে পারে; সন্দেহ হলে জরুরি সেবা।" },
  { key: "h-indigestion", disease: "বদহজম", items: ["Nux vomica", "Pulsatilla nigricans", "Antimonium crudum"], note: "বারবার হলে বা ওজন কমলে ডাক্তার।" },
  { key: "h-colic", disease: "পেটব্যথা / মোচড়ানো ব্যথা", items: ["Colocynthis", "Magnesia phosphorica", "Dioscorea villosa"], note: "তীব্র বা একদিকে স্থির ব্যথা, জ্বর, বমি হলে ডাক্তার।" },
  { key: "h-diarrhoea", disease: "পাতলা পায়খানা", items: ["Arsenicum album", "Podophyllum peltatum", "Veratrum album", "China officinalis"], note: "আগে খাবার স্যালাইন (ORS)। রক্ত, জ্বর বা পানিশূন্যতা হলে ডাক্তার।" },
  { key: "h-constipation", disease: "কোষ্ঠকাঠিন্য", items: ["Nux vomica", "Bryonia alba", "Alumina"], note: "পানি ও আঁশযুক্ত খাবার আগে। মলে রক্ত বা এক সপ্তাহের বেশি হলে ডাক্তার।" },
  { key: "h-nausea", disease: "বমি বমি ভাব / ভ্রমণে বমি", items: ["Ipecacuanha", "Nux vomica", "Cocculus indicus", "Tabacum"], note: "বারবার বমিতে পানিশূন্যতা হতে পারে; ডাক্তার দেখান।" },
  { key: "h-period", disease: "মাসিকের ব্যথা", items: ["Magnesia phosphorica", "Colocynthis", "Pulsatilla nigricans", "Cimicifuga racemosa"], note: "অতিরিক্ত রক্তপাত বা ব্যথা স্বাভাবিক কাজ আটকে দিলে ডাক্তার।" },
  { key: "h-allergy", disease: "এলার্জি / হাঁচি", items: ["Allium cepa", "Sabadilla", "Arsenicum album", "Natrum muriaticum"], note: "ঠোঁট-মুখ ফোলা বা শ্বাসকষ্ট হলে জরুরি সেবা।" },
  { key: "h-eye", disease: "চোখ লাল / চোখ জ্বালা", items: ["Euphrasia officinalis", "Pulsatilla nigricans", "Argentum nitricum"], note: "দৃষ্টি ঝাপসা, তীব্র ব্যথা বা পুঁজ হলে চক্ষু-চিকিৎসক।" },
  { key: "h-ear", disease: "কানব্যথা", items: ["Belladonna", "Pulsatilla nigricans", "Chamomilla", "Hepar sulphuris"], note: "জ্বর বা কান থেকে পুঁজ/তরল হলে ডাক্তার। কানে কিছু ঢালবেন না।" },
  { key: "h-tooth", disease: "দাঁতব্যথা", items: ["Chamomilla", "Coffea cruda", "Mercurius solubilis", "Plantago major"], note: "যেকোনো দাঁতব্যথায় দাঁতের ডাক্তার দেখানো দরকার।" },
  { key: "h-sprain", disease: "মচকানো / আঘাত / কালশিটে", items: ["Arnica montana", "Rhus toxicodendron", "Ruta graveolens", "Symphytum officinale"], note: "নড়াতে না পারলে, খুব ফুললে বা বিকৃত দেখালে ডাক্তার (হাড় ভাঙতে পারে)।" },
  { key: "h-wound", disease: "কাটা-ছেঁড়া / সামান্য ক্ষত", items: ["Calendula officinalis (বাহ্যিক)", "Hypericum perforatum", "Ledum palustre"], note: "গভীর ক্ষত, রক্ত না থামা, কামড় বা টিটেনাস-টিকা অনিশ্চিত হলে ডাক্তার।" },
  { key: "h-skin", disease: "ফুসকুড়ি / চুলকানি / আমবাত", items: ["Sulphur", "Rhus toxicodendron", "Urtica urens", "Apis mellifica"], note: "দ্রুত ছড়ালে, জ্বর বা শ্বাসকষ্টসহ হলে ডাক্তার।" },
  { key: "h-sleep", disease: "অনিদ্রা", items: ["Coffea cruda", "Nux vomica", "Passiflora incarnata"], note: "দুই সপ্তাহের বেশি হলে ডাক্তার।" },
  { key: "h-anxiety", disease: "ভয় / দুশ্চিন্তা / পরীক্ষার চাপ", items: ["Argentum nitricum", "Gelsemium sempervirens", "Ignatia amara"], note: "দৈনন্দিন জীবন ব্যাহত হলে বা নিজেকে ক্ষতির চিন্তা এলে এখনই মানুষের সাহায্য নিন।" },
  { key: "h-mouth", disease: "মুখের ঘা", items: ["Mercurius solubilis", "Borax", "Nitricum acidum"], note: "দুই সপ্তাহের বেশি থাকলে বা ব্যথাহীন শক্ত দাগ হলে ডাক্তার।" },
  { key: "h-insect", disease: "পোকার কামড় / হুল", items: ["Ledum palustre", "Apis mellifica"], note: "মুখ-ঠোঁট ফোলা বা শ্বাসকষ্ট হলে জরুরি সেবা।" },
  { key: "h-kid-teething", kid: true, disease: "শিশুর দাঁত ওঠার কষ্ট", items: ["Chamomilla", "Calcarea phosphorica"], note: "শিশুর উচ্চ জ্বর বা পাতলা পায়খানাকে দাঁত ওঠার দোষ দেবেন না; ডাক্তার দেখান।" },
  { key: "h-kid-colic", kid: true, disease: "শিশুর পেটব্যথা / কান্না (কোলিক)", items: ["Chamomilla", "Colocynthis", "Magnesia phosphorica"], note: "জ্বর, সবুজ বা রক্তমাখা বমি/মল, ফোলা পেট, বা কান্না না থামলে এখনই ডাক্তার।" },
  { key: "h-kid-nose", kid: true, disease: "শিশুর নাক বন্ধ / ঘড়ঘড়", items: ["Sambucus nigra", "Allium cepa"], note: "দুধ খেতে না পারলে বা শ্বাসে কষ্ট হলে জরুরি ডাক্তার।" },
  { key: "h-kid-diaper", kid: true, disease: "শিশুর ন্যাপির র‍্যাশ", items: ["Calendula officinalis (বাহ্যিক)", "Sulphur"], note: "ফোসকা, ঘা বা ছত্রাক-সন্দেহে ডাক্তার। জায়গা শুকনো ও পরিষ্কার রাখুন।" },
];

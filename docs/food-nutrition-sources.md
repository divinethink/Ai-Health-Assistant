# খাবারের পুষ্টি — উৎস ও যাচাই (ব্যাচ A: ভাত-রুটি + তরকারি-ডাল, ৪১টি)

**পদ্ধতি:** প্রতি ১০০ গ্রামের মান (kcal, প্রোটিন, কার্ব(ফাইবারসহ), ফ্যাট, ফাইবার)। `table` = তালিকার সরাসরি মান; `recipe` = উপাদান × গ্রাম ÷ রান্নার ওজন × ১০০। রান্নার ওজন ও উপাদানের পরিমাণ আমার ধরা গড় রেসিপি — আপনার বাসার রান্নায় ±১০–১৫% বা বেশি তফাত স্বাভাবিক।

**যাচাইয়ের অবস্থা (সৎ হিসাব):** ✅ = এই সেশনে উৎস-পাতা (USDA FoodData Central) খুলে মিলিয়ে দেখা। ⏳ = রেফারেন্স-মান (USDA/IFCT-এর সাধারণ মান), উৎস-পাতা খুলে মেলানো হয়নি — স্পট-চেক বাকি। এই ব্যাচে `chk=1` খাবার: rice, redRice, redRoti, kanchaKola, kochu, sprouts।

**স্বয়ংক্রিয় টেস্ট (`tests/tracker/foodNutrition.test.mjs`):** Atwater-সঙ্গতি (±১০% বা ৬ kcal), ডিফল্ট মাপের kcal বিদ্যমান ক্যাটালগের ±১৫%, মাপ/সংখ্যার বৈধতা — সব পাস।

## উপাদান (প্রতি ১০০ গ্রাম)

| উপাদান | kcal | প্রো | কার্ব | ফ্যাট | ফাইবার | যাচাই | উৎস |
|---|---|---|---|---|---|---|---|
| rice_cooked | 130 | 2.69 | 28.2 | 0.28 | 0.4 | ✅ | USDA FDC 168878 |
| brown_cooked | 112 | 2.32 | 23.5 | 0.83 | 1.8 | ✅ | USDA FDC 168875 |
| plantain_green | 152 | 1.25 | 36.7 | 0.07 | 2.2 | ✅ | USDA FDC 168215 |
| taro | 112 | 1.5 | 26.5 | 0.2 | 4.1 | ✅ | USDA FDC 169308 |
| wholewheat | 340 | 13.2 | 72 | 2.5 | 10.7 | ✅ | USDA FDC 168893 |
| potato_boiled | 87 | 1.87 | 20.1 | 0.1 | 1.8 | ✅ | USDA FDC 170438 |
| sprouts | 30 | 3.04 | 5.94 | 0.18 | 1.8 | ✅ | USDA FDC 169957 |
| oil | 884 | 0 | 0 | 100 | 0 | ✅ | pure fat |
| sugar | 387 | 0 | 100 | 0 | 0 | ✅ | pure sugar |
| rice_raw | 365 | 7.13 | 80 | 0.66 | 1.3 | ⏳ | USDA (recalled; kcal 365 seen) |
| potato_raw | 77 | 2.05 | 17.5 | 0.09 | 2.1 | ⏳ | USDA (recalled) |
| masoor | 352 | 24.6 | 63.4 | 1.06 | 10.7 | ⏳ | USDA (recalled) |
| moong | 347 | 23.9 | 62.6 | 1.15 | 16.3 | ⏳ | USDA (recalled) |
| chickpea_boiled | 164 | 8.86 | 27.4 | 2.59 | 7.6 | ⏳ | USDA (recalled) |
| onion | 40 | 1.1 | 9.34 | 0.1 | 1.7 | ⏳ | USDA (recalled) |
| tomato | 18 | 0.88 | 3.9 | 0.2 | 1.2 | ⏳ | USDA (recalled) |
| atta_white | 364 | 10.3 | 76.3 | 1 | 2.7 | ⏳ | USDA all-purpose flour (recalled) |
| cucumber | 15 | 0.65 | 3.6 | 0.11 | 0.5 | ⏳ | USDA (recalled) |
| mixveg | 32 | 1.8 | 6.5 | 0.2 | 2.5 | ⏳ | estimate (carrot/bean/cauli/potato mix) |
| bottle_gourd | 14 | 0.62 | 3.39 | 0.02 | 0.5 | ⏳ | USDA (recalled) |
| ridge_gourd | 20 | 1.2 | 4.4 | 0.2 | 1 | ⏳ | USDA/IFCT (recalled) |
| pointed_gourd | 24 | 2 | 5.2 | 0.3 | 3 | ⏳ | IFCT (recalled, low confidence) |
| spinach | 23 | 2.86 | 3.63 | 0.39 | 2.2 | ⏳ | USDA (recalled) |
| okra | 33 | 1.93 | 7.45 | 0.19 | 3.2 | ⏳ | USDA (recalled) |
| bitter_gourd | 17 | 1 | 3.7 | 0.17 | 2.8 | ⏳ | USDA (recalled) |
| eggplant | 25 | 0.98 | 5.88 | 0.18 | 3 | ⏳ | USDA (recalled) |
| pumpkin | 26 | 1 | 6.5 | 0.1 | 0.5 | ⏳ | USDA (recalled) |
| kakrol | 30 | 3.1 | 4.5 | 0.3 | 3 | ⏳ | IFCT-ish (low confidence) |
| semolina | 360 | 12.7 | 72.8 | 1.05 | 3.9 | ⏳ | USDA (recalled) |
| chira_raw | 346 | 6.6 | 77.3 | 1.2 | 1 | ⏳ | IFCT (recalled) |
| redchira_raw | 346 | 7.5 | 75 | 1.8 | 2.5 | ⏳ | estimate from beaten rice (low confidence) |
| muri | 402 | 6 | 90 | 0.5 | 1 | ⏳ | USDA puffed rice cereal (recalled) |
| egg_noodle_dry | 384 | 14.2 | 71.3 | 4.44 | 3.3 | ⏳ | USDA (recalled) |
| oats_raw | 379 | 13.2 | 67.7 | 6.5 | 10.1 | ⏳ | USDA (recalled) |
| chicken_raw | 120 | 21.4 | 0 | 3.1 | 0 | ⏳ | USDA meat only (recalled) |
| beef_raw | 150 | 20.5 | 0 | 7 | 0 | ⏳ | estimate, lean-ish (low confidence) |
| yogurt | 61 | 3.5 | 4.7 | 3.3 | 0 | ⏳ | USDA whole-milk yogurt (recalled) |

## খাবার

| key | kcal/100g | প্রো | কার্ব | ফ্যাট | ফাইবার | ধরন | যাচাই | মাপ (গ্রাম) | রেসিপি (কাঁচা গ্রাম → রান্নার ওজন) |
|---|---|---|---|---|---|---|---|---|---|
| rice | 130 | 2.7 | 28.2 | 0.3 | 0.4 | table | ✅ | কাপ 160g; প্লেট 250g | — |
| roti | 262 | 6.9 | 50.9 | 2.9 | 1.8 | recipe | ⏳ | টি 32g | atta_white 30, oil 1 → 45g |
| porota | 335 | 6.6 | 49 | 12.1 | 1.7 | recipe | ⏳ | টি 70g | atta_white 45, oil 8 → 70g |
| pauruti | 266 | 8.8 | 50.6 | 3.3 | 2.4 | table | ⏳ | স্লাইস 28g | — |
| khichuri | 134 | 3.8 | 22.1 | 3.3 | 1.9 | recipe | ⏳ | বাটি 190g | rice_raw 50, moong 25, oil 8, onion 20 → 260g |
| polao | 184 | 2.6 | 29.2 | 6 | 0.6 | recipe | ⏳ | কাপ 135g | rice_raw 50, oil 8, onion 10 → 140g |
| biryaniChicken | 155 | 6.4 | 18.4 | 5.9 | 0.4 | recipe | ⏳ | প্লেট 320g | rice_raw 70, chicken_raw 70, oil 16, onion 25, yogurt 10 → 320g |
| tehari | 150 | 5.3 | 17.5 | 6.3 | 0.4 | recipe | ⏳ | প্লেট 340g | rice_raw 70, beef_raw 60, oil 16, onion 20 → 330g |
| noodles | 129 | 4 | 19.6 | 3.8 | 1.2 | recipe | ⏳ | বাটি 190g | egg_noodle_dry 50, oil 5, mixveg 25 → 190g |
| chira | 138 | 2.6 | 30.9 | 0.5 | 0.4 | recipe | ⏳ | বাটি 105g | chira_raw 42 → 105g |
| oats | 71 | 2.5 | 12 | 1.5 | 1.7 | table | ⏳ | বাটি 210g | — |
| redRice | 112 | 2.3 | 23.5 | 0.8 | 1.8 | table | ✅ | কাপ 155g | — |
| redRoti | 246 | 8.8 | 48 | 3.9 | 7.1 | recipe | ✅ | টি 32g | wholewheat 30, oil 1 → 45g |
| redChira | 132 | 2.9 | 28.6 | 0.7 | 1 | recipe | ⏳ | বাটি 105g | redchira_raw 40 → 105g |
| sujiHalua | 155 | 2.4 | 25.5 | 4.8 | 0.8 | recipe | ⏳ | বাটি 130g | semolina 25, sugar 15, oil 6 → 130g |
| muriMakha | 299 | 3.6 | 52.3 | 7.8 | 1.1 | recipe | ⏳ | বাটি 40g | muri 22, oil 3, onion 12 → 40g |
| vegKhichuri | 71 | 2.3 | 11.9 | 1.6 | 1.5 | recipe | ⏳ | বাটি 280g | rice_raw 25, moong 15, oil 4, mixveg 60 → 280g |
| oatsVegKhichuri | 78 | 3 | 12.2 | 2.1 | 2.5 | recipe | ⏳ | বাটি 240g | oats_raw 30, moong 10, oil 3, mixveg 60 → 250g |
| ataPancake | 189 | 4.3 | 30.2 | 5.4 | 1.6 | recipe | ⏳ | টি 80g | atta_white 30, mixveg 20, oil 4 → 80g |
| dal | 70 | 3.2 | 8.8 | 2.7 | 1.5 | recipe | ⏳ | বাটি 160g | masoor 20, oil 4, onion 10, tomato 10 → 160g |
| veg | 64 | 1.7 | 6 | 4 | 2.3 | recipe | ⏳ | বাটি 130g | mixveg 120, oil 5 → 130g |
| salad | 22 | 1 | 4.8 | 0.2 | 1.3 | recipe | ⏳ | বাটি 110g | cucumber 60, tomato 40, onion 10, mixveg 40 → 150g |
| aluBhorta | 110 | 1.7 | 18.3 | 3.6 | 1.7 | recipe | ⏳ | বাটি 115g | potato_boiled 100, oil 4, onion 10 → 115g |
| aluBhaji | 139 | 2.4 | 20.7 | 5.6 | 2.5 | recipe | ⏳ | বাটি 110g | potato_raw 130, oil 6 → 110g |
| shak | 76 | 5.4 | 6.8 | 4.5 | 4.1 | recipe | ⏳ | বাটি 80g | spinach 150, oil 3 → 80g |
| begunBhaja | 142 | 1.1 | 6.7 | 13.1 | 3.4 | recipe | ⏳ | টুকরা 35g | eggplant 40, oil 4.5 → 35g |
| korolaBhaji | 109 | 1.4 | 5.8 | 9.6 | 3.7 | recipe | ⏳ | বাটি 80g | bitter_gourd 100, oil 7.5, onion 10 → 80g |
| dherosBhaji | 104 | 2.7 | 10.5 | 6.7 | 4.5 | recipe | ⏳ | বাটি 85g | okra 120, oil 5.5 → 85g |
| chhola | 172 | 7.9 | 24.9 | 5.1 | 6.8 | recipe | ⏳ | বাটি 125g | chickpea_boiled 110, oil 3.5, onion 10 → 125g |
| mugDal | 61 | 2.9 | 8 | 2.1 | 2 | recipe | ⏳ | বাটি 150g | moong 18, oil 3, onion 8 → 150g |
| lau | 36 | 0.8 | 4.2 | 2.1 | 0.6 | recipe | ⏳ | বাটি 120g | bottle_gourd 150, oil 2.5 → 120g |
| patol | 48 | 2.4 | 6.1 | 2.6 | 3.5 | recipe | ⏳ | বাটি 110g | pointed_gourd 130, oil 2.5 → 110g |
| mishtiKumra | 52 | 1.4 | 8.9 | 2 | 0.7 | recipe | ⏳ | বাটি 110g | pumpkin 150, oil 2 → 110g |
| jhinge | 41 | 1.6 | 6 | 1.8 | 1.4 | recipe | ⏳ | বাটি 110g | ridge_gourd 150, oil 1.7 → 110g |
| palongShak | 45 | 4.8 | 6.1 | 1.4 | 3.7 | recipe | ⏳ | বাটি 90g | spinach 150, oil 0.7 → 90g |
| kakrol | 60 | 3.4 | 4.9 | 3.4 | 3.3 | recipe | ⏳ | বাটি 85g | kakrol 120, oil 3.4 → 110g |
| kanchaKola | 115 | 0.7 | 21.6 | 3 | 1.3 | recipe | ✅ | বাটি 85g | plantain_green 50, oil 2.5 → 85g |
| kochu | 106 | 1.1 | 18.7 | 3.2 | 2.9 | recipe | ✅ | বাটি 85g | taro 60, oil 2.6 → 85g |
| vegSoup | 22 | 0.9 | 3.1 | 0.9 | 1.2 | recipe | ⏳ | বাটি 250g | mixveg 120, oil 2 → 250g |
| daalSoup | 35 | 1.9 | 5.1 | 0.9 | 1 | recipe | ⏳ | বাটি 250g | masoor 18, oil 2, mixveg 20 → 250g |
| sprouts | 30 | 3 | 5.9 | 0.2 | 1.8 | table | ✅ | বাটি 100g | — |

## সতর্কতা / কম-নির্ভরযোগ্য
- `kakrol`, `patol`, `kochu`(মুখীকচু ধরা), `kanchaKola`(USDA green plantain 152 kcal ধরা; BD কাঁচা কলার জাত ভেদে কম হতে পারে), `beef_raw`, `mixveg` — কম আত্মবিশ্বাস।
- `pauruti`: USDA "Bread, white wheat"-এর পাতায় ফাইবার ৯.২ (হোল-গ্রেইন সাদা) পেয়েছি, তাই সেটা নিইনি; সাধারণ সাদা পাউরুটির মান রেফারেন্স থেকে (⏳)।
- রান্না-করা খাবারের একটি "সঠিক" সংখ্যা কোনো তালিকায় নেই; তেল/পানির পরিমাণে বদলায়।

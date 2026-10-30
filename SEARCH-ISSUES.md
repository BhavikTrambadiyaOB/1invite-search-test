# Search issues to fix (from search_report, 1,034 real queries)

Status: noted, not fixed. Checked 2026-10-30 against the current search (AI on).
"w/o filter" = results when that strict filter is removed.

## Summary

| Result count | Queries | Search problem | Missing designs |
|---|---|---|---|
| 0 | 18 | 15 | 3 |
| 1–9 | 91 | ~58 | ~33 |
| 10–39 | 101 | ~42 | ~56 (+3 correct filters) |
| **Total under 40** | **210** | **~115** | **~92** |

---

## A. Search problems (fix in code)

### A1. Card type is a hard filter, and "card / wishes / mubarak / greetings" force Greeting Card — 47 queries
Eid has 41 designs, only 6 are Greeting Cards, so every Eid wish search shows 6.
"card" also means invitation card in Indian / African English.

| Query | Now | w/o filter |
|---|---|---|
| eid mubarak, eid wishes, eid card, bakrid mubarak, eid ul adha mubarak … (36 variants) | 6 | 41 |
| nikah card | 5 | 1106 |
| retirement invitation card ("invitation" + "card" still → Greeting) | 4 | 78 |
| game card | 1 | 98 |
| marathi wedding cards (×3), wedding card odia | 0 | 1106 |
| mata ka jagran card | 0 | 6 |
| lobola invitation card | 0 | 1 |
| selamat hari raya aidiladha | 6 | 41 |
| free card eid mubarak (Greeting + Free) | 1 | 41 |
| graduation, ceremony, announcement (Announcement) | 3 | 144 |

Fix idea: "card"/"cards" not mapped to Greeting Card; with an occasion, card type ranks instead of filters.

### A2. Language is a hard filter — 18 queries
Almost all designs are English (10,852) and editable; few are Spanish (159), Hindi (64), Other (102).
Also "marathi" is read as Hindi, while Marathi cards are tagged Other.

| Query | Now | w/o filter |
|---|---|---|
| español, aniversario (×2) | 0 | 207 |
| gender reveal hindi | 0 | 233 |
| 50 wedding anniversary in marathi | 0 | 130 |
| anprashan card baby hindi (×3) | 0 | 9 |
| happy anniversary wishes marathi | 0 | 207 |
| español, celebración, graduación | 2 | 269 |
| gujarati, wedding | 4 | 1106 |
| baby naming ceremony marathi | 1 | 158 |
| marathi get together | 2 | 277 |
| funeral punjabi, telugu funeral ceremony | 4 | 206 |

Fix idea: with an occasion, language ranks (matching language first); map Marathi correctly.

### A3. Photo is a hard filter — 4 queries
| Query | Now | w/o filter |
|---|---|---|
| eid mubarak photos (×2) | 2 | 41 |
| racing invitation with pictures | 6 | 68 |
| uitnodiginh verjaardag bowlen met foto | 0 | 12 |

Fix idea: with an occasion, photo ranks instead of filters.

### A4. A small learned occasion takes over a common query — 3 queries
| Query | Read as | Now | Better |
|---|---|---|---|
| lunch party | Lunch Party (2 designs) | 8 | Brunch & luncheon designs (57+) |
| morning,event | Morning Greeting (2) | 5 | — |
| summer kick off | Summer Break Party (8) | 9 | summer / pool party designs |

### A5. To check — 1 query
| Query | Now | Note |
|---|---|---|
| success party | 8 | Read as Congratulations (90 designs) + "success"; should show more |

### A6. Other notes
- "time line" / "program" synonyms (wedding timeline vs wedding program): uncommitted change in progress; "rustic barn wedding" to re-check with it.

---

## B. Missing designs (content gaps, not search bugs)

### B1. No designs at all — 0 results
cv · e- magazine · tarpaulin

### B2. Very few designs for the occasion
| Occasion | Designs | Example queries |
|---|---|---|
| Umembeso / Umemulo | 1 | umembeso, umembeso invitation, umemulo traditional |
| Chhathi | 2 | baby chhati ceremony |
| Sukhmani Sahib Path | 2 | sukhmani |
| Ramayan / Sundarkand Path | 3 | sundarkand path invitation, kirtan … ramayan path |
| Lobola | 1 | lobola invitation card |
| Mata ka Jagran | 6 | mata ka jagran card |
| Election campaign | 5 | aam aadami party |
| Art workshop (mehndi classes) | 4 | mehndi classes, art, workshop |
| Godparent proposal | 6 | god parents proposal, ninang and ninong |
| Rice ceremony / Annaprashan | 9 | anprashan card, rice ceremony invitation |
| Aqiqah | 1 (+girl filter) | aqeeqah of baby girl |
| Engagement save the date | 9 | engagement, savethedate |

### B3. Product types we barely have (no occasion in the query)
name tag (4) · rumi name tag (7) · direction / instructions (4) · laser tag (1) · financial templates (9) ·
folletos = Spanish "flyers" (3) · menu (7) · poster on money investment tips (3–4) · ramayan (7) · tempal card (3) ·
brown and gold party invitations with a dress (2)

Note: "folletos" could map to the Announcement / flyer type (translation), the rest are design gaps.

---

## C. Queries with 10–39 results (101) — same issue types, more examples

### C1. Language hard filter (A2) — 20 queries
| Query | Now | w/o filter |
|---|---|---|
| hindi wedding, shaadi hindi (×3), marathi invitation wedding | 15 | 1106 |
| marriage certificate in hindi | 18 | 1427 |
| tamil wedding invitation (×3), punjabi wedding invitation, wedding card odia traditional, bahasa indonesia pernikahan, marathi matter wedding card (×2) | 32 | 1106 |
| spanish wedding, wedding invitation spanish (×2), invitacion boda religiosa (×2) | 23–25 | 1106 |
| baby shower temática wini pooh en español | 28 | 718 |

### C2. Card type hard filter (A1) — 13 queries
| Query | Type forced | Now | w/o filter |
|---|---|---|---|
| engagement announcement (×2), engagement post | Announcement | 11 | 196 |
| graduation announcement (×2) | Announcement | 29 | 269 |
| its a boy indian announcement, new baby born boy | Announcement | 39 | 52 |
| thanksgiving card (×2) | Greeting | 27 | 98 |
| menssage graduaccion with pic (×2) | Greeting (+photo) | 15 | 269 |
| engegment card video | Greeting | 10 | 196 |
| eid ul adha invitation | Invitation | 32 | 41 |

### C3. Photo hard filter (A3) — 2 queries
graduation reception with picture (×2): 22 → 144 without filters.

### C4. To check: fewer results than the occasion has, with no strict filter — 7 queries
| Query | Now | Occasion has |
|---|---|---|
| eid al adha dinner, eid mubarak feast (×2) | 25 | 41 |
| eid mubarak gathering (×2) | 25 | 41 |
| graduation reception with picture (w/o filters) | 144 | 269 |

Likely the minimum-relevance cut drops nearby cards that miss a detail (format "dinner" / "gathering" / "reception"),
so the detail acts as a filter after all. To confirm.

### C5. Vocabulary — 2 queries
- "mubarak, prayer" (34): "mubarak" alone is not linked to Eid, so no occasion is read.
- "breakfast and lunch, menu" (38): read as Lunch Date (3 designs) — same as A4 (small learned occasion takes over).

### C6. Correct strict filters (user asked for it; few such designs) — 3 queries
- quincenera save date rsvp (26), wedding savethedate reception (22): Save the Date asked for.
- pool party free (37): Free asked for.

### C7. Missing designs — about 56 queries
| Occasion / topic | Designs | Example queries |
|---|---|---|
| Half saree ceremony | 21 | half saree ceremony (×8 variants), saree cermony |
| Welcome party | 15 | welcome, welcome back, welcome back home, welcoming, mami welcome (×2) |
| Tombstone unveiling | 13 | tombstone unveiling, unveiling, tombstone unveil, tombstone |
| Prom / matric dance | 17 | matric dance, matric ball, no pro invitation |
| Debut | 30 | 21 debut (×2) |
| Dedication | 11 | 1 year baby dedication, law enforcement dedication (×2) |
| Haldi / Maiyan / pre-wedding | 27–34 | halfi, maiyan, maaiyan |
| Mehndi | 24 | mehndi templates esthetic |
| Satyanarayan puja | 9 | satya naarayan pooja |
| Stationery shop | — | stationary shop (×8 variants with notebooks, pens, supplies, paper) |
| Name tag / ID card | — | name tag personal(ized) (×3), id card |
| Directions / maps | — | direction location, direction path, direction map (×2) |
| Character / themed parties | — | bluey party (10), bows and strawberry (12), cowgirl on horse (37), twoodles (36), elegant boat cruise (17) |
| Project event | — | project, event |

---

## D. Non-English queries (checked 49 of ~80 real non-English queries in the report)

Accuracy: about 36 good, 5 weak, 8 broken (all non-Latin script).

Good (read correctly, right designs first): 15 años, invitacion de 15s, 4 años, 4 años niños, 20 ans d'anniversaire,
anniversaire (= birthday), anniversaire de mariage, fiançailles, mariage, bautizo charro, baby shower temática wini pooh,
birthday 60 año, cumpleaños mujer (birthday ok), mis quince, quinceañera, sacramento matrimonio, invitacion boda religiosa,
kurban bayram için (Eid), masha tres años, plaas temas farm, uitnodiginh verjaardag bowlen (bowling birthday),
vaquerito fiesta (western), venta (sale), convite para casamento (wedding), shaadi, shaadi ka, shaadi ka walima,
shaadi ke salgirah (wedding anniversary), shaadi reception, nikah, muslim shaadi me, nikkah nama template.

### D1. Non-Latin scripts are erased — search returns the whole catalog (bug)
Text cleanup (`normalizeText`) keeps only a–z and 0–9, so Arabic, Bengali, Devanagari and Tamil words disappear.
The query becomes empty: no AI reading, all 11,253 templates shown newest first, and the meaning search sends an empty
text to OpenAI (400 error on every such search).

| Query | Means | Now |
|---|---|---|
| عرس | wedding | 11,253 (everything) |
| عيد مبارك, عيد, عيد اضحى (×7 variants) | Eid Mubarak / Eid al-Adha | 11,253 |
| قوالب خطوبه (×2) | engagement templates | 11,253 |
| ঈদ মোবারক, ঈদুল আজহা (×7 variants) | Eid Mubarak / Eid al-Adha (Bengali) | 11,253 |
| दव विच पत्रिका | (Devanagari) | 11,253 |
| பெட்டே birthday | Tamil word dropped, only "birthday" read | 3,054 |

18 queries in the report return the full catalog because of this.
Fix idea: keep letters of every script, send such queries to the AI reading and the meaning search (the embedding
model understands Arabic, Bengali and Hindi), and never call the embedding with empty text.

### D2. Query language taken as template language (weak)
- "invitación de hombre" (a man's invitation): AI set language = Spanish, so only Spanish-text cards show (157),
  none about a man. Writing in Spanish should not mean "Spanish-text templates only" unless asked ("en español").
- "bahasa indonesia, pernikahan": Indonesian falls into the "Other" language bucket, so results are 32 unrelated
  other-language weddings (Korean, Zulu…). The language list is too coarse for Indonesian, Tamil, Punjabi, Odia, Marathi.

### D3. Words not mapped (weak)
| Query | Missing | Now |
|---|---|---|
| invitación de adulto | adulto = adults (audience) | 9,354 (all invitations) |
| invitación de hombre / cumpleaños mujer | hombre / mujer = man / woman (gender) | gender ignored |
| convite para casamento na cor azul | azul = blue (color) | color ignored |
| folletos | = flyers (Announcement type) | 3 |
| invitación a charros | charro = Mexican cowboy (western) | no occasion, mixed results |

### D4. Already noted
selamat hari raya aidiladha → Greeting Card filter (A1): 6 of 41 Eid designs.

---

## E. Other issue types found in the full report (all 1,034 queries re-run, AI on)

### E1. A number after the occasion is ignored — 8 queries (bug)
"birthday 40", "birthday 90 gold", "birthday 18", "birthday 36", "birthday 40 blackberry", "anniversary 25"…
The age is read for "40 birthday" and "40th birthday", but not when the number comes after the event,
so these show all 3,054 birthdays instead of 40th ones first.

### E2. A weak occasion guess hides the theme the user asked for (bug)
"baby boss, party": the AI guessed occasion Themed Party (confidence 0.6). That occasion then decides which
templates belong and the Boss Baby theme only ranks, so all 4 Boss Baby designs (gender reveal, first birthday,
baby shower) are left out. 318 unrelated themed parties show instead.
Fix idea: a low-confidence or generic occasion should not anchor; a named theme / character should lead.

### E3. Newer designs ranked below older ones — 111 queries
In 217 queries the top 10 average older than mid-2023; in 111 of them 5+ designs from 2025+ sit below position 10.
| Query | Top 10 avg year | 2025+ designs at 11–96 |
|---|---|---|
| afternoon tea party | 2021.8 | 24 |
| afternoon tea | 2023.3 | 25 |
| 25th anniversary | 2023.4 | 16 |
| aeroplane welcome | 2023.4 | 14 |
| 1eid - ul - adha | 2022.9 | 13 |
| award | 2023.3 | 10 |
Cause: the meaning score outweighs freshness (0.15) and quality (0.10) inside a tier. Conflicts with the
requirement "newly created and best design should come first".

### E4. Few designs for the occasion → the rest of page 1 is unrelated — 11 queries
umembeso (1 design, then engagement cards), sukhmani (2), morning event (2), lunch / lunch party (2–3, then kids
birthdays), success party (read as Congratulations, top 10 is mostly graduation), template with champagne.
Related to A4 (small learned occasions).

### E5. AI and rules read different occasions — 16 queries
Some AI readings are better (god parents proposal → Godparent Proposal; anniversaire de mariage → Wedding Anniversary),
some questionable: "kirtan kitty invitation, divine" → Kitty Party; "hindu, puja" → Religious Service vs Indian Festival.
Overlapping occasions (Indian Festival vs Religious Service vs learned *_puja / *_path) make readings unstable.

### E6. Variants of one query get very different results — 27 groups
Adding a word changes the reading (mostly the AI) and results jump:
| Query variants | Results / occasion |
|---|---|
| ambetkar, celebration / ambetkar, event / ambetkar, celebration, event | 1602 none / 285 Indian Festival / 117 Observance Day |
| elegant boat, cruise / elegant boat, cruise, theme | 4195 / 17 |
| eid mubarak, celebration / eid mubarak, feast | 41 / 25 (format "dinner" added) |
| eid ul adha mubarak, celebration / eid ul adha mubarak, festival | 41 / 6 (Greeting Card forced) |
| engagement / engagement, announcement | 196 / 11 |
| graduation / graduation, ceremony, announcement | 269 / 3 |

### E7. Words the search does not know — 69 words in no template
- Missing synonyms for occasions we have: bakri, bakra (Bakrid → Eid), tabaski (Eid al-Adha), srimant (baby shower /
  Seemantham), maiyan, jal (ceremony), sundarkand, ambedkar / ambetkar (Ambedkar Jayanti), ontheway (baby on the way),
  newhome (housewarming), afterparty / after party, pre-k and 12th grade (graduation), cookoff / pitmaster (BBQ),
  "she did it" (graduation phrase), nikkah nama (nikah).
- Brands / characters: dbz, pubg, garfield, liverpool, hectors.
- Product types: tarpaulin (11 queries), name tag (9), layout, certificate, idcard, e-magazine, poster board, journals.
- Noise that should be ignored, not required: dates ("10 juin", "6 juin", "june 7"), personal names (tasnim, umar,
  avinash, vasanti, parthithan, j.b.), pasted chat text ("[27/05, 1:14 pm] tassu _delighti: …").

### E8. Broad results when no occasion is read — 39 queries
after party (4,423), afterparty (4,212), black invites (3,062), elegant boat cruise (4,195), invitación de adulto
(9,354), gabbys dollhouse celebration (1,540), ambetkar celebration (1,602). Nothing narrows these; occasion
quick tags or a better reading would help.

### E9. Theme + occasion combinations we do not have (design gaps, search works)
Krishna baby shower (0; Krishna exists in 14 other designs), Cocomelon graduation (0; Cocomelon in 15),
western 13th birthday (0), Eid with gifts (0), Winnie the Pooh in Spanish (0), firetruck 13th birthday
(trucks exist in 40 birthdays, none 13th: the age wins over the element in ranking).

### E10. Weak best match (relevance under 0.45) — 8 queries
direction (×6 variants), id card, game card: nothing close exists (design gaps).

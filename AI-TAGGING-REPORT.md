# AI Tagging Accuracy Report

Date: 2026-10-29 · Templates: 11,253 (all tagged by AI)
Visual check: 200 random templates compared with their images · Automatic checks: all 11,253

## Accuracy (200-card visual check)

| Field | Correct | Notes |
|---|---|---|
| Overall: card with no issue | 163 / 200 (82%) | 11 more have only the baby-event audience issue |
| Occasion | 185 / 198 (93%) | 2 sample cards are blank templates |
| Gender | 196 / 198 (99%) | |
| Milestone (age / years) | 190 / 198 (96%) | mostly "Nth Annual" read as age |
| Language | 198 / 198 (100%) | |
| Has photo | 198 / 198 (100%) | |
| Main elements (assets) | 191 / 198 (96%) | small misses |
| Cartoon characters | 7 / 14 (50%) | weakest area |
| Audience | 185 / 198 (93%) | every baby event is "kids" |

## Issues that affect search (fix first)

### 1. First birthday saved as "Birthday" + milestone 1 — 68 cards
**Fixed:** cards moved to First Birthday; birthday + milestone 1 now maps to First Birthday.
"first birthday" search finds **0** of them. Cause: the last batch's rule that strips numbers from occasion names (all 68 are from that batch). Code bug, not AI.
32219, 32243, 32258, 32455, 32704, 32758, 32823, 32826, 32829, 32830, 32833, 32834, 32839, 33008, 33009, 33035, 33056, 34062, 34100, 34107, 34110, 34114, 34124, 34128, 34147, 34175, 34179, 34185, 34204, 34206, 34217, 34218, 34219, 34220, 34221, 34222, 34223, 34224, 34225, 34226, 34227, 34228, 34229, 34230, 34231, 34232, 34233, 34234, 34235, 34236, 34251, 34252, 34253, 34962, 34964, 35011, 35887, 36681, 36873, 36880, 37380, 38448, 40883, 41166, 41167, 45236, 45237, 45583

### 2. Griha Pravesh split between two occasions — 21 cards
**Fixed:** all 21 under Housewarming; search finds 21 of 21.
Search "griha pravesh" finds only the indian_festival ones (7 of 21).
- housewarming (missed by search): 33865, 33866, 33867, 33868, 33871, 33872, 36611, 45197, 45198, 45210, 45211, 45213, 45223, 49098
- indian_festival: 33863, 33864, 33869, 33870, 36612, 45196, 45209

### 3. Memorial Day tagged Independence Day / Observance Day — 42 cards
**Fixed:** new Memorial Day occasion; search finds 42 of 42.
"memorial day" finds 36 of 42; there is no Memorial Day occasion.
33506, 33507, 33508, 33509, 33510, 33511, 33512, 33513, 33514, 33515, 33516, 33517, 33518, 33519, 33520, 33521, 33523, 33525, 33526, 33527, 33528, 36878, 37024, 37025, 37026, 37027, 37028, 37029, 37030, 37031, 37032, 37033, 37034, 37035, 37036, 37037, 37038, 37039, 37040, 37041, 37042, 37043

### 4. Holiday-themed cards not linked to the holiday
**Fixed:** cards linked to the holiday; queries with two occasions rank cards that fit both first (all on page 1).
Found by "halloween wedding" / "christmas gender reveal", but **none on page 1**.
- Halloween-themed (87): 34482, 41102, 48050, 51875, 51908, 51912, 52028, 52083, 52941, 68761, 68827, 68829, 68871, 68891, 68898, 68914, 68962, 68966, 68968, 68969, 68970, 68975, 68976, 68981, 68984, 68985, 68986, 68987, 68988, 68989, 68990, 69060, 69066, 69113, 69119, 69121, 69124, 69125, 69128, 69129, 69130, 69131, 69133, 69134, 69135, 69136, 69137, 69138, 69140, 69141, 69145, 69146, 69148, 69149, 69160, 69161, 69162, 69163, 69164, 69165, 69166, 69170, 69175, 69176, 69177, 69178, 69180, 69181, 69182, 69183, 69185, 69187, 69188, 69195, 69197, 69198, 69199, 69201, 69202, 69329, 69333, 69363, 69364, 69550, 69949, 69963, 70538
- Christmas-themed (44): 33725, 35052, 37117, 48131, 52112, 52308, 52319, 68821, 69316, 69354, 69355, 69357, 69358, 69359, 69360, 69361, 69362, 69365, 69366, 69367, 69368, 69369, 69370, 69371, 69373, 69374, 69375, 69376, 69377, 69378, 69382, 69561, 69562, 69574, 69575, 69576, 69580, 69584, 69842, 69843, 69845, 69850, 69857, 69866

### 5. Thank-you cards missing the event they belong to — 13 cards
**Fixed:** linked to their event; "graduation thank you" shows all 9 on page 1.
35432, 35433, 35440, 35445, 35458, 35462, 35465, 35466, 35468, 35470, 35477, 35481, 48515

## Tagging mistakes

### 6. "Nth Annual" read as milestone — 36 cards
e.g. "20th Annual Golf Tournament" → milestone 20.
31997, 32000, 32012, 32015, 32208, 32291, 32367, 32589, 33521, 33599, 33643, 33890, 33921, 34493, 35584, 35594, 35673, 36284, 36734, 40641, 40695, 40696, 46097, 46200, 46211, 46378, 46379, 48132, 48491, 48861, 49170, 49176, 49215, 51058, 51910, 52346

### 7. Awards events tagged Promotion / Corporate event — 29 cards
32585, 32589, 33883, 33884, 33885, 33887, 33888, 33889, 33890, 33891, 46207, 46209, 46210, 46211, 46214, 46215, 46216, 46219, 46220, 49027, 51054, 51055, 51058, 51061, 51067, 51068, 51075, 51077, 51078

### 8. Cartoon characters not recognised
- Franchise theme missing (Stitch, Boss Baby, Frozen, Squishmallows, Nightmare Before Christmas) — 38: 48507, 48850, 48852, 51212, 51214, 51215, 51217, 51219, 51220, 51221, 51222, 51223, 51224, 53068, 53653, 53675, 53679, 68569, 68732, 68892, 68917, 68961, 69042, 69092, 69305, 69584, 69758, 69852, 70140, 70309, 70452, 70602, 70614, 70656, 71073, 71403, 71405, 71426
- Mickey / Minnie / Daisy saved as plain "mouse" / "duck" element — 70: 34163, 34167, 34195, 44799, 51158, 51160, 51163, 51165, 51173, 51175, 51191, 51192, 51193, 51203, 51206, 51207, 51208, 51209, 51210, 52289, 52300, 52319, 52953, 53206, 53467, 53468, 53469, 53470, 53471, 53472, 53473, 53474, 53475, 53476, 53477, 53478, 53480, 53482, 53491, 68414, 68421, 68480, 68481, 68482, 68486, 68566, 68650, 68665, 68692, 68712, 69081, 69205, 69542, 69987, 70004, 70014, 70292, 70628, 70639, 70640, 70756, 70812, 70822, 70884, 71046, 71216, 71340, 71376, 71386, 71449
- Seen in visual check: 71405, 70602, 48852, 68961, 52247, 70628

### 9. Apology / sorry notes tagged Friendship — 13 cards
35938, 35939, 35941, 35942, 35944, 35945, 35946, 35947, 35948, 35949, 35950, 35951, 35952

### 10. Contact icons saved as elements (location pin, calendar, phone) — 133 cards
32059, 32915, 32937, 32942, 32943, 32944, 32945, 32953, 33251, 33252, 33672, 33674, 33675, 33679, 33714, 33716, 33737, 33742, 33743, 33745, 33746, 33749, 33751, 33792, 33794, 33795, 33797, 33798, 33799, 33800, 33801, 33802, 33803, 33804, 33805, 33806, 33807, 33808, 33810, 33811, 33863, 33864, 33866, 33873, 33876, 33883, 33884, 33886, 33888, 33889, 33890, 33891, 33895, 33896, 33897, 33898, 33900, 33901, 33903, 33906, 33912, 33925, 33927, 33929, 33932, 33941, 33943, 33962, 33963, 33975, 34001, 34468, 34751, 34757, 34887, 34900, 35404, 35407, 35408, 35475, 35662, 35764, 35905, 35930, 35933, 36028, 36156, 36223, 36240, 36323, 36400, 36444, 36726, 36823, 36868, 37219, 41209, 44947, 46099, 46156, 46170, 46172, 46454, 46455, 47587, 48042, 48592, 48594, 48890, 49636, 50625, 50629, 50632, 50646, 50687, 51781, 52202, 52203, 52207, 52298, 52395, 52532, 68430, 69003, 69018, 69020, 69411, 69448, 69553, 70179, 70385, 70761, 71369

### 11. Hot-air balloon saved as "balloon" (same as party balloons) — 24 cards
32116, 32908, 34206, 34742, 34744, 34898, 35488, 45030, 48326, 48721, 49182, 50966, 51832, 51867, 52150, 53001, 53139, 68430, 68432, 68510, 69888, 69934, 70421, 70892

### 12. Baby events always audience "kids" — 949 cards (all baby showers / gender reveals)
Guests are adults. Every card has it, so this is a rule, not random. Sample: 52636, 69316, 41110, 71233, 45255

### 13. Quinceañera without milestone 15 — 96 cards
32638, 32639, 32641, 32645, 32647, 32648, 32651, 32652, 32653, 32655, 32656, 32657, 32658, 32659, 32660, 32661, 32662, 32663, 32664, 32665, 32667, 32973, 50571, 52288, 52680, 52735, 52736, 52737, 52738, 52739, 52993, 53002, 53091, 53119, 53122, 53123, 53137, 53140, 53142, 53163, 53165, 53168, 53311, 53639, 53646, 68458, 68459, 68575, 68576, 68603, 68883, 69029, 69030, 69532, 69788, 69892, 70065, 70254, 70320, 70402, 70520, 70565, 70569, 70588, 70589, 70590, 70630, 70653, 70696, 70759, 70784, 70795, 70811, 70842, 70923, 70930, 70962, 70963, 71007, 71009, 71010, 71049, 71142, 71150, 71163, 71177, 71185, 71225, 71245, 71324, 71325, 71398, 71399, 71423, 71446, 71505

### 14. Other single mistakes (visual check)
| Template | Issue |
|---|---|
| 70780 | Quinceañera court proposal → Bridesmaid Proposal |
| 35927 | Teacher appreciation → Farewell |
| 33073 | Summer beach "holiday" → Holiday Party (winter) |
| 49184 | School annual function → School Event (others use Annual Day) |
| 34006 | Breakfast invitation → no occasion (also 34003, 34010, 48970) |
| 48325 | Twin girls → gender neutral |
| 35541 | "Women in Leadership" → gender neutral |
| 46517 | Funeral notice → milestone 45 (age at death) |
| 48094 | Roast turkey → "bird" |
| 37149 | Pumpkin (main object) missing |
| 52054 | Nautical boat parade → Under the Sea theme |
| 32496, 70169 | Second occasion missing (birthday, Valentine's) |

## Missing data

| Issue | Count | Template IDs |
|---|---|---|
| Blank templates (no name, no text) | 190 | 18635 – 19300 (ids in that range with empty name) |
| No mood | 213 | 31994, 32126, 32263, 32264, 32267, 32273, 32275, 32283, 32286, 32375, 32384, 32386, 32484, 32542, 32543, 32547, 32550, 32559, 32560, 32563, 32573, 32576, 32582, 32588, 32664, 32818, 32922, 32927, 32944, 32965, 32982, 32987, 33033, 33038, 33076, 33079, 33082, 33083, 33085, 33103 … |
| No theme and no element | 111 | 31991, 31995, 32004, 32007, 32009, 32014, 32077, 32081, 32120, 32144, 32165, 32558, 32564, 32703, 32768, 32886, 32903, 32924, 32954, 32955, 33028, 33083, 33110, 33142, 33315, 33322, 34063, 34172, 34176, 34182, 34325, 34338, 34365, 34463, 34634, 34687, 34690, 34692, 34856, 34857 … |
| Devanagari mantra on English card tagged "other" not Hindi (minor) | 19 | 48141, 38906, 39073, 39085, 45827, 45828, 45830, 46085, 46705, 47581, 48087, 49118, 47579, 46704, 46221, 45826, 45829, 39071, 38910 |

## Working well
- Occasion on standard events (weddings, birthdays, showers, holidays, Indian ceremonies)
- Language detection, incl. Hindi, Tamil, Marathi, Spanish
- Photo slot detection
- Gender on named cards ("our son", "it's a girl")
- Age milestones on birthdays and anniversaries

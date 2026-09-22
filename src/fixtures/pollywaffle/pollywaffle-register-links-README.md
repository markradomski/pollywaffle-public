# Pollywaffle register-of-interests links

`src/examples/pollywaffle/pollywaffleRegisterLinks.ts` gives each expanded
Pollywaffle balloon a "Click to read more" link to the politician's own
official Parliament of Australia Register of Interests record. Captured
21 September 2026 by reading the live aph.gov.au register pages — no URL in
that file was guessed or constructed from a naming pattern.

## Method

1. House members: the 48th Parliament register
   (https://www.aph.gov.au/Senators_and_Members/Members/Register) lists
   every current member with a link to their own individual statement (a
   static PDF for a handful of members, a
   `interests-register-api-public.aph.gov.au/api/members/<id>/statement/48`
   download for the rest — both are genuine aph.gov.au-issued URLs). Each
   entry's name was matched against the Pollywaffle CSV's `name` column by
   surname, then verified by first name (nicknames such as "Josh" /
   "Joshua" handled explicitly) — a surname match with no confident
   first-name match is treated as no match at all, never guessed. This
   caught real collisions the naive approach would have gotten wrong: for
   example matching on surname alone would have wrongly pointed Senator
   "Dean Smith" and Senator "Marielle Smith" at MP David Smith's (Bean, ACT)
   statement, and Senator "Bridget McKenzie" at MP Zoe McKenzie's (Flinders,
   VIC) statement — all rejected as ambiguous instead.
2. One House member (Michelle Ananda-Rajah) is not in the current 48th
   Parliament register — she falls back to her archival 47th Parliament
   statement, still a real, verified aph.gov.au link, just an older one.
3. Senators have no per-senator deep link on aph.gov.au: the Register of
   Senators' Interests is published as chronological compiled-volume PDFs
   (https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Senators_Interests/Tabled_volumes),
   not individual per-senator pages, and no reliable way to identify which
   volume/page holds a given senator's current statement was found without
   opening and searching every volume. Rather than guess, every senator
   links to that same official tabled-volumes index — the genuine, correct
   location of their record, just not a deep link to their specific page
   within it.

## Coverage

93 of the 130 politicians in `pollywaffle-2025.csv` have an individual
statement link (92 from the 48th Parliament register + the one 47th
Parliament fallback above); the remaining 37 (all sitting senators) link to
the Senate tabled-volumes index. See `pollywaffleRegisterLinks.ts`'s own
`RegisterLink.individual` flag.

## Verification

Every URL in `pollywaffleRegisterLinks.ts` was read directly from
aph.gov.au's own rendered register pages (not searched, not templated).
Tony Burke's link
(https://interests-register-api-public.aph.gov.au/api/members/DYW/statement/48)
was additionally confirmed to resolve with a live `fetch` (`200`,
`application/pdf`, ~536KB).

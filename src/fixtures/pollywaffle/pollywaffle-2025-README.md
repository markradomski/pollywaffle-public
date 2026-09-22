# Pollywaffle 2025 — the active edition

`pollywaffle-2025.csv` is the dataset this app renders by default (see
`PollywaffleExample.tsx`). It uses the same six-core-column shape as
`pollywaffle-2017.csv` (the preserved, currently-disabled reference
snapshot — see `pollywaffle-2017-README.md`):

`id,name,primaryvalue,category,type,metric_001`

plus three extra source-provenance columns not used by the app's own
calculation: `has_investment`, `rental_income_declared`, `chamber`.

## Property declarations

Property counts (`primaryvalue`) come from Guardian Australia's
[3 September 2025 analysis](https://www.theguardian.com/australia-news/2025/sep/03/australian-politicians-reveal-their-housing-portfolios-with-some-owning-as-many-as-six-homes)
of the 47th Parliament's registers of members'/senators' interests. This
file contains the 130 parliamentarians Guardian identified as having
declared either multiple properties or at least one investment property
— not all 226 current MPs and senators. No zero-property record has been
invented for anyone the Guardian table doesn't include.

Properties the parliamentarian themselves declares are counted; properties
solely owned by a partner or other family member are not automatically
counted. This is declared-interest data, not an independent land-title
audit, and a declared property count is not the same thing as verified
beneficial ownership.

## metric_001 (simplified estimated value)

`metric_001` = `primaryvalue × 848,858`, where $848,858 is
[Cotality's national median dwelling value at 31 August 2025](https://www.reuters.com/world/asia-pacific/australia-house-prices-climb-august-demand-outstrips-supply-cotality-says-2025-08-31/)
— the day before the Guardian dataset above was published. This is a
deliberately simplified, satirical value used by the Pollywaffle
affordability index, not a valuation of any individual property or real
portfolio. The app's own adapter (`pollywaffleAdapter.ts`) recomputes this
figure directly from `primaryvalue` and the same constant, rather than
trusting this CSV column, so there is exactly one source of truth for the
calculation.

## category

`category` is intentionally blank. The Guardian analysis does not provide
a complete, consistent per-politician list of property types. No
placeholder values are invented.

## Sources

- Guardian Australia, 3 September 2025:
  https://www.theguardian.com/australia-news/2025/sep/03/australian-politicians-reveal-their-housing-portfolios-with-some-owning-as-many-as-six-homes
- Cotality national median dwelling value, 31 August 2025 (via Reuters):
  https://www.reuters.com/world/asia-pacific/australia-house-prices-climb-august-demand-outstrips-supply-cotality-says-2025-08-31/
- Parliament of Australia, 47th Parliament Register of Members' Interests:
  https://www.aph.gov.au/Senators_and_Members/Members/Register/Previous_Parliaments/47th_Parliament_Register_of_Members_interests
- Parliament of Australia, tabled Register of Senators' Interests volumes:
  https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Senators_Interests/Tabled_volumes

## Important limitation

This is a verified public extract of the 130 parliamentarians Guardian's
table names, not a fabricated 226-row dataset. It does not claim to cover
every current MP and senator.

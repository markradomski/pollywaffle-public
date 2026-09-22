import type { PollywaffleRecord } from './pollywaffleSchema'

/**
 * Per-politician links to their official Parliament of Australia Register
 * of Interests statement — see
 * src/fixtures/pollywaffle/pollywaffle-register-links-README.md for full
 * sourcing/methodology. Verified against the live aph.gov.au register
 * pages, never guessed: a House member not found in the current (48th
 * Parliament) register, or matched ambiguously (a shared surname with no
 * confident first-name match), falls through to the previous (47th
 * Parliament) register and is otherwise simply omitted rather than
 * fabricated. Senators have no per-senator deep link on aph.gov.au (the
 * Senate register is published as chronological compiled-volume PDFs, not
 * per-senator pages) — they link to the official tabled-volumes index
 * instead, which is itself the genuine, correct record location.
 */

export const SENATE_REGISTER_URL =
  'https://www.aph.gov.au/Parliamentary_Business/Committees/Senate/Senators_Interests/Tabled_volumes'

interface RegisterLink {
  url: string
  /** Whether `url` is that politician's own individual statement PDF, or (for senators, and any House member without one) the chamber's shared register index. */
  individual: boolean
}

/** Keyed by the source CSV's own `name` column (see pollywaffleSchema.ts) — not the display-formatted label. */
const POLLYWAFFLE_REGISTER_LINKS: Record<string, RegisterLink> = {
  'Tony Burke': { url: 'https://interests-register-api-public.aph.gov.au/api/members/DYW/statement/48', individual: true },
  'Andrew Charlton': { url: 'https://interests-register-api-public.aph.gov.au/api/members/I8M/statement/48', individual: true },
  'Colin Boyce': { url: 'https://interests-register-api-public.aph.gov.au/api/members/299498/statement/48', individual: true },
  'Michelle Rowland': { url: 'https://interests-register-api-public.aph.gov.au/api/members/159771/statement/48', individual: true },
  'Terry Young': { url: 'https://interests-register-api-public.aph.gov.au/api/members/201906/statement/48', individual: true },
  'Alison Byrnes': { url: 'https://interests-register-api-public.aph.gov.au/api/members/299145/statement/48', individual: true },
  'Andrew Willcox': { url: 'https://interests-register-api-public.aph.gov.au/api/members/286535/statement/48', individual: true },
  'Darren Chester': { url: 'https://interests-register-api-public.aph.gov.au/api/members/IPZ/statement/48', individual: true },
  'Julian Hill': { url: 'https://interests-register-api-public.aph.gov.au/api/members/86256/statement/48', individual: true },
  'Kristy McBain': { url: 'https://interests-register-api-public.aph.gov.au/api/members/281988/statement/48', individual: true },
  'Louise Miller-Frost': { url: 'https://interests-register-api-public.aph.gov.au/api/members/296272/statement/48', individual: true },
  'Madeleine King': { url: 'https://interests-register-api-public.aph.gov.au/api/members/102376/statement/48', individual: true },
  'Mark Dreyfus': { url: 'https://interests-register-api-public.aph.gov.au/api/members/HWG/statement/48', individual: true },
  'Meryl Swanson': { url: 'https://interests-register-api-public.aph.gov.au/api/members/264170/statement/48', individual: true },
  'Milton Dick': { url: 'https://interests-register-api-public.aph.gov.au/api/members/53517/statement/48', individual: true },
  'Rick Wilson': { url: 'https://interests-register-api-public.aph.gov.au/api/members/198084/statement/48', individual: true },
  'Sarah Witty': { url: 'https://interests-register-api-public.aph.gov.au/api/members/316660/statement/48', individual: true },
  'Sophie Scamps': { url: 'https://interests-register-api-public.aph.gov.au/api/members/299623/statement/48', individual: true },
  'Steve Georganas': { url: 'https://interests-register-api-public.aph.gov.au/api/members/DZY/statement/48', individual: true },
  'Susan Templeman': { url: 'https://interests-register-api-public.aph.gov.au/api/members/181810/statement/48', individual: true },
  'Sussan Ley': { url: 'https://static.aph.gov.au/-/media/03_Senators_and_Members/32_Members/Register/48p/KN/Ley_48P.pdf?rev=82da29d9e3c944ccb78e299a6ff238bf', individual: true },
  'Tanya Plibersek': { url: 'https://interests-register-api-public.aph.gov.au/api/members/83M/statement/48', individual: true },
  'Tony Zappia': { url: 'https://interests-register-api-public.aph.gov.au/api/members/HWB/statement/48', individual: true },
  'Allegra Spender': { url: 'https://interests-register-api-public.aph.gov.au/api/members/286042/statement/48', individual: true },
  'Catherine King': { url: 'https://interests-register-api-public.aph.gov.au/api/members/00AMR/statement/48', individual: true },
  'David Littleproud': { url: 'https://interests-register-api-public.aph.gov.au/api/members/265585/statement/48', individual: true },
  'Elizabeth Watson-Brown': { url: 'https://interests-register-api-public.aph.gov.au/api/members/300127/statement/48', individual: true },
  'Garth Hamilton': { url: 'https://interests-register-api-public.aph.gov.au/api/members/291387/statement/48', individual: true },
  'Ged Kearney': { url: 'https://interests-register-api-public.aph.gov.au/api/members/LTU/statement/48', individual: true },
  'Jason Wood': { url: 'https://interests-register-api-public.aph.gov.au/api/members/E0F/statement/48', individual: true },
  'Jess Teesdale': { url: 'https://interests-register-api-public.aph.gov.au/api/members/314526/statement/48', individual: true },
  'Kate Thwaites': { url: 'https://interests-register-api-public.aph.gov.au/api/members/282212/statement/48', individual: true },
  'Kevin Hogan': { url: 'https://interests-register-api-public.aph.gov.au/api/members/218019/statement/48', individual: true },
  'Richard Marles': { url: 'https://interests-register-api-public.aph.gov.au/api/members/HWQ/statement/48', individual: true },
  'Scott Buchholz': { url: 'https://interests-register-api-public.aph.gov.au/api/members/230531/statement/48', individual: true },
  'Tania Lawrence': { url: 'https://interests-register-api-public.aph.gov.au/api/members/299150/statement/48', individual: true },
  'Ted O’Brien': { url: 'https://interests-register-api-public.aph.gov.au/api/members/138932/statement/48', individual: true },
  'Tony Pasin': { url: 'https://interests-register-api-public.aph.gov.au/api/members/240756/statement/48', individual: true },
  'Ali France': { url: 'https://interests-register-api-public.aph.gov.au/api/members/270198/statement/48', individual: true },
  'Amanda Rishworth': { url: 'https://interests-register-api-public.aph.gov.au/api/members/HWA/statement/48', individual: true },
  'Andrew Gee': { url: 'https://interests-register-api-public.aph.gov.au/api/members/261393/statement/48', individual: true },
  'Andrew Wilkie': { url: 'https://interests-register-api-public.aph.gov.au/api/members/C2T/statement/48', individual: true },
  'Anika Wells': { url: 'https://interests-register-api-public.aph.gov.au/api/members/264121/statement/48', individual: true },
  'Anne Stanley': { url: 'https://interests-register-api-public.aph.gov.au/api/members/265990/statement/48', individual: true },
  'Anne Urquhart': { url: 'https://interests-register-api-public.aph.gov.au/api/members/231199/statement/48', individual: true },
  'Anne Webster': { url: 'https://interests-register-api-public.aph.gov.au/api/members/281688/statement/48', individual: true },
  'Anthony Albanese': { url: 'https://static.aph.gov.au/-/media/03_Senators_and_Members/32_Members/Register/48p/AB/Albanese_48P.pdf?rev=fa206964bbea4ca5888b3b617f760485&hash=477C22908F44B7805199DB93199EB4F7', individual: true },
  'Ash Ambihaipahar': { url: 'https://interests-register-api-public.aph.gov.au/api/members/315618/statement/48', individual: true },
  'Barnaby Joyce': { url: 'https://interests-register-api-public.aph.gov.au/api/members/e5d/statement/48', individual: true },
  'Ben Small': { url: 'https://interests-register-api-public.aph.gov.au/api/members/291406/statement/48', individual: true },
  'Cameron Caldwell': { url: 'https://interests-register-api-public.aph.gov.au/api/members/306489/statement/48', individual: true },
  'Carol Berry': { url: 'https://interests-register-api-public.aph.gov.au/api/members/23497/statement/48', individual: true },
  'Cassandra Fernando': { url: 'https://interests-register-api-public.aph.gov.au/api/members/299964/statement/48', individual: true },
  'Chris Bowen': { url: 'https://interests-register-api-public.aph.gov.au/api/members/DZS/statement/48', individual: true },
  'Dan Tehan': { url: 'https://interests-register-api-public.aph.gov.au/api/members/210911/statement/48', individual: true },
  'Emma McBride': { url: 'https://interests-register-api-public.aph.gov.au/api/members/248353/statement/48', individual: true },
  'Fiona Phillips': { url: 'https://interests-register-api-public.aph.gov.au/api/members/147140/statement/48', individual: true },
  'Helen Haines': { url: 'https://interests-register-api-public.aph.gov.au/api/members/282335/statement/48', individual: true },
  'Jamie Chaffey': { url: 'https://interests-register-api-public.aph.gov.au/api/members/316312/statement/48', individual: true },
  'Jason Clare': { url: 'https://interests-register-api-public.aph.gov.au/api/members/HWL/statement/48', individual: true },
  'Jim Chalmers': { url: 'https://interests-register-api-public.aph.gov.au/api/members/37998/statement/48', individual: true },
  'Josh Wilson': { url: 'https://interests-register-api-public.aph.gov.au/api/members/265970/statement/48', individual: true },
  'Julie Collins': { url: 'https://interests-register-api-public.aph.gov.au/api/members/HWM/statement/48', individual: true },
  'Julie-Ann Campbell': { url: 'https://interests-register-api-public.aph.gov.au/api/members/312823/statement/48', individual: true },
  'Leon Rebello': { url: 'https://interests-register-api-public.aph.gov.au/api/members/316547/statement/48', individual: true },
  'Libby Coker': { url: 'https://interests-register-api-public.aph.gov.au/api/members/263547/statement/48', individual: true },
  'Lisa Chesters': { url: 'https://interests-register-api-public.aph.gov.au/api/members/249710/statement/48', individual: true },
  'Mary Aldred': { url: 'https://interests-register-api-public.aph.gov.au/api/members/11788/statement/48', individual: true },
  'Melissa Price': { url: 'https://interests-register-api-public.aph.gov.au/api/members/249308/statement/48', individual: true },
  'Michael McCormack': { url: 'https://interests-register-api-public.aph.gov.au/api/members/219646/statement/48', individual: true },
  'Michelle Landry': { url: 'https://interests-register-api-public.aph.gov.au/api/members/249764/statement/48', individual: true },
  'Mike Freelander': { url: 'https://interests-register-api-public.aph.gov.au/api/members/265979/statement/48', individual: true },
  'Pat Conroy': { url: 'https://interests-register-api-public.aph.gov.au/api/members/249127/statement/48', individual: true },
  'Peter Khalil': { url: 'https://interests-register-api-public.aph.gov.au/api/members/101351/statement/48', individual: true },
  'Phil Thompson': { url: 'https://interests-register-api-public.aph.gov.au/api/members/281826/statement/48', individual: true },
  'Rebekha Sharkie': { url: 'https://interests-register-api-public.aph.gov.au/api/members/265980/statement/48', individual: true },
  'Renee Coffey': { url: 'https://interests-register-api-public.aph.gov.au/api/members/312323/statement/48', individual: true },
  'Rob Mitchell': { url: 'https://interests-register-api-public.aph.gov.au/api/members/M3E/statement/48', individual: true },
  'Sally Sitou': { url: 'https://interests-register-api-public.aph.gov.au/api/members/298121/statement/48', individual: true },
  'Sam Lim': { url: 'https://interests-register-api-public.aph.gov.au/api/members/300130/statement/48', individual: true },
  'Sharon Claydon': { url: 'https://interests-register-api-public.aph.gov.au/api/members/248181/statement/48', individual: true },
  'Shayne Neumann': { url: 'https://interests-register-api-public.aph.gov.au/api/members/HVO/statement/48', individual: true },
  'Tim Watts': { url: 'https://interests-register-api-public.aph.gov.au/api/members/193430/statement/48', individual: true },
  'Tim Wilson': { url: 'https://interests-register-api-public.aph.gov.au/api/members/IMW/statement/48', individual: true },
  'Tom Venning': { url: 'https://interests-register-api-public.aph.gov.au/api/members/315434/statement/48', individual: true },
  'Zali Steggall': { url: 'https://interests-register-api-public.aph.gov.au/api/members/175696/statement/48', individual: true },
  'Claire Clutterham': { url: 'https://interests-register-api-public.aph.gov.au/api/members/316101/statement/48', individual: true },
  'Gordon Reid': { url: 'https://interests-register-api-public.aph.gov.au/api/members/300126/statement/48', individual: true },
  'Jerome Laxale': { url: 'https://interests-register-api-public.aph.gov.au/api/members/299174/statement/48', individual: true },
  'Rowan Holzberger': { url: 'https://interests-register-api-public.aph.gov.au/api/members/88411/statement/48', individual: true },
  'Sam Rae': { url: 'https://interests-register-api-public.aph.gov.au/api/members/300122/statement/48', individual: true },
  'Simon Kennedy': { url: 'https://interests-register-api-public.aph.gov.au/api/members/267506/statement/48', individual: true },
  'Michelle Ananda-Rajah': { url: 'https://static.aph.gov.au/-/media/03_Senators_and_Members/32_Members/Register/47P/AB/Ananda-Rajah_47P.pdf?rev=04df0579bf2a4006bbb7e6d078c2c813&hash=9BE858E4382540FBA031FE218B003428', individual: true },
}

/** The verified individual statement link for a politician, or the chamber-wide register index when none was found (see module comment). Never returns undefined: every parliamentarian has at least the shared register. */
export function pollywaffleRegisterLink(record: Pick<PollywaffleRecord, 'name'>): RegisterLink {
  return POLLYWAFFLE_REGISTER_LINKS[record.name] ?? { url: SENATE_REGISTER_URL, individual: false }
}

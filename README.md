# CIN checker

Paste a list of Indian CINs and LLPINs, one per line. For each one, the page shows whether it is valid (and if not, exactly what is wrong), whether it is a company or an LLP, listed or unlisted, the state, the year of incorporation and the company type.

**Live:** https://filesure-cin-checker-roan.vercel.app/

Plain HTML, CSS and JavaScript. No framework, no build step, no network requests: everything runs in the browser, so a pasted client list never leaves the user's machine.

```
index.html          page shell
styles.css          all styling (light and dark)
src/cin.js          the rules: parsing, validation, error messages (no DOM)
src/app.js          the interface: rendering, filters, export
tests/cin.test.mjs  tests for the rules
fonts/              Public Sans and JetBrains Mono, self-hosted (OFL)
```

Run locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
Run tests: `node --test tests/cin.test.mjs` (Node 18+).

## How a CIN is read

`L17110MH1973PLC019786`

| Characters | Example | Meaning |
|---|---|---|
| 1 | `L` | `L` listed on a stock exchange, `U` unlisted |
| 2–6 | `17110` | Industry (NIC) code declared at registration |
| 7–8 | `MH` | State of the registered office |
| 9–12 | `1973` | Year of incorporation |
| 13–15 | `PLC` | Company type |
| 16–21 | `019786` | Registration number from the ROC |

Company type codes: `PLC` public limited, `PTC` private limited, `OPC` one person company, `GOI` Central Government company, `SGC` State Government company, `NPL` not-for-profit (Section 8), `FLC` / `FTC` public / private subsidiary of a foreign company, `GAP` / `GAT` public / private company limited by guarantee, `ULL` / `ULT` public / private unlimited company.

State codes follow MCA usage, which differs from GST and vehicle codes: Chhattisgarh is `CT`, Uttarakhand `UR`, Telangana `TG` (MCA moved Telangana companies from `AP` to `TG` after 2014), Odisha `OR`. Older CINs also use ROC office codes: `PN` (Pune, Maharashtra; e.g. Bajaj Auto, `L65993PN2007PLC130076`) and `TZ` (Coimbatore, Tamil Nadu; e.g. ELGI Equipments, `L29120TZ1960PLC000351`).

An **LLPIN** is `AAA-1234`: three letters, a hyphen, four digits. It is a plain serial number, so it says nothing about state, year or type; the page says so instead of leaving blanks.

## What it checks

Errors (marked **Invalid**), each with the character position:

- wrong length, naming the part that is short or long ("The registration number has 5 digits; it needs 6")
- letters where digits belong and the reverse, with a fix for look-alikes (`O`/`0`, `I`/`1`, `S`/`5`, `B`/`8`)
- first character not `L` or `U`
- unknown state code, with the right one when it is a GST or vehicle code (`UK` → `UR`, `CG` → `CT`, `TS` → `TG`)
- year in the future, or before 1850 (India's first company law)
- unknown type code, with the right one for common slips (`PVT` → `PTC`)
- other identifiers pasted by mistake: GSTIN, PAN, DIN, FCRN, TAN

Warnings (marked **Needs a look**): the format is fine but the combination can't really exist.

- listed (`L`) with a private type (`PTC`, `OPC`, `FTC`, `GAT`, `ULT`): private companies can't list shares
- `OPC` with a year before 2014, when one person companies were introduced
- an all-zero registration or serial number

Messy input it cleans up and notes: lowercase, spaces inside the number, hyphens or dots between parts, quotes, trailing commas, a `CIN:` label in front, full-width characters, hidden zero-width characters from PDFs and WhatsApp, an LLPIN typed without its hyphen, a company name on the same line, several numbers on one line separated by commas or tabs, blank lines and duplicates.

When a fix is unambiguous (one look-alike swap, one doubled character, one dropped leading zero), the page offers it and can apply it to the list in one click. When more than one fix would work, it doesn't guess.

## Design notes

- **The CIN is the hero.** The empty state teaches the format by showing a real CIN split into its six parts, each with its own colour and meaning. The same breakdown appears when you open any row, with the faulty part marked in red. First-time visitors learn the format without reading instructions.
- **Motion that explains, not decorates.** The hero decodes four example CINs in turn: each character flickers and settles, then its coloured bar draws in and its meaning appears. It cycles once and stops, pauses on hover or focus, and the dots let you pick an example. Other motion answers something the user did: a scan line sweeps the editor when a list is pasted, the first rows settle in, a bar under the headline grows to show the valid / needs-a-look / invalid split, opening a row draws its breakdown, and an applied fix glows green. All of it is off when the device asks for reduced motion.
- **The CIN stripe.** A thin bar in the six segment colours, in the proportions of the six parts (1:5:2:4:3:6), runs along the top of the page and the hero card. It's the page's one decorative element, and it is itself a picture of the format.
- **Same state, different office.** `MH` and `PN` both decode to Maharashtra because PN is a registrar office code, not a different state. So the page shows the office next to the state ("Maharashtra, Pune ROC (PN)"), and the CSV has a separate ROC office column.
- **Light and dark themes.** The page follows the device's setting, and a switch in the header overrides it. The choice is remembered, and applied before the first paint so the page doesn't flash.
- **Two-pane on desktop, one column on phones.** The list stays in view while results scroll. The results switch from a table to stacked rows based on the width of the results panel (container query), not the screen.
- **Line numbers with status dots** in the editor, so a problem in a 500-line paste can be found in the list as well as in the results. "Show line N in my list" selects that line.
- **Filters with counts** (Valid, Needs a look, Invalid, Duplicates), **Copy table** (pastes into Excel or Sheets) and **Download CSV**. CSV cells that start with `=`, `+`, `-` or `@` are escaped so a spreadsheet can't run them as formulas.
- Large lists render in pages of 500, with up to 10,000 numbers checked at once.
- **JetBrains Mono** for the numbers because its zero has a dot inside, which tells `0` from `O`: the most common CIN typo. Public Sans, a typeface designed for government services, for everything else.
- Status is never colour alone: every badge has a word, and every error has a sentence.

## Limits

This checks structure, not existence. A well-formed CIN can belong to no company, or to one that has been struck off; that needs the MCA or FileSure records. The type and state in a CIN reflect the company when the CIN was last issued (a CIN changes when a company changes type, listing or state).

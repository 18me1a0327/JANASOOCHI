# Andhra Pradesh electoral-roll reference sources

## Scope and status

This document records the source boundaries for JANASOOCHI's Andhra Pradesh
geography metadata. It is a provenance note, not a voter-data source.

## Official sources established for Stage 1A

- The Election Commission of India (ECI) publishes the **Delimitation of
  Parliamentary and Assembly Constituencies Order, 2008**, including Schedule
  III and the Parliamentary Constituency to Assembly Constituency mapping.
- ECI's 2024 Andhra Pradesh election material establishes the current statewide
  totals used by this application: **25 Parliamentary Constituencies (PCs)** and
  **175 Assembly Constituencies (ACs)**. The PC reservation split is **4 SC and
  1 ST**; the AC reservation split is **29 SC and 7 ST**.
- The machine-readable Stage 1A reference is derived from those official
  delimitation materials and is version-controlled at
  `data/reference/ap_pc_ac_official.csv`.

Primary references:

- [ECI — Delimitation of Parliamentary and Assembly Constituencies Order, 2008](https://www.eci.gov.in/Documents/Delimitation/DelimitationofParliamentaryAssemblyConstituenciesOrder-2008%28English%29.pdf)
- [ECI — General Elections 2024 press note](https://elections24.eci.gov.in/docs/press-note-no-23.pdf)
- [ECI — amendment orders](https://www.eci.gov.in/1599-amendment-orders)
- [Government of India — Andhra Pradesh Reorganisation Act, 2014, Second Schedule/Table B](https://upload.indiacode.nic.in/showfile?actid=AC_CEN_5_5_00058_201406_1517807327989&filename=201406.pdf&type=actfile)

### Numbering-period note

The ECI 2008 delimitation order is an official historical order for the
combined Andhra Pradesh period and its Schedule III uses the then-current
combined-state numbering. The Stage 1A CSV retains that official provenance
for the rows it supplies, but does not silently relabel the historical source
as a post-reorganisation Andhra Pradesh numbering scheme. The two rows that
were absent from the initial extract (AC 41 Kakinada City and AC 93 Prathipadu
(SC)) are sourced from the official Andhra Pradesh Reorganisation Act, 2014
Second Schedule/Table B and are marked with that source in the CSV. This
mixed-source reference is deliberate and requires a final source-period review
before it is used to seed production geography tables; it is not a substitute
for an authoritative current statewide Part catalogue.

## Deliberate non-sources

- No documented official ECI API was established for this project.
- No documented official CEO Andhra Pradesh API was established for this
  project.
- A statewide, revision-independent official Part dataset was not established.
  Part discovery remains Assembly-Constituency and revision specific through
  official electoral-roll sources.
- Third-party geography datasets are not authoritative production sources.

## Electoral-roll documents

Official electoral-roll PDFs may be made available through official ECI or CEO
Andhra Pradesh sources. Access may be protected by CAPTCHA. JANASOOCHI must not
bypass CAPTCHA, reverse-engineer undocumented endpoints, reuse authenticated
voter-search cookies, or automate OTP flows.

The current Parts 227–230 material is pilot data only. Its exact PC/AC scope
must be read from the associated official PDF headers. Until that header evidence
is recorded, its database geography status is **UNVERIFIED**; filenames and
third-party locality references are not sufficient proof.

### Verified pilot header metadata

The first page of each supplied 2026 S01 Draft Electoral Roll of Special
Intensive Revision PDF identifies the same geography:

| Parts | Assembly Constituency | Parliamentary Constituency | Roll | Language editions |
| --- | --- | --- | --- | --- |
| 227, 228, 229, 230 | 70 - Nuzvid (GEN) | 10 - Eluru (GEN) | 2026 SIR Draft Roll, Revision 1, qualifying date 01-07-2026 | English and Telugu |

The header totals are 1,014, 973, 888 and 579 respectively. The English and
Telugu headers agree. The four URD files supplied with the project are invalid
HTML/404 payloads, not PDFs, so Urdu remains blocked and has no source coverage.

English and Telugu are separate pilot source editions. Urdu source coverage is
zero: previously supplied Urdu files were HTML/404 responses rather than valid
PDF source documents. JANASOOCHI must never synthesize Urdu records.


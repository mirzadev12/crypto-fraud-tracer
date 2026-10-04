# India context: verified legal and official facts for FineX

Researched 4 October 2026 for the "legal basis" picker. Every section number below was read in the enacted text, not taken from a summary. Anything not read at a primary source is marked NOT VERIFIED.

## How this was checked, and its limits

- **India Code (indiacode.nic.in) could not be opened** from this machine (HTTP 403 to the fetcher, connection reset to curl). So "titles as printed on India Code" was **not** checked on India Code itself.
- Instead the enacted texts were read as **Gazette of India Extraordinary** PDFs hosted on mha.gov.in (the Acts as published on 25 Dec 2023), and parsed with pdftotext. Section numbers and marginal titles below are as printed in those Gazettes. India Code republishes the same text; confidence that it matches is high, but it is an inference.
- PIB pages and the I4C site refused the fetcher (HTTP 403 / error page). Official figures in Q6 therefore come from MHA's own parliamentary replies, which are hosted on mha.gov.in.
- No credentials were entered, no forms submitted, and no file over 5 MB was downloaded (largest: 2.0 MB).
- Roughly 22 searches and fetches were used.

---

## 1. Bharatiya Sakshya Adhiniyam, 2023 (electronic records)

**Fact.** Section **63**, titled "Admissibility of electronic records", replaces Indian Evidence Act s.65B (the Supreme Court's own order calls s.65B "erstwhile"). The certificate is required by **sub-section (4)** of s.63. Its form is **"THE SCHEDULE [See section 63(4)(c)]"**, in two parts: **Part A "(To be filled by the Party)"** and **Part B "(To be filled by the Expert)"**.

- The Act is **No. 47 of 2023**, assent 25 December 2023. In force from **1 July 2024** (MHA Rajya Sabha reply, USQ 1989, 17 Dec 2025: "These new Criminal Laws have come into force from 1st July, 2024.").
- s.63(4): the certificate must be "signed by a person in charge of the computer or communication device or the management of the relevant activities (whichever is appropriate) and an expert". It goes "along with the electronic record at each instance" it is submitted.
- Both parts of the Schedule carry a hash block: "I state that the HASH value/s of the electronic/digital record/s is ____, obtained through the following algorithm", with tick options **SHA1, SHA256, MD5, Other**, and "(Hash report to be enclosed with the certificate)". Both end with **Date (DD/MM/YYYY)**, **Time (IST) in 24-hour format** and Place.
- Related: s.61 (an electronic record is not inadmissible only because it is electronic, "subject to section 63"); s.62 (contents of electronic records proved per s.63); s.170(2) saves pending proceedings under the Indian Evidence Act, 1872.
- **Who signs Part B is unsettled.** Supreme Court, *Pune Bar Association v. Union of India*, W.P.(C) 599 of 2026, order of 22 May 2026: upheld s.63(4), and held the Madras High Court's finding that Part B must be filled by a s.79A notified examiner "shall not be treated as a binding precedent", leaving the question of law open.

**Quote.** "a certificate doing any of the following things shall be submitted along with the electronic record at each instance where it is being submitted for admission" (s.63(4)).

**URLs.**
- https://www.mha.gov.in/sites/default/files/250882_english_01042024.pdf (Gazette of India Extraordinary, No. 55, 25 Dec 2023; s.63 on its p.23-24, Schedule on pp.46-47)
- https://www.livelaw.in/pdf_upload/2026/05/27/pune-bar-association-v-union-of-india-676590.pdf (the Supreme Court order text, hosted by LiveLaw, not sci.gov.in)
- https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/RS17122025/1989.pdf (commencement)

**Dates.** Gazette 25 Dec 2023; Supreme Court order 22 May 2026; accessed 4 Oct 2026.

**Confidence.** High for section, sub-section and Schedule. Medium for the Part B point (order read in full, but from a non-court host, and the court itself left the question open). S.O. numbers of the commencement notifications: NOT VERIFIED (a search summary gave 848/849/850(E), 23 Feb 2024; not read in the Gazette).

---

## 2. Bharatiya Nagarik Suraksha Sanhita, 2023

**Fact.** BNSS is **Act No. 46 of 2023** (25 Dec 2023), in force 1 July 2024; it repeals CrPC 1973 (s.531).

| Old provision | BNSS section | Title as printed | Note |
|---|---|---|---|
| CrPC s.91 | **s.94** | "Summons to produce document or other thing." | Now also covers "electronic communication, including communication devices, which is likely to contain digital evidence"; the officer's order may be "either in physical form or in electronic form". |
| CrPC s.102 | **s.106** | "Power of police officer to seize certain property." | Wording is unchanged from CrPC s.102(1): property "alleged or suspected to have been stolen, or ... found under circumstances which create suspicion of the commission of any offence". Report to the Magistrate under s.106(3). |
| none (new) | **s.107** | "Attachment, forfeiture or restoration of property." | Newly added. |

- **s.94(1)** lets a Court issue a summons, or an officer in charge of a police station issue a written order, to produce a document or "other thing" needed for an investigation. s.94(3) saves BSA ss.129-130 and the Bankers' Books Evidence Act, 1891.
- **s.106** does not mention bank accounts or virtual digital assets. Whether it reaches a customer account at an exchange is a legal question this research did not answer.
- **s.107 is a Court process, not a police freeze.** A police officer who "has reason to believe" property is derived from criminal activity may, "with the approval of the Superintendent of Police or Commissioner of Police", apply to the Court (s.107(1)). The Court gives a 14-day show-cause notice (s.107(2)), or may attach ex parte on an interim basis (s.107(5)). If the property is found to be "proceeds of crime", the Court directs the District Magistrate to distribute it "rateably" to affected persons (s.107(6)-(7)); unclaimed proceeds are forfeited to the Government (s.107(8)).
- Also relevant: **s.105** requires the search, and taking possession of property, to be recorded by audio-video means "preferably mobile phone" and forwarded to the Magistrate.

**Quotes.**
- s.107(1): "he may, with the approval of the Superintendent of Police or Commissioner of Police, make an application to the Court or the Magistrate".
- s.94(1): "require the person in whose possession or power such document or thing is believed to be, to attend and produce it, or to produce it".

**URLs.**
- https://www.mha.gov.in/sites/default/files/250884_2_english_01042024.pdf (Gazette of India Extraordinary, 25 Dec 2023; s.94 on printed p.26-27, s.106-107 on pp.30-31)
- https://bprd.nic.in/uploads/pdf/Comparison%20summary%20BNSS%20to%20CrPC.pdf (BNSS-to-CrPC correspondence table, hosted by the Bureau of Police Research and Development; its footer credits a CAPT Bhopal director, so it is a hosted teaching aid, not a gazetted concordance). Rows read: BNSS 94 to CrPC 91; BNSS 106 to CrPC 102 "No change"; BNSS 107 "Newly added".

**Dates.** Gazette 25 Dec 2023; accessed 4 Oct 2026.

**Confidence.** High for the BNSS numbers, titles and text. High for the CrPC mapping (it agrees with the statutory wording and with the BPRD table). Titles were not checked on India Code (see top).

---

## 3. PMLA: virtual digital asset service providers

**Fact.** Ministry of Finance (Department of Revenue) notification **S.O. 1072(E), dated 7 March 2023**, F. No. P-12011/12/2022-ES Cell-DOR, signed Shashank Misra, Director (Headquarter). Issued under PMLA s.2(1)(sa)(vi). It notifies five activities, when carried out for or on behalf of another person in the course of business: exchange between VDAs and fiat; exchange between forms of VDA; transfer of VDAs; safekeeping or administration of VDAs or instruments enabling control; and participation in and provision of financial services related to an issuer's offer and sale of a VDA. "Virtual digital asset" has the meaning in s.2(47A) of the Income-tax Act, 1961.

- The words "reporting entity" are **not** in the notification. The effect follows from the Act: s.2(1)(wa) defines a reporting entity as "a banking company, financial institution, intermediary or a person carrying on a designated business or profession", and s.2(1)(sa)(vi) includes anyone designated by notification. This chain was read in the Act's text (copy on the Enforcement Directorate site) and the notification.
- Record-keeping duties of a reporting entity, PMLA **s.12**: transaction records "shall be maintained for a period of five years from the date of transaction" (s.12(3)); identity documents, account files and business correspondence for five years "after the business relationship ... has ended or the account has been closed, whichever is later" (s.12(4)).
- FIU-IND "AML & CFT Guidelines for reporting entities providing services related to virtual digital assets", dated 10 March 2023: only the title and date appeared in a search listing; fiuindia.gov.in failed with an expired certificate. NOT VERIFIED beyond that.

**Quote.** "the Central Government hereby notifies that the following activities when carried out for or on behalf of another natural or legal person in the course of business".

**URLs.**
- https://egazette.gov.in/WriteReadData/2023/244184.pdf (Gazette of India Extraordinary, No. 1028, Part II Sec 3(ii), 7 Mar 2023)
- https://enforcementdirectorate.gov.in/media/pmla/d7162b8f-d022-4583-b942-d5bb85dbe796_THE%20PREVENTION%20OF%20MONEY%20LAUNDERING%20ACT,%202002.pdf (PMLA consolidated text; copy date not stated in the file)

**Dates.** 7 March 2023; accessed 4 Oct 2026.

**Confidence.** High for number, date, file number and the five activities. High for the s.2(1)(wa) and s.12 text. The consolidated PMLA copy may lag later amendments: medium for "current text".

---

## 4. CERT-In Directions of 28 April 2022

**Fact.** Directions No. **20(3)/2022-CERT-In**, dated **28 April 2022**, under s.70B(6) of the IT Act, 2000. **Direction (vi)** covers "virtual asset service providers, virtual asset exchange providers and custodian wallet providers (as defined by Ministry of Finance from time to time)". They must keep **KYC information** and **records of financial transactions for five years**.

- Transaction records must be kept so that an "individual transaction can be reconstructed", including identification of the parties "including IP addresses along with timestamps and time zones", transaction ID, "the public keys (or equivalent identifiers), addresses or accounts involved", the nature and date, and the amount transferred.
- KYC procedure refers to RBI Directions 2016, the SEBI circular of 24 April 2020 and the DoT notice of 21 September 2021 (Annexure III).
- Separately, direction (iv): all service providers keep ICT logs "for a rolling period of 180 days ... within the Indian jurisdiction"; direction (ii): report cyber incidents within **6 hours**.
- Effective "after 60 days from the date on which it is issued" (arithmetically 27 June 2022; any later extensions for particular entities were not checked).
- The Directions oblige VASPs to **keep** records. They contain no provision for a police request or a freeze; that must not be implied.

**Quote.** "shall mandatorily maintain all information obtained as part of Know Your Customer (KYC) and records of financial transactions for a period of five years".

**URL.** https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf

**Date.** 28 April 2022; accessed 4 Oct 2026.

**Confidence.** High.

---

## 5. State Emblem of India (Prohibition of Improper Use) Act, 2005

**Fact.** Act **No. 50 of 2005** (20 December 2005). Its long title: "to prohibit the improper use of State Emblem of India for professional and commercial purposes".

- **s.3**: no person may use the emblem "or any colourable imitation thereof" in a manner that "tends to create an impression that it relates to the Government" or is an official document of the Central or a State Government, "without the previous permission of the Central Government or of such officer of that Government as may be authorised". "Person" includes a former functionary.
- **s.4**: no person shall use the emblem "for the purpose of any trade, business, calling or profession" or in a trade mark, design or patent title, except in prescribed cases and conditions.
- **s.5**: a competent authority shall not register a trade mark or design bearing the emblem.
- **s.7**: breach of s.3 is punishable with imprisonment up to **two years**, or fine up to **Rs 5,000**, or both (second and later convictions: not less than six months). Breach of s.4 for wrongful gain: six months to two years and a fine up to Rs 5,000. **s.8**: prosecution needs previous sanction of the Central Government.
- **Gist for FineX:** a non-government body has no general right to display it. Using it in a way that suggests a government connection needs prior permission (s.3), and using it for any trade, business or profession needs a prescribed case (s.4). A student prototype for a government audience falls squarely in the risk zone.
- The State Emblem of India (Regulation of Use) Rules, 2007 (made under s.11; schedules of authorities allowed official seals, stationery, vehicles): seen only in a search summary, **text not read, NOT VERIFIED**.

**Quote.** "No person shall use the emblem for the purpose of any trade, business, calling or profession".

**URL.** https://www.mha.gov.in/sites/default/files/National%20Flag_STATEEMBLEMACT2005_12022019.pdf (MHA-hosted text of the Act; India Code's copy could not be opened)

**Date.** Act of 20 Dec 2005; file dated Feb 2019 per its name; accessed 4 Oct 2026.

**Confidence.** High for ss.3, 4, 5, 7, 8. The penalty figures could have been amended after 2019; none was found, but the file is an MHA-hosted copy, not a dated consolidation.

---

## 6. "Digital arrest" and the 1930 helpline: official statements

**Facts (all from MHA replies in Parliament, hosted on mha.gov.in).**

1. **Blocked IDs.** Lok Sabha USQ 2763, 18 March 2025: I4C "proactively identify and blocked more than 3,962 Skype IDs and 83,668 Whatsapp accounts used for Digital Arrest." Same reply: till 28.02.2025, more than 7.81 lakh SIM cards and 2,08,469 IMEIs blocked. This is the only digital-arrest-specific numeric figure found at a primary source.
2. **No case count.** The Rajya Sabha reply on "Cases of digital arrest scams" (USQ 228, 27 Nov 2024) gives no count of cases or amounts; it says I4C "proactively identify and block fake IDs used for Digital Arrest" and that spoofed international calls are being blocked. Counts of digital-arrest cases or rupees lost were not found at a primary source. NOT VERIFIED; do not show.
3. **Official description of 1930.** Lok Sabha USQ 4118, 17 March 2026: "A toll-free Helpline number '1930' has been operationalized to get assistance in lodging online cyber complaints." The system behind it is the Citizen Financial Cyber Fraud Reporting and Management System (CFCFRMS), "launched in year 2021 for immediate reporting of financial frauds and to stop siphoning off funds by the fraudsters".
4. **CFCFRMS "saved" figure (cumulative, changes with each reply).** USQ 4118: "till 31.01.2026, financial amount of more than Rs. 8,690 Crore has been saved in more than 24.65 lakh complaints." Earlier replies: Rs 4,386 Crore / 13.36 lakh complaints (18 Mar 2025); Rs 8,189 Crore / 23.61 lakh complaints till 31.12.2025 (Rajya Sabha USQ 1338, 11 Feb 2026). Always quote the cut-off date.
5. **Reported losses.** Lok Sabha USQ 432, 2 Dec 2025, "as per NCRP & CFCFRMS operated by I4C", amount reported: 2022 Rs 2,290.24 Crore; 2023 Rs 7,465.18 Crore; **2024 Rs 22,845.73 Crore**. This confirms the figure already on the deck.
6. **Awareness actions on the record.** The Prime Minister spoke on digital arrests in "Mann Ki Baat" on 27.10.2024; All India Radio programme 28.10.2024; I4C-DoT caller-tune campaign from 19.12.2024 promoting "Cybercrime Helpline Number 1930 & NCRP portal".
7. NCRP (cybercrime.gov.in) is "a part of the I4C, to enable public to report incidents pertaining to all types of cyber crimes"; FIRs and later action "are handled by the State/UT Law Enforcement Agencies".
8. Not found: a statutory definition of "digital arrest" in these replies. Not asserted either way.

**A figure that must not be used:** a search summary claimed "Rs 11,158 Crore saved in 32.80 lakh complaints till 30.06.2026". It was not found in any reply read here, and the latest cut-off actually read is 31.01.2026. NOT VERIFIED.

**URLs.**
- https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS18032025/2763.pdf
- https://www.mha.gov.in/MHA1/Par2017/pdfs/par2024-pdfs/RS27112024/228.pdf
- https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS02122025/432.pdf
- https://www.mha.gov.in/MHA1/Par2017/pdfs/par2026-pdfs/RS11022026/1338.pdf
- https://www.mha.gov.in/MHA1/Par2017/pdfs/par2026-pdfs/LS17032026/4118.pdf
- Not opened (HTTP 403): PIB press releases PRID=2082761 and PRID=2077948 on digital arrest.

**Dates.** As listed per item; accessed 4 Oct 2026.

**Confidence.** High that each figure is as printed in the reply. Medium for "most recent": later replies may exist.

---

## What FineX may show

**Verified and safe to offer an officer in a picker** (as options the officer chooses, never as advice that a section "applies"; a law officer should still confirm applicability to the case):

| Purpose | Offer exactly |
|---|---|
| Admissibility of the evidence packet | **Bharatiya Sakshya Adhiniyam, 2023, s.63** "Admissibility of electronic records"; certificate under **s.63(4)**, in the **Schedule** form, **Part A** (party / person in charge) and **Part B** (expert) |
| Ask an exchange to produce records | **BNSS 2023, s.94** "Summons to produce document or other thing" (court summons, or written order by an officer in charge of a police station, physical or electronic form) |
| Seize suspected property | **BNSS 2023, s.106** "Power of police officer to seize certain property", with the duty to report the seizure to the Magistrate (s.106(3)) |
| Attach proceeds of crime through a Court | **BNSS 2023, s.107** "Attachment, forfeiture or restoration of property" (police application with SP/CP approval; Court order) |
| Recording of search and seizure | **BNSS 2023, s.105** (audio-video recording, forwarded to the Magistrate) |
| Why an exchange holds KYC and transaction records | **PMLA, 2002** reporting entity s.2(1)(wa), records s.12; **S.O. 1072(E), 7 March 2023** (VDA activities); **CERT-In Directions No. 20(3)/2022, 28 April 2022, direction (vi)**: five years |
| Helpline wording | "1930: a toll-free helpline to get assistance in lodging online cyber complaints" (MHA, 17 Mar 2026) |
| Official figures | 2024 reported losses Rs 22,845.73 Crore (MHA, 2 Dec 2025); 3,962 Skype IDs and 83,668 WhatsApp accounts blocked for digital arrest (MHA, 18 Mar 2025). Always with the source and date |

Notes for the developer:
- Show the Schedule's own words and fields; **do not pre-fill or sign a certificate.** FineX's SHA-256 response hashes map to the Schedule's "SHA256" hash field, but Part A is for the person in charge of the source and Part B for an expert.
- The Schedule asks for **time in IST (24-hour) and date DD/MM/YYYY**. FineX prints UTC; any certificate helper should convert and say so.
- Section numbers apply to the new laws from **1 July 2024**. BNSS s.531(2) and BSA s.170(2) send matters already pending on that date to the old laws, so the picker needs a "which regime" choice left to the officer. If the old CrPC/IEA numbers are ever shown, label them "formerly" and never as current.

**Must not be shown:**
1. **The State Emblem of India**, in any form, or anything that suggests a government connection (Act 50 of 2005, ss.3, 4, 7). Also keep to the standing rule of no map of India with boundaries.
2. Any claim that **s.106 or s.107 freezes a wallet or an exchange account**, or that they "cover virtual digital assets". The text says neither; unverified.
3. Any claim that **an exchange must freeze on request**, or that CERT-In or PMLA oblige one to answer the police. They oblige it to keep records.
4. A statement that **Part B must be signed by a s.79A examiner**. The Supreme Court (22 May 2026) held that finding non-binding and left the question open.
5. The **Rs 11,158 Crore / 30.06.2026** figure, any digital-arrest **case counts or loss amounts** (none found at a primary source), and the **S.O. 848/849/850(E)** commencement numbers (not read).
6. The 1930 helpline described as a **digital-arrest** helpline. The official wording is general: help lodging online cyber complaints.
7. Section numbers on **"India Code" authority**. Say "as printed in the Gazette of India", because India Code itself was not opened.
8. Any **statute number the Act has not been read for**: this note covers only the provisions above. For IT Act, BNS offences (cheating, receipt of stolen property) and the Bankers' Books Evidence Act, nothing was verified here.

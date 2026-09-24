# -*- coding: utf-8 -*-
"""Edit the team's own Canva-exported deck in place.

Rules followed here:
  * Only text is changed, plus one image added (the QR) and a few new text
    boxes in space that is already empty. No shape is moved, resized, restyled
    or deleted, and no slide is added, removed or reordered.
  * Existing text is changed by rewriting the FIRST run of a paragraph and
    blanking the rest, so the run keeps its font, size, colour and italics.
  * New text boxes use real Calibri rather than Canva's embedded subset, which
    may not carry every glyph.
"""
import copy
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

SRC = r"C:\Users\Mohammad Ali\OneDrive\Desktop\ppt sih.pdf.pptx"
DST = r"C:\Users\Mohammad Ali\OneDrive\Desktop\ppt sih EDITED.pptx"
QR = r"C:\Users\Mohammad Ali\crypto-fraud-tracer\docs\pitch\qr-finex.png"

INK = RGBColor(0x11, 0x11, 0x11)
MUTED = RGBColor(0x45, 0x4B, 0x54)
ACCENT = RGBColor(0x0F, 0x5E, 0x7A)

prs = Presentation(SRC)
slides = list(prs.slides)
log = []


def set_para(shape, para_index, text):
    """Rewrite one paragraph, keeping the formatting of its first run."""
    para = shape.text_frame.paragraphs[para_index]
    if not para.runs:
        raise SystemExit(f"no runs to keep formatting from: {shape.shape_id}")
    para.runs[0].text = text
    for r in para.runs[1:]:
        r.text = ""


def shp(slide_i, idx):
    return list(slides[slide_i - 1].shapes)[idx]


def textbox(slide, x, y, w, h):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    return tf


def line(tf, text, size, bold=False, color=INK, first=False, align=PP_ALIGN.LEFT,
         italic=False, space_before=0):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_after = Pt(0)
    p.space_before = Pt(space_before)
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.name = "Calibri"
    r.font.color.rgb = color
    return p


# ------------------------------------------------------------------ slide 2
set_para(shp(2, 27), 0, "Real-Time Crypto Fraud & Exchange Identification")
log.append("S2: restored the spaces Canva dropped in the strapline")

shp(2, 40).text_frame.paragraphs[0].runs[1].text = (
    " is an end-to-end crypto fraud investigation platform that transforms suspect")
log.append("S2: restored spaces in 'FineX is an end-to-end...'")

set_para(shp(2, 50), 0,
         "Investigation Dashboard — Visualizes fund flow, risk, attribution "
         "confidence and case status.")
log.append("S2: removed the note-to-self 'make suitable infograph to suit it.'")

set_para(shp(2, 48), 0,
         "Exchange Attribution — Names the deposit account that can be frozen, "
         "not just the exchange.")
log.append("S2: attribution bullet now states the differentiator")

# ------------------------------------------------------------------ slide 5
set_para(shp(5, 36), 0,
         "Real-Time Monitoring — built: wallets at rest are re-checked, "
         "and alerts fire when funds move.")
log.append("S5: 'Real-Time Monitoring' moved from future to built")

s5 = slides[4]
figs = [
    ("241", "customer deposit\naddresses derived"),
    ("10", "exchanges covered,\nfrom 15 public seeds"),
    ("202", "OFAC-sanctioned\nTRON addresses"),
    ("6 of 6", "behavioural rules fire\non real recorded cases"),
    ("33 / 0", "transactions confirmed\non re-read / mismatched"),
    ("0", "commercial data\nlicences required"),
]
# Starts right of the FineX logo (which ends at 2.33 in) and ends before the
# Future Prospects column (14.73 in).
x = 2.50
for number, label in figs:
    tf = textbox(s5, x, 1.46, 2.00, 0.44)
    line(tf, number, 26, bold=True, color=ACCENT, first=True)
    tf2 = textbox(s5, x, 1.94, 2.00, 0.56)
    for k, ln in enumerate(label.split("\n")):
        line(tf2, ln, 12, color=MUTED, first=(k == 0))
    x += 2.04
tf = textbox(s5, 2.50, 2.52, 12.2, 0.22)
line(tf, "Counted from the committed repository. The re-read imports nothing from "
         "the tracer, so a bug in the tracer cannot make the check pass.",
     11, color=MUTED, italic=True, first=True)
log.append("S5: added the measured-figures strip above the impact columns")

# ------------------------------------------------------------------ slide 6
set_para(shp(6, 28), 0,
         "Real-Time Identification of Fraud-Linked Cryptocurrency Exchanges from "
         "Victim-Reported Suspect Wallet Addresses through Automated Blockchain Analytics")
log.append("S6: restored the spaces Canva dropped in the problem-statement title")

# Reference 2 becomes UNODC — the source that justifies TRON-first.
set_para(shp(6, 23), 0, "2. UNODC (2024) — Crime in South-East Asia, p. 20")
set_para(shp(6, 23), 1,
         "https://www.unodc.org/roseap/uploads/documents/Publications/2024/"
         "Casino_Underground_Banking_Report_2024.pdf")
shp(6, 23).text_frame.paragraphs[1].runs[0].font.size = Pt(15)
set_para(shp(6, 27), 0,
         "USDT on TRON has become a preferred choice - why this tool is TRON-first.")
log.append("S6: reference 2 is now the UNODC report (with page) instead of a repeat TRON link")

# Reference 3 was a vendor's marketing page; OFAC is the actual source.
set_para(shp(6, 17), 0, "3. OFAC Sanctions List (SDN) — US Treasury")
set_para(shp(6, 17), 1, "https://sanctionslist.ofac.treas.gov/Home/SdnList")
set_para(shp(6, 17), 2, "Source of the 202 sanctioned TRON addresses carried in the tool.")
set_para(shp(6, 26), 0, "")
log.append("S6: reference 3 TRM Labs replaced by the OFAC SDN list")

# Reference 4: strip the chatgpt tag and fix the chain named in the description.
set_para(shp(6, 25), 0, "4. TronGrid API Documentation — TRON Blockchain Data")
set_para(shp(6, 25), 1, "https://developers.tron.network/reference/trongrid-v1-api-overview")
set_para(shp(6, 25), 2, "TRC-20 transfer data read for every trace - no licence, no vendor.")
log.append("S6: reference 4 - removed ?utm_source=chatgpt.com and corrected 'Ethereum' to TRC-20/TRON")

s6 = slides[5]
tf = textbox(s6, 0.41, 7.00, 10.9, 0.34)
line(tf, "5. NCRP and SAHYOG — cybercrime.gov.in and sahyog.mha.gov.in",
     19, color=INK, first=True)
log.append("S6: added reference 5 - NCRP and SAHYOG")

set_para(shp(6, 29), 0, "github.com/reemrasheed2007/crypto-fraud-tracer")
shp(6, 29).text_frame.paragraphs[0].runs[0].font.size = Pt(16)
log.append("S6: the GitHub line now carries the actual URL")

# The working deployment: QR plus the link, in the empty band under the logo.
s6.shapes.add_picture(QR, Inches(8.60), Inches(9.42), width=Inches(1.10))
# Two lines: the live tool, and a reserved blank for the narrated video link.
# The label "Demo video (58 s):" is the handle used to fill it in later.
tf = textbox(s6, 1.57, 10.54, 6.90, 0.56)
line(tf, "Live tool:  crypto-fraud-tracer.onrender.com", 14, color=INK, first=True)
line(tf, "Demo video (58 s):  ________________________", 14, color=MUTED, space_before=2)
log.append("S6: added the QR, the live link, and a ruled blank for the video link")

# ------------------------------------------------- slide 2, second pass
set_para(shp(2, 47), 0,
         "Automated Tracing — Follows a wallet or transaction hash across "
         "intermediary wallets.")
log.append("S2: intake now states that a transaction hash works too")

set_para(shp(2, 50), 0,
         "Triage & Dashboard — Every complaint returns CRITICAL, SUSPICIOUS or "
         "CLOSED, with fund flow and case status.")
log.append("S2: point 4 now names the three dispositions - the triage claim")

# ------------------------------------------------------------------ slide 4
# Three risks a judge would actually raise, each with what we do about it.
# The arch holds about fourteen lines at this size, so each replacement is
# kept to the line count of the text it replaces.
set_para(shp(4, 34), 1, " Public API rate limits. Mitigation:")
set_para(shp(4, 34), 2, "Adaptive pacing; an unread wallet is never empty.")
set_para(shp(4, 34), 4, "Mixers and bridges end the trail. Mitigation:")
set_para(shp(4, 34), 5, "Recorded as a hard stop; case closes CLOSED.")
set_para(shp(4, 34), 7, "Attribution is a heuristic. Mitigation: confidence + "
                        "evidence tier.")
log.append("S4: the three risks are now rate limits, mixers/bridges and heuristic attribution")

# ------------------------------------------------------------------ slide 1
# The separators were a mix of "-", "- " and " – ". Make them one.
s1_13 = shp(1, 13)
s1_13.text_frame.paragraphs[0].runs[0].text = "Theme – "
s1_13.text_frame.paragraphs[1].runs[0].text = "PS Category – "
s1_13.text_frame.paragraphs[2].runs[0].text = "Team ID – "
s1_13.text_frame.paragraphs[3].runs[0].text = "Team Name (Registered on portal) – "
log.append("S1: made the label separators consistent")

# ------------------------------------------------- final tidy, slides 3 & 4
# Two tech-stack items had been merged into one bullet by the export.
stack = shp(3, 23).text_frame
set_para(shp(3, 23), 5, "JSON datasets in the repository")
src_p = stack.paragraphs[5]._p
new_p = copy.deepcopy(src_p)
src_p.addnext(new_p)
for r in new_p.findall(".//{http://schemas.openxmlformats.org/drawingml/2006/main}t"):
    r.text = "Rule-based scoring"
log.append("S3: split the merged 'repository / rule-based scoring' bullet")

set_para(shp(4, 33), 0, "Low-cost deployment. No data-licensing cost.")
set_para(shp(4, 33), 2, "Scalable operations — automated tracing and complaint "
                        "triage. Less manual effort. Self-hosted.")
set_para(shp(4, 35), 1, "Data – public blockchain & attribution data. "
                        "Infrastructure – cloud deployment. Security – secure "
                        "data handling.")
log.append("S4: cleaned an orphan full stop and two ragged separators")

prs.save(DST)
print("saved:", DST)
print()
for item in log:
    print(" -", item)

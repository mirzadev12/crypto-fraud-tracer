"""
Refinement pass on the team's deck — 24 September 2026, the third and last step.

    python docs/pitch/edit_deck.py
    python docs/pitch/deck-edits-2026-09-24.py "<EDITED>.pptx" "<EDITED>.pptx"
    python docs/pitch/deck-refine-2026-09-24.py "<EDITED>.pptx" "<EDITED>.pptx"

Same six slides, same order, same template. What this pass changes is
placement and finish: text that sat on, across or outside its border now sits
inside it with even padding, and every bullet is a real bullet. Canva exported
bullet dots and underlines as separate shapes — and on slide 4 painted them
into the arch pictures — so wherever the wording changed, dots and lines and
text drifted apart. Sizes were chosen by measuring each string with the deck's
own embedded fonts, then checked in a PowerPoint render.

  S1  "–" separators throughout; "Team Name (Registered on portal) – FineX" no
      longer wraps its dash off the bottom of the slide; the PS title's second
      and third lines align with the text column, and the first clears the lamp.
  S2  the problem line states the scale — ₹22,845 crore reported lost to cyber
      fraud in 2024 (MHA, Lok Sabha USQ 344, 22 Jul 2025); the four feature
      bars share one size and sit centred in their bars; the two black cards
      are short lists that stay inside the card; one page number.
  S3  the architecture is scaled so "PROCESS FLOWCHART:" no longer sits on it;
      the tech stack is a real, left-aligned list (it was justified, which
      opened gaps between words); a live-prototype panel below it.
  S4  the dots and lines baked into the arch pictures are painted out and each
      arch is a padded list; risks are Risk / Mitigation pairs.
  S5  column headings sit below their circles instead of across them; no word
      breaks mid-word; future prospects are three aligned bullets.
  S6  one reference list in one style — seven sources, each linked and each
      saying what it is used for — instead of four styles and underlines drawn
      as separate lines of the wrong length; "GitHub".
  All page numbers: one per slide, same face, same place.

Refuses to write if any shape is not where it expects, and refuses to run on a
deck it has already refined.
"""

import copy
import io
import re
import sys
from collections import Counter
from pathlib import Path

from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.opc.constants import RELATIONSHIP_TYPE as RT
from pptx.util import Emu, Inches

HERE = Path(__file__).resolve().parent
PROTOTYPE = HERE / "deck-assets" / "prototype-2026-09-24.png"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"a": A, "p": P}
MARKER = "FineX references"
SITE_URL = "https://crypto-fraud-tracer.onrender.com"

problems = []


def q(tag):
    return f"{{{A}}}{tag}"


# ------------------------------------------------------------------ finding

def find(slide, name, startswith=None, empty=False, required=True):
    """The one shape called `name` (optionally whose text starts with `startswith`)."""
    hits = []
    for sh in slide.shapes:
        if sh.name != name:
            continue
        text = sh.text_frame.text.strip() if sh.has_text_frame else None
        if empty:
            if text == "":
                hits.append(sh)
        elif startswith is None or (text is not None and text.startswith(startswith)):
            hits.append(sh)
    if len(hits) != 1:
        if required:
            problems.append(f"slide {slide.slide_id}: {name!r} {startswith or ''!r}: found {len(hits)}")
        return None
    return hits[0]


def delete(shape):
    if shape is not None:
        el = shape._element
        el.getparent().remove(el)


def delete_child(group, name):
    for sh in group.shapes:
        if sh.name == name:
            delete(sh)
            return
    problems.append(f"{group.name}: child {name!r} not found")


def clone(slide, shape, name):
    """Copy a shape (or group) onto the same slide with fresh ids."""
    el = copy.deepcopy(shape._element)
    tree = slide.shapes._spTree
    next_id = max(int(c.get("id")) for c in tree.iter(f"{{{P}}}cNvPr")) + 1
    for c in el.iter(f"{{{P}}}cNvPr"):
        c.set("id", str(next_id))
        next_id += 1
    next(el.iter(f"{{{P}}}cNvPr")).set("name", name)
    tree.insert_element_before(el, "p:extLst")
    return next(sh for sh in slide.shapes if sh.name == name)


# ------------------------------------------------------------------ geometry

def place(shape, x=None, y=None, w=None, h=None):
    if shape is None:
        return
    if x is not None:
        shape.left = Inches(x)
    if y is not None:
        shape.top = Inches(y)
    if w is not None:
        shape.width = Inches(w)
    if h is not None:
        shape.height = Inches(h)


def body(shape, anchor="t", insets=(0, 0, 0, 0)):
    """Fixed box (no autofit), wrapped, with the given anchor and insets."""
    bp = shape.text_frame._txBody.find(q("bodyPr"))
    pos = 0
    for child in list(bp):
        if child.tag in (q("spAutoFit"), q("normAutofit"), q("noAutofit")):
            pos = list(bp).index(child)
            bp.remove(child)
        elif child.tag == q("prstTxWarp"):
            pos = list(bp).index(child) + 1
    bp.insert(pos, etree.Element(q("noAutofit")))
    bp.set("wrap", "square")
    bp.set("anchor", anchor)
    for key, val in zip(("lIns", "tIns", "rIns", "bIns"), insets):
        bp.set(key, str(int(Inches(val))))


# ------------------------------------------------------------------ text

def rpr(face, size, color="000000", bold=False, italic=False, underline=False):
    el = etree.Element(q("rPr"))
    el.set("lang", "en-US")
    el.set("sz", str(int(round(size * 100))))
    el.set("b", "1" if bold else "0")
    el.set("i", "1" if italic else "0")
    if underline:
        el.set("u", "sng")
    fill = etree.SubElement(el, q("solidFill"))
    etree.SubElement(fill, q("srgbClr")).set("val", color)
    for slot in ("latin", "ea", "cs", "sym"):
        etree.SubElement(el, q(slot)).set("typeface", face)
    return el


def clear(shape):
    tx = shape.text_frame._txBody
    for p in tx.findall(q("p")):
        tx.remove(p)
    return tx


def para(tx, runs, algn="l", line=1.0, before=0, after=0, bullet=None, indent_in=0.0, part=None):
    """Append a paragraph. `runs` is a list of (text, rPr element, url-or-None)."""
    p = etree.SubElement(tx, q("p"))
    ppr = etree.SubElement(p, q("pPr"))
    ppr.set("algn", algn)
    if bullet:
        ppr.set("marL", str(int(Inches(indent_in))))
        ppr.set("indent", str(-int(Inches(indent_in))))
    ls = etree.SubElement(ppr, q("lnSpc"))
    etree.SubElement(ls, q("spcPct")).set("val", str(int(line * 100000)))
    if before:
        sb = etree.SubElement(ppr, q("spcBef"))
        etree.SubElement(sb, q("spcPts")).set("val", str(int(before * 100)))
    if after:
        sa = etree.SubElement(ppr, q("spcAft"))
        etree.SubElement(sa, q("spcPts")).set("val", str(int(after * 100)))
    if bullet:
        bc = etree.SubElement(ppr, q("buClr"))
        etree.SubElement(bc, q("srgbClr")).set("val", bullet[1])
        etree.SubElement(ppr, q("buFont")).set("typeface", "Arial")
        etree.SubElement(ppr, q("buChar")).set("char", bullet[0])
    else:
        etree.SubElement(ppr, q("buNone"))
    for text, props, url in runs:
        r = etree.SubElement(p, q("r"))
        props = copy.deepcopy(props)
        if url:
            rid = part.relate_to(url, RT.HYPERLINK, is_external=True)
            link = etree.SubElement(props, q("hlinkClick"))
            link.set(f"{{{R}}}id", rid)
        r.append(props)
        etree.SubElement(r, q("t")).text = text
    return p


def add_box(slide, name, x, y, w, h, anchor="t"):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    box.name = name
    body(box, anchor)
    clear(box)
    return box


# ------------------------------------------------------------------ pictures

SVG_BLIP = "{96DAC541-7B7A-43D3-8B79-37D633B846F1}"
ASVG = "http://schemas.microsoft.com/office/drawing/2016/SVG/main"
MARK_PATH = re.compile(r'<path fill="#[0-9A-Fa-f]{6}"[^>]*/>')


def clean_arch(slide, name):
    """Remove the bullet dots and underlines Canva painted into an arch picture.

    Canva stores each picture twice — an SVG, which PowerPoint draws, and a PNG
    fallback. In the SVG the arch itself is two paths that take the group's
    colour; every dot and underline is a path carrying a fill of its own, so
    those are removed and the arch keeps its shape. The PNG fallback is
    painted its own flat colour to match.
    """
    sh = find(slide, name)
    if sh is None:
        return
    blip = sh._element.find(".//" + q("blip"))
    svg = blip.find(f".//{{{ASVG}}}svgBlip")
    if svg is None:
        problems.append(f"{name}: no SVG copy found")
        return
    svg_part = slide.part.related_part(svg.get(f"{{{R}}}embed"))
    text = svg_part.blob.decode("utf8")
    cleaned, n = MARK_PATH.subn("", text)
    if n == 0:
        problems.append(f"{name}: no marks found in the SVG")
        return
    svg_part._blob = cleaned.encode("utf8")
    png_part = slide.part.related_part(blip.get(f"{{{R}}}embed"))
    im = Image.open(io.BytesIO(png_part.blob)).convert("RGBA")
    data = im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata()
    opaque = [px[:3] for px in data if px[3] > 250]
    base, count = Counter(opaque).most_common(1)[0]
    if count >= 0.95 * len(opaque):
        flat = Image.new("RGBA", im.size, base + (255,))
        flat.putalpha(im.getchannel("A"))
        buf = io.BytesIO()
        flat.save(buf, "PNG")
        png_part._blob = buf.getvalue()


# ------------------------------------------------------------------ fonts

ARIAL_B, ARIAL_I = "Arial Bold", "Arial Italics"
CAL, CAL_I, CAL_BI = "Calibri (MS)", "Calibri (MS) Italics", "Calibri (MS) Bold Italics"
CANVA = "CanvaSansSC-Regular"
TNR_I = "Times New Roman Italics"
INK, GREY, NAVY, WHITE = "000000", "3A3A3A", "2C0A71", "FFFFFF"


def page_number(slide, keep, drop=()):
    for sh in drop:
        delete(sh)
    if keep is None:
        return
    place(keep, x=19.20, y=10.70, w=0.50, h=0.40)
    body(keep, "t")
    n = keep.text_frame.text.strip()
    tx = clear(keep)
    para(tx, [(n, rpr(CANVA, 18, "404040"), None)], algn="r")


# ================================================================== slides

def slide1(s):
    ps = find(s, "TextBox 24", "Problem Statement ID")
    value = find(s, "TextBox 31", "26183")
    if ps is not None and value is not None:
        label = copy.deepcopy(ps.text_frame.paragraphs[0].runs[0]._r.find(q("rPr")))
        val = copy.deepcopy(value.text_frame.paragraphs[0].runs[0]._r.find(q("rPr")))
        ppr = copy.deepcopy(ps.text_frame.paragraphs[0]._p.find(q("pPr")))
        tx = clear(ps)
        p = etree.SubElement(tx, q("p"))
        p.append(ppr)
        # One paragraph that wraps after the ID value, so the two labels keep
        # the line pitch the bullet dots were placed for.
        for text, props in (("Problem Statement ID – ", label), ("26183", val),
                            (" ", label), ("Problem Statement Title –", label)):
            r = etree.SubElement(p, q("r"))
            r.append(copy.deepcopy(props))
            etree.SubElement(r, q("t")).text = text
        place(ps, w=6.80)
        delete(value)
    first = find(s, "TextBox 29", "Real-Time Identification")
    rest = find(s, "TextBox 30", "Cryptocurrency Exchanges")
    for sh in (first, rest):
        if sh is not None:
            for r in sh.text_frame.paragraphs[0].runs:
                r._r.find(q("rPr")).set("sz", "2800")
    place(first, x=7.42, y=4.79)
    place(rest, x=1.48)
    team = find(s, "TextBox 25", "Theme")
    fin = find(s, "TextBox 27", "FineX")
    if team is not None and fin is not None:
        p3 = team.text_frame.paragraphs[3]
        p2 = team.text_frame.paragraphs[2]
        p3.runs[0].text = "Team Name (Registered on portal) – "
        r = copy.deepcopy(p2.runs[1]._r)
        r.find(q("t")).text = "FineX"
        p3.runs[0]._r.addnext(r)  # before any endParaRPr, which must stay last
        place(team, w=9.60)
        delete(fin)
    delete(find(s, "TextBox 28", empty=True, required=False))
    page_number(s, find(s, "TextBox 26", "1"))


def slide2(s, part):
    problem = find(s, "TextBox 57", "Stolen crypto")
    if problem is not None:
        tx = clear(problem)
        para(tx, [("₹22,845 crore reported lost to cyber fraud in 2024 (MHA); stolen crypto is layered through wallets.",
                   rpr(CAL_I, 27, INK, italic=True), None)], algn="ctr")
    edge = find(s, "TextBox 67", "OUR COMPETITIVE EDGE")
    if edge is not None:
        edge.text_frame.paragraphs[0].runs[0].text = "OUR COMPETITIVE EDGE:"
    # The four bars: one size, centred in the bar (body bands measured from the group).
    bars = [("TextBox 75", "Automated Tracing", 4.72, "Automated Tracing —",
             " Follows funds hop by hop from a wallet or transaction hash."),
            ("TextBox 76", "Exchange Attribution", 6.36, "Exchange Attribution —",
             " Names the exact deposit account an exchange can freeze."),
            ("TextBox 77", "Fraud Pattern Detection", 7.99, "Fraud Pattern Detection —",
             " Six explainable rules flag laundering behaviour."),
            ("TextBox 78", "Triage", 9.60, "Triage & Alerts —",
             " Rates every case CRITICAL, SUSPICIOUS or CLOSED; alerts when funds move.")]
    for name, start, top, lead, rest in bars:
        sh = find(s, name, start)
        if sh is None:
            continue
        place(sh, x=2.14, y=top, w=6.26, h=1.45)
        body(sh, "ctr")
        tx = clear(sh)
        para(tx, [(lead, rpr(CAL_BI, 22, INK, bold=True, italic=True), None),
                  (rest, rpr(CAL_I, 22, INK, italic=True), None)], algn="ctr", line=0.95)
    # The two black cards: short lists that stay inside the card.
    # A no-break space ties each arrow to what follows it, so every item
    # breaks the same way: the problem, then "→ the answer" on its own line.
    cards = [("TextBox 71", "-Funds disappear", 12.50,
              ["Funds split across wallets → followed hop by hop",
               "Exchange never named → deposit account named",
               "Money may still be there → flagged CRITICAL"]),
             ("TextBox 72", "-From attribution", 16.42,
              ["SHA-256 evidence packet for every case",
               "Draft freeze request for the exchange",
               "Alert the moment a CRITICAL wallet moves"])]
    for name, start, x, items in cards:
        sh = find(s, name, start)
        if sh is None:
            continue
        place(sh, x=x, y=7.36, w=3.12, h=2.90)
        body(sh, "ctr")
        tx = clear(sh)
        for i, item in enumerate(items):
            para(tx, [(item, rpr(CAL, 19, WHITE), None)], line=0.95, before=0 if i == 0 else 12,
                 bullet=("•", WHITE), indent_in=0.22)
    page_number(s, find(s, "TextBox 73", "2"), drop=[find(s, "TextBox 53", "2")])


def slide3(s, part):
    arch = find(s, "Group 5")
    if arch is not None:
        k = 5.75 / 6.09
        w, h = arch.width, arch.height
        arch.width, arch.height = Emu(int(w * k)), Emu(int(h * k))
        place(arch, x=0.31, y=1.75)
    for n in (13, 15, 17, 19, 21, 23, 25, 27, 29):
        delete(find(s, f"Group {n}"))
    stack = find(s, "TextBox 40", "Next.js")
    if stack is not None:
        place(stack, x=15.38, y=2.86, w=4.46, h=3.90)
        body(stack, "t")
        tx = clear(stack)
        items = ["Next.js 16 + React 19 (TypeScript)", "Tailwind CSS 4", "Node.js 22 on Render (cloud)",
                 "TronGrid API — TRC-20 reads", "OFAC SDN list + explorer tags", "JSON files — no database",
                 "Rule-based scoring: 6 rules", "SHA-256 chain of custody", "@xyflow/react (only UI library)"]
        for i, item in enumerate(items):
            para(tx, [(item, rpr(CAL, 20, INK), None)], line=0.95, before=0 if i == 0 else 5,
                 bullet=("•", INK), indent_in=0.28)
    # The working prototype, under the stack: heading, screenshot, link.
    heading = find(s, "TextBox 39", "TECH STACK USED")
    rule = find(s, "Group 31")
    if heading is not None and rule is not None and PROTOTYPE.exists():
        new_head = clone(s, heading, "Prototype heading")
        new_head.top = Inches(6.86)
        new_head.width = Inches(4.46)
        new_head.text_frame.paragraphs[0].runs[0].text = "LIVE PROTOTYPE:"
        new_line = clone(s, rule, "Prototype rule")
        new_line.top = Inches(6.86) + (rule.top - heading.top)
        shot = s.shapes.add_picture(str(PROTOTYPE), Inches(15.38), Inches(7.50), width=Inches(4.46))
        shot.name = "Prototype screenshot"
        shot.click_action.hyperlink.address = SITE_URL
        shot.line.color.rgb = RGBColor(0x9A, 0x9A, 0x9A)
        shot.line.width = Emu(9525)
        cap = add_box(s, "Prototype link", 15.38, 7.50 + shot.height / 914400 + 0.06, 4.46, 0.32)
        para(cap.text_frame._txBody, [("Live: ", rpr(CAL, 14, GREY), None),
                                      ("crypto-fraud-tracer.onrender.com", rpr(CAL, 14, "1F4E9A"), SITE_URL)],
             part=part)
    footer_number = find(s, "TextBox 35", "3")
    page_number(s, find(s, "TextBox 41", "3"), drop=[footer_number])


def slide4(s):
    for name in ("Freeform 6", "Freeform 7", "Freeform 8", "Freeform 10"):
        clean_arch(s, name)
    bullet = ("•", INK)

    def fill(sh, x, y, w, items):
        place(sh, x=x, y=y, w=w, h=11.15 - y)
        body(sh, "t")
        tx = clear(sh)
        for i, item in enumerate(items):
            para(tx, [(item, rpr(CANVA, 18, INK), None)], line=1.0, before=0 if i == 0 else 9,
                 bullet=bullet, indent_in=0.26)

    tech = find(s, "TextBox 34", "Live TRON data")
    if tech is not None:
        fill(tech, 1.14, 5.16, 3.52,
             ["Live TRON data → real-time tracing through the TronGrid API.",
              "Working prototype → deployed; 10 real cases traced end to end.",
              "Re-read on-chain → 31 of 31 sampled deposit addresses still hold.",
              "Transparent confidence → evidence shown for every label."])
        delete(find(s, "TextBox 35", "Transparent confidence"))
        delete(find(s, "TextBox 36", "Re-read on-chain"))
    econ = find(s, "TextBox 37", "Low-cost deployment")
    if econ is not None:
        fill(econ, 5.70, 5.16, 3.36,
             ["Low-cost deployment on one cloud instance.",
              "No data-licensing cost: public chain data and the OFAC list.",
              "Scales by batch: a morning's complaints traced in one run.",
              "Self-hostable; no database to buy or run."])
    risk = find(s, "TextBox 38", "problem 1")
    if risk is not None:
        place(risk, x=10.03, y=5.08, w=3.40, h=6.05)
        body(risk, "t")
        tx = clear(risk)
        pairs = [("Risk 1: ", "public API rate limits.",
                  "adaptive pacing; an unread wallet is never reported as empty."),
                 ("Risk 2: ", "mixers and bridges end the trail.",
                  "the case closes there; an address on another chain is screened against OFAC."),
                 ("Risk 3: ", "attribution is a heuristic.",
                  "every label shows its confidence and evidence tier.")]
        for i, (label, what, fix) in enumerate(pairs):
            para(tx, [(label, rpr(CANVA, 18, NAVY, bold=True), None), (what, rpr(CANVA, 18, NAVY), None)],
                 line=1.0, before=0 if i == 0 else 12)
            para(tx, [("Mitigation: ", rpr(CANVA, 18, INK, bold=True), None), (fix, rpr(CANVA, 18, INK), None)],
                 line=1.0, before=3)
    res = find(s, "TextBox 39", "Development")
    if res is not None:
        fill(res, 14.82, 5.42, 3.36,
             ["Development — Next.js, Node.js, TypeScript.",
              "Chain access — TronGrid API (free tier).",
              "Data — public chain data, explorer tags, the OFAC list.",
              "Infrastructure — one cloud web service.",
              "Security — SHA-256 hash of every chain response."])
    page_number(s, find(s, "TextBox 13", "4"))


def slide5(s):
    # Column geometry: the grey body and the bottom of each column's circle.
    columns = [
        (0.16, 2.09, 4.70, "INVESTIGATION IMPACT",
         "Accelerates cybercrime investigations by tracing fund movement from a reported wallet to likely exchange destinations."),
        (2.56, 4.49, 5.35, "TECHNICAL IMPACT",
         "Automates multi-hop blockchain tracing and converts on-chain activity into an evidence-backed investigation trail."),
        (4.96, 6.89, 5.99, "INSTITUTIONAL IMPACT",
         "Supports law-enforcement workflows through bulk triage, evidence packets and exchange-ready freeze requests."),
        (7.40, 9.32, 6.97, "VICTIM IMPACT",
         "Prioritizes time-sensitive cases where stolen funds may still be traceable or reachable."),
        (9.84, 11.76, 7.72, "OPERATIONAL IMPACT",
         "Enables faster case prioritization and investigator response."),
        (12.10, 14.02, 8.22, "ECONOMIC IMPACT",
         "Reduces manual effort and avoids costly data licences."),
    ]
    # The big letters stay where they are; their headings and bodies move out.
    for name, letter in (("TextBox 64", "M"), ("TextBox 65", "P"), ("TextBox 66", "A"), ("TextBox 68", "T")):
        sh = find(s, name, letter)
        if sh is None:
            continue
        tx = sh.text_frame._txBody
        for p in tx.findall(q("p"))[1:]:
            tx.remove(p)
    for name, start in (("TextBox 69", "INVESTIGATION"), ("TextBox 70", "OPERATIONAL"),
                        ("TextBox 71", "Accelerates"), ("TextBox 72", "Enables")):
        delete(find(s, name, start))
    for i, (x0, x1, circle_bottom, heading, text) in enumerate(columns, 1):
        box = add_box(s, f"Impact column {i}", x0 + 0.06, circle_bottom + 0.10, (x1 - x0) - 0.12,
                      11.18 - circle_bottom - 0.10)
        tx = box.text_frame._txBody
        para(tx, [(heading, rpr(CANVA, 15, INK, bold=True), None)], algn="ctr", line=0.95)
        para(tx, [(text, rpr(CANVA, 17, INK), None)], algn="ctr", line=1.0, before=6)
    # Future prospects: three aligned bullets clear of the icons.
    delete(find(s, "Group 53"))
    delete(find(s, "Group 55"))
    coins = find(s, "Group 50")
    if coins is not None:
        delete_child(coins, "Freeform 51")
    items = [("TextBox 73", "FUTURE PROSPECTS", 2.17, "Multi-chain tracing —",
              " Ethereum & BSC next; OFAC screening already covers 20 assets."),
             ("TextBox 74", "Law-Enforcement", 5.40, "NCRP / SAHYOG integration —",
              " complaints arrive by API; ML ranks the queue, rules decide."),
             ("TextBox 75", "Real-Time Monitoring", 8.30, "24×7 alerts —",
              " move today's desk-side watch to a server-side scheduler.")]
    for name, start, top, lead, rest in items:
        sh = find(s, name, start)
        if sh is None:
            continue
        runs = [(lead, rpr(CAL_BI, 21, INK, bold=True, italic=True), None),
                (rest, rpr(CAL_I, 21, INK, italic=True), None)]
        if name == "TextBox 73":
            # The heading keeps its box and its width; the first item gets a
            # box of its own, the same width as the other two.
            tx = sh.text_frame._txBody
            for p in tx.findall(q("p"))[1:]:
                tx.remove(p)
            sh = add_box(s, "Prospect 1", 14.73, 2.86, 3.85, 1.70)
        else:
            place(sh, x=14.73, y=top, w=3.85, h=1.60)
            body(sh, "t")
            clear(sh)
        para(sh.text_frame._txBody, runs, line=0.95, bullet=("•", INK), indent_in=0.27)
    page_number(s, find(s, "TextBox 76", "5"))


REFERENCES = [
    ("1. Smart India Hackathon 2026 — Problem Statement SIH26183 (MHA · I4C)", "https://sih.gov.in/sih2026PS",
     "Real-Time Identification of Fraud-Linked Cryptocurrency Exchanges from Victim-Reported Suspect Wallet Addresses."),
    ("2. Ministry of Home Affairs — Lok Sabha Unstarred Question 344, 22 Jul 2025",
     "https://www.mha.gov.in/MHA1/Par2017/pdfs/par2025-pdfs/LS22072025/344.pdf",
     "₹22,845.73 crore reported lost to cyber fraud in 2024, up from ₹7,465.18 crore in 2023 (NCRP + CFCFRMS)."),
    ("3. UNODC (2024) — Casinos, Money Laundering & Underground Banking, p. 20",
     "https://www.unodc.org/roseap/uploads/documents/Publications/2024/Casino_Underground_Banking_Report_2024.pdf",
     "“USDT on the TRON blockchain has become a preferred choice for crypto money launderers” — why FineX is TRON-first."),
    ("4. Chainalysis — The 2025 Crypto Crime Report", "https://www.chainalysis.com/blog/2025-crypto-crime-report-introduction/",
     "Stablecoins made up 63% of illicit crypto transaction volume in 2024."),
    ("5. OFAC Specially Designated Nationals (SDN) List — US Treasury", "https://sanctionslist.ofac.treas.gov/Home/SdnList",
     "Source of the 334 sanctioned TRON addresses carried, and 709 more screened across 19 other assets."),
    ("6. TronGrid API — TRON Developer Documentation", "https://developers.tron.network/reference/trongrid-v1-api-overview",
     "TRC-20 transfer data read for every trace; no licence, no vendor."),
    ("7. NCRP and SAHYOG — cybercrime.gov.in · sahyog.mha.gov.in", "https://cybercrime.gov.in/",
     "India's complaint and coordination portals: the planned intake route for complaints."),
]


def slide6(s, part):
    for name, start in (("TextBox 34", "1. Smart India"), ("TextBox 41", "Real-Time Identification"),
                        ("TextBox 36", "2. UNODC"), ("TextBox 40", "USDT on TRON"),
                        ("TextBox 30", "3. OFAC"), ("TextBox 38", "4. TronGrid"), ("TextBox 44", "5. NCRP")):
        delete(find(s, name, start))
    for name in ("TextBox 29", "TextBox 33", "TextBox 35", "TextBox 37", "TextBox 39"):
        delete(find(s, name, empty=True, required=False))
    for n in (9, 11, 13, 15, 17, 21, 23):
        delete(find(s, f"Group {n}"))
    box = add_box(s, MARKER, 0.41, 2.12, 9.95, 5.20)
    tx = box.text_frame._txBody
    for i, (title, url, what) in enumerate(REFERENCES):
        para(tx, [(title, rpr(TNR_I, 21, INK, italic=True), url)], line=0.95, before=0 if i == 0 else 7, part=part)
        para(tx, [(what, rpr(CAL, 14, GREY), None)], line=0.95, before=1)
    gh = find(s, "TextBox 32", "Github repository")
    if gh is not None:
        gh.text_frame.paragraphs[0].runs[0].text = "GitHub repository"
        place(gh, w=3.80)  # "GitHub" is wider than "Github"; keep it on one line
    page_number(s, find(s, "TextBox 43", "6"), drop=[find(s, "TextBox 27", "6")])


def main(src, dst):
    deck = Presentation(src)
    slides = list(deck.slides)
    if any(sh.name == MARKER for sh in slides[5].shapes):
        sys.exit("This deck has already been refined; start again from edit_deck.py.")
    slide1(slides[0])
    slide2(slides[1], slides[1].part)
    slide3(slides[2], slides[2].part)
    slide4(slides[3])
    slide5(slides[4])
    slide6(slides[5], slides[5].part)
    if problems:
        sys.exit("Refusing to write:\n  " + "\n  ".join(problems))
    deck.save(dst)
    print(f"deck refined -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

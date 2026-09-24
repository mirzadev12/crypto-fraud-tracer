"""
Edits to the team's Canva deck, 24 September 2026.

Run AFTER edit_deck.py (which builds "ppt sih EDITED.pptx" from the untouched
original). It changes wording, links and a few positions; it never adds a
slide, never changes the template, and never makes a text longer than the text
it replaces. Every step checks what it is about to change and the script
refuses to write if anything is not where it expects. It is idempotent: running
it twice gives the same file.

    python deck-edits-2026-09-24.py "ppt sih EDITED.pptx" "ppt sih EDITED.pptx"

What and why (CONTEXT.md §8.6 and docs/HANDOFF-LOCAL.md §5):
  S2  second black box repeated the first -> names the hashed evidence packet
  S3  architecture picture named parts FineX does not have (a case database,
      DEX metrics, InsightX, /api/cases) -> replaced with the patched picture in
      deck-assets/architecture-2026-09-24.png; template footer that showed over
      the flowchart made invisible (slide 6's already is); page number moved
      below the last tech-stack line it overlapped; the process flowchart's
      "freese request" -> deck-assets/flowchart-2026-09-24.png
  S4  bridges were never "recorded as a hard stop" in code; three vague lines
      made specific and measured
  S5  202 -> 334 sanctioned TRON addresses (OFAC refresh); multi-chain screening
      is built; ML stated as ranking on I4C-confirmed cases; text insets so the
      two prospects clear their icons
  S6  202 -> 334; the TronGrid link carried a chatbot utm tag; the demo video link; clickable links; QR enlarged and labelled;
      the link lines moved clear of the GitHub underline
"""

import copy
import sys
from pathlib import Path

from lxml import etree
from pptx import Presentation
from pptx.util import Emu, Inches, Pt

HERE = Path(__file__).resolve().parent
ARCHITECTURE = HERE / "deck-assets" / "architecture-2026-09-24.png"
FLOWCHART = HERE / "deck-assets" / "flowchart-2026-09-24.png"
NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}

DEMO_URL = "https://www.youtube.com/watch?v=A4AipdXDDsk"
SITE_URL = "https://crypto-fraud-tracer.onrender.com"
REPO_URL = "https://github.com/reemrasheed2007/crypto-fraud-tracer"
TRONGRID_URL = "https://developers.tron.network/reference/trongrid-v1-api-overview"

TEXT = [
    # (slide, shape, old, new) — each old text must be exactly one run
    (2, "TextBox 72",
     "-From attribution to freeze request. -Generates ready-to- sign freeze requests.",
     "-From attribution to freeze request. -SHA-256 evidence packet for every case."),
    (4, "TextBox 35",
     "Transparent confidence → Sweep evidence, not accuracy.",
     "Transparent confidence → evidence shown per label."),
    (4, "TextBox 36",
     "Validated dataset → 2,500 tagged accounts scanned",
     "Re-read on-chain → 31/31 deposit addresses hold"),
    (4, "TextBox 38",
     "Recorded as a hard stop; case closes CLOSED.",
     "Sanctions hit closes it; no guessing past."),
    (4, "TextBox 39",
     "Data – public blockchain & attribution data. Infrastructure – cloud deployment. Security – secure data handling.",
     "Data – public blockchain & attribution data. Infrastructure – cloud deployment. Security – SHA-256 audit trail."),
    (5, "TextBox 80", "202", "334"),
    (5, "TextBox 73",
     "Multi-Chain Expansion — Extend tracing beyond TRON to Ethereum, BSC and other major chains.",
     "Multi-Chain — built: every OFAC-listed chain is screened. Next: tracing Ethereum, BSC."),
    (5, "TextBox 74",
     "Law-Enforcement Integration — Connect with platforms such as NCRP / SAHYOG for complaint-to-investigation workflows.",
     "Law-Enforcement Integration — NCRP / SAHYOG intake; then ML ranking trained on I4C-confirmed cases."),
    (6, "TextBox 30",
     "Source of the 202 sanctioned TRON addresses carried in the tool.",
     "Source of the 334 sanctioned TRON addresses carried in the tool."),
]

problems: list[str] = []


def shape(slide, name):
    found = [s for s in slide.shapes if s.name == name]
    if len(found) != 1:
        problems.append(f"slide {slide.slide_id}: expected one shape named {name!r}, found {len(found)}")
        return None
    return found[0]


def runs_of(shp):
    return [r for p in shp.text_frame.paragraphs for r in p.runs]


def replace_text(deck):
    for slide_no, name, old, new in TEXT:
        if len(new) > len(old):
            problems.append(f"S{slide_no} {name}: new text longer than old")
            continue
        shp = shape(deck.slides[slide_no - 1], name)
        if shp is None:
            continue
        # Some runs carry a leading or trailing space in the Canva export; match on the stripped text.
        hits = [r for r in runs_of(shp) if r.text.strip() == old]
        done = [r for r in runs_of(shp) if r.text.strip() == new]
        if len(hits) == 1:
            r = hits[0]
            r.text = r.text.replace(old, new)
        elif not hits and len(done) == 1:
            pass
        else:
            problems.append(f"S{slide_no} {name}: {len(hits)} run(s) read {old!r}")


def link_tail(run_parent_para, label, url_text, url):
    """Split 'label  url_text' into two runs and hyperlink the second."""
    runs = run_parent_para.runs
    joined = "".join(r.text for r in runs)
    if len(runs) == 2 and runs[1].text == url_text:
        runs[1].hyperlink.address = url
        return True
    if len(runs) == 1 and runs[0].text.startswith(label):
        r = runs[0]
        head = r.text[: len(r.text) - len(url_text)] if r.text.endswith(url_text) else label
        new_r = copy.deepcopy(r._r)  # keeps python-pptx's element class
        r._r.addnext(new_r)
        r.text = head
        tail = run_parent_para.runs[1]
        tail.text = url_text
        tail.hyperlink.address = url
        return True
    problems.append(f"link line not found: {joined!r}")
    return False


def slide6(deck):
    s = deck.slides[5]
    # The TronGrid reference displayed a clean URL but linked to one carrying a
    # chatbot tracking tag; a reader who clicks sees the address bar.
    for rel in s.part.rels.values():
        if rel.is_external and "utm_source=chatgpt.com" in rel.target_ref:
            rel._target = TRONGRID_URL
            rel.__dict__["target_ref"] = TRONGRID_URL  # python-pptx caches this lazily
    # The hover tooltips still quoted the tagged address.
    for tip in s._element.iter(f"{{{NS['a']}}}hlinkClick"):
        if "utm_source=chatgpt.com" in (tip.get("tooltip") or ""):
            tip.set("tooltip", TRONGRID_URL)
    # Canva's red underline for the old URL (Group 17) runs past the new,
    # shorter URL, which carries its own link underline; hide it.
    old_rule = shape(s, "Group 17")
    if old_rule is not None:
        for clr in old_rule._element.iter(f"{{{NS['a']}}}srgbClr"):
            for old in clr.findall("a:alpha", NS):
                clr.remove(old)
            etree.SubElement(clr, f"{{{NS['a']}}}alpha").set("val", "0")
    links = shape(s, "TextBox 46")
    if links is not None:
        paras = links.text_frame.paragraphs
        # The demo line: whatever edit_deck.py left there, it becomes the link.
        demo = [p for p in paras if "".join(r.text for r in p.runs).startswith("Demo video")]
        if len(demo) == 1:
            p = demo[0]
            first = p.runs[0]
            for extra in p.runs[1:]:
                extra._r.getparent().remove(extra._r)
            first.text = "Demo video:  youtube.com/watch?v=A4AipdXDDsk"
            link_tail(p, "Demo video:", "youtube.com/watch?v=A4AipdXDDsk", DEMO_URL)
        else:
            problems.append("S6: demo line not found")
        live = [p for p in paras if "".join(r.text for r in p.runs).startswith("Live tool")]
        if len(live) == 1:
            link_tail(live[0], "Live tool:", "crypto-fraud-tracer.onrender.com", SITE_URL)
        else:
            problems.append("S6: live-tool line not found")
        links.top = Inches(10.64)  # clear of the GitHub underline at 10.57 in
    repo = shape(s, "TextBox 42")
    if repo is not None:
        r = [r for r in runs_of(repo) if r.text == "github.com/reemrasheed2007/crypto-fraud-tracer"]
        if len(r) == 1:
            r[0].hyperlink.address = REPO_URL
        else:
            problems.append("S6: GitHub run not found")
    qr = shape(s, "Picture 45")
    if qr is not None:
        qr.left, qr.top, qr.width, qr.height = Inches(8.45), Inches(9.30), Inches(1.30), Inches(1.30)
        qr.click_action.hyperlink.address = SITE_URL
        if not [x for x in s.shapes if x.name == "FineX QR caption"]:
            box = s.shapes.add_textbox(Inches(8.10), Inches(10.62), Inches(2.00), Inches(0.32))
            box.name = "FineX QR caption"
            tf = box.text_frame
            tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
            p = tf.paragraphs[0]
            p.alignment = 2  # centre
            run = p.add_run()
            run.text = "Scan: live tool"
            run.font.size = Pt(14)
            run.font.name = "Calibri"
            run.font.color.rgb = __import__("pptx").dml.color.RGBColor(0x45, 0x4B, 0x54)


def slide5(deck):
    s = deck.slides[4]
    for name, side, inches in (("TextBox 74", "rIns", 0.80), ("TextBox 75", "lIns", 0.55)):
        shp = shape(s, name)
        if shp is not None:
            body = shp.text_frame._txBody.find("a:bodyPr", NS)
            body.set(side, str(int(Inches(inches))))


def slide3(deck):
    s = deck.slides[2]
    footer = shape(s, "TextBox 34")
    if footer is not None:
        for r in runs_of(footer):
            fill = r._r.find("a:rPr/a:solidFill/a:srgbClr", NS)
            if fill is None:
                problems.append("S3 footer: no colour to make transparent")
                continue
            for old in fill.findall("a:alpha", NS):
                fill.remove(old)
            etree.SubElement(fill, f"{{{NS['a']}}}alpha").set("val", "0")
    # The page number sat on the last tech-stack line. The list cannot be
    # shrunk: Canva exported its bullets as separate dots placed for this exact
    # layout. The number moves down instead, where slide 2 carries its own.
    number = shape(s, "TextBox 41")
    if number is not None:
        number.top = Inches(10.55)
    # The architecture picture is the picture fill of Freeform 6 inside Group 5.
    group = shape(s, "Group 5")
    if group is not None:
        blip = group._element.find(".//a:blip", NS)
        rid = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
        part = s.part.related_part(rid)
        data = ARCHITECTURE.read_bytes()
        if not data.startswith(b"\x89PNG"):
            problems.append("architecture asset is not a PNG")
        else:
            part._blob = data
    # The process flowchart (Group 7) said "freese request" in step 9. The
    # patched picture swaps that one glyph and nothing else.
    group = shape(s, "Group 7")
    if group is not None:
        blip = group._element.find(".//a:blip", NS)
        rid = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
        part = s.part.related_part(rid)
        data = FLOWCHART.read_bytes()
        if not data.startswith(b"\x89PNG"):
            problems.append("flowchart asset is not a PNG")
        else:
            part._blob = data


def main(src: str, dst: str) -> None:
    deck = Presentation(src)
    replace_text(deck)
    slide3(deck)
    slide5(deck)
    slide6(deck)
    if problems:
        sys.exit("Refusing to write:\n  " + "\n  ".join(problems))
    deck.save(dst)
    print(f"deck edits applied -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

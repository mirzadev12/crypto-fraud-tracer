"""
Text-only edits to the team's Canva deck, 24 September 2026.

Run AFTER the existing edit_deck.py (which builds "ppt sih EDITED.pptx" from the
untouched original). This applies six replacements on top of that output and
changes nothing else: no shape moves, no layout, no template. Each replacement
is checked against the text it replaces — it must be found exactly once and
must not be longer, or the box would overflow — and the script refuses to write
if any check fails.

    python deck-edits-2026-09-24.py "ppt sih EDITED.pptx" "ppt sih EDITED.pptx"

Why each one:
  S2  the second black box repeated the first; it now names the evidence packet
  S4  "bridges ... recorded as a hard stop" was never true in code
  S5  202 -> 334 sanctioned TRON addresses after the OFAC refresh (see CONTEXT.md)
  S5  multi-chain: screening is built for every chain the OFAC list covers
  S5  AI/ML: stated as what it would be — ranking, trained on I4C-confirmed cases
  S6  202 -> 334 in the OFAC reference line
"""

import sys

from pptx import Presentation

EDITS = [
    # (slide number, shape name, old text, new text)
    (2, "TextBox 72",
     "-From attribution to freeze request. -Generates ready-to- sign freeze requests.",
     "-From attribution to freeze request. -SHA-256 evidence packet for every case."),
    (4, "TextBox 38",
     "Recorded as a hard stop; case closes CLOSED.",
     "Sanctions hit closes it; no guessing past."),
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


def main(src: str, dst: str) -> None:
    deck = Presentation(src)
    problems = []
    for slide_no, shape_name, old, new in EDITS:
        if len(new) > len(old):
            problems.append(f"slide {slide_no} {shape_name}: new text is longer than the old")
            continue
        slide = deck.slides[slide_no - 1]
        runs = [
            run
            for shape in slide.shapes
            if shape.name == shape_name and shape.has_text_frame
            for paragraph in shape.text_frame.paragraphs
            for run in paragraph.runs
            if run.text == old
        ]
        already = [
            run
            for shape in slide.shapes
            if shape.name == shape_name and shape.has_text_frame
            for paragraph in shape.text_frame.paragraphs
            for run in paragraph.runs
            if run.text == new
        ]
        if len(runs) == 1:
            runs[0].text = new  # run.text keeps the run's own formatting
        elif not runs and len(already) == 1:
            pass  # applied on an earlier run of this script
        else:
            problems.append(f"slide {slide_no} {shape_name}: found {len(runs)} run(s) reading {old!r}")
    if problems:
        sys.exit("Refusing to write:\n  " + "\n  ".join(problems))
    deck.save(dst)
    print(f"{len(EDITS)} edits applied -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

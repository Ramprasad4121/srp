"""
PDF Report Exporter — generates professional audit PDF from SRP findings.
Uses reportlab. Install: pip install reportlab
"""
import os
from datetime import datetime


def normalize_severity(sev: str) -> str:
    """Normalize severity to Cyfrin CodeHawks framework: high, medium, low only."""
    if not sev:
        return "medium"
    s = sev.lower().strip()
    if s == "critical":
        return "high"
    if s in ("informational", "info", "gas", "qa", "none", ""):
        return "low"
    if s in ("high", "medium", "low"):
        return s
    return "medium"


def export_pdf(findings: list, report_summary: str, project_name: str, score: int, output_dir: str) -> str:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.platypus import KeepTogether
    except ImportError:
        print("[PDF] reportlab not installed — run: pip install reportlab")
        return ""

    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"SRP_Audit_{project_name}_{timestamp}.pdf"
    filepath = os.path.join(output_dir, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )

    styles = getSampleStyleSheet()
    BLACK = colors.HexColor("#0a0a0a")
    GREEN = colors.HexColor("#00c853")
    RED = colors.HexColor("#d32f2f")
    AMBER = colors.HexColor("#f57c00")
    GRAY = colors.HexColor("#555555")
    BGDARK = colors.HexColor("#f5f5f5")

    SEV_COLORS = {
        "high": colors.HexColor("#d32f2f"),
        "medium": colors.HexColor("#f57c00"),
        "low": colors.HexColor("#388e3c"),
    }

    h1 = ParagraphStyle("h1", fontSize=24, leading=30, textColor=BLACK, fontName="Helvetica-Bold", spaceAfter=4)
    h2 = ParagraphStyle("h2", fontSize=14, leading=18, textColor=BLACK, fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=4)
    h3 = ParagraphStyle("h3", fontSize=11, leading=14, textColor=BLACK, fontName="Helvetica-Bold", spaceBefore=6, spaceAfter=2)
    body = ParagraphStyle("body", fontSize=9, leading=13, textColor=BLACK, fontName="Helvetica")
    mono = ParagraphStyle("mono", fontSize=8, leading=11, textColor=colors.HexColor("#1a237e"), fontName="Courier", backColor=BGDARK, leftIndent=8, rightIndent=8, spaceBefore=4, spaceAfter=4)
    small = ParagraphStyle("small", fontSize=8, leading=11, textColor=GRAY, fontName="Helvetica")

    story = []

    # Header
    story.append(Paragraph("ARGUS", h1))
    story.append(Paragraph("Security Reasoning Protocol — Audit Report", ParagraphStyle("sub", fontSize=12, textColor=GRAY, fontName="Helvetica")))
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=2, color=BLACK))
    story.append(Spacer(1, 4*mm))

    # Meta table
    sev_counts = {"high": 0, "medium": 0, "low": 0}
    for f in findings:
        sev = normalize_severity(f.get("severity", "low"))
        if sev in sev_counts:
            sev_counts[sev] += 1

    proven = sum(1 for f in findings if f.get("poc_result", {}).get("status") == "proven")

    meta_data = [
        ["Project", project_name, "Date", datetime.now().strftime("%Y-%m-%d")],
        ["Score", f"{score}/100\nSecurity Score", "Findings", str(len(findings))],
        ["High", str(sev_counts["high"]), "Medium", str(sev_counts["medium"])],
        ["Low", str(sev_counts["low"]), "PoC Proven", str(proven)],
    ]
    meta_table = Table(meta_data, colWidths=[35*mm, 55*mm, 35*mm, 45*mm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("TEXTCOLOR", (1,0), (1,0), GREEN if score >= 70 else RED),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, BGDARK]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#cccccc")),
        ("PADDING", (0,0), (-1,-1), 4),
    ]))
    story.append(meta_table)

    story.append(Paragraph(
        "Security Score = 100 − Σ(severity weight × proof multiplier) | High=25pts, Medium=10pts, Low=3pts | PROVEN finding doubles the deduction | Floor: 15",
        ParagraphStyle("formula", fontSize=7, textColor=GRAY, fontName="Helvetica-Oblique", spaceBefore=2, spaceAfter=6)
    ))
    story.append(Paragraph(
        'Severity ratings follow the <link href="https://support.cyfrin.io/codehawks/findings-severity">Cyfrin CodeHawks Findings Severity</link> framework.',
        ParagraphStyle("attribution", fontSize=8, textColor=GRAY, fontName="Helvetica-Oblique", spaceAfter=8)
    ))

    story.append(Spacer(1, 6*mm))

    # Executive Summary
    story.append(Paragraph("Executive Summary", h2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))
    story.append(Spacer(1, 2*mm))
    for line in report_summary.strip().split("\n"):
        line = line.strip()
        if not line:
            story.append(Spacer(1, 2*mm))
        elif line.startswith("## "):
            story.append(Paragraph(line[3:], h2))
        elif line.startswith("# "):
            continue  # skip top-level title
        else:
            story.append(Paragraph(line, body))
    story.append(Spacer(1, 4*mm))

    # Findings
    story.append(Paragraph("Findings", h2))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))

    for i, f in enumerate(findings, 1):
        sev = normalize_severity(f.get("severity", "low"))
        sev_color = SEV_COLORS.get(sev, SEV_COLORS["medium"])
        poc_status = f.get("poc_result", {}).get("status", "skipped")
        poc_label = {"proven": "✅ PROVEN ON FORK", "unproven": "⚠️ UNPROVEN", "compile_error": "❌ COMPILE ERROR"}.get(poc_status, "— SKIPPED")

        block = []
        # Finding header row
        header_data = [[
            Paragraph(f"<b>[{sev.upper()}]</b>", ParagraphStyle("sevbadge", fontSize=9, textColor=colors.white, fontName="Helvetica-Bold")),
            Paragraph(f"<b>{f.get('title', 'Untitled')}</b>", ParagraphStyle("ftitle", fontSize=10, fontName="Helvetica-Bold", textColor=colors.white)),
            Paragraph(poc_label, ParagraphStyle("poc", fontSize=8, fontName="Helvetica", textColor=colors.white, alignment=2)),
        ]]
        header_table = Table(header_data, colWidths=[25*mm, 110*mm, 35*mm])
        header_table.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), sev_color),
            ("PADDING", (0,0), (-1,-1), 5),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ]))
        block.append(header_table)

        # Contract + description
        contract = f.get("contract", "")
        if contract:
            block.append(Paragraph(f"<b>Contract:</b> {contract}", ParagraphStyle("contract", fontSize=8, textColor=GRAY, fontName="Helvetica", spaceBefore=3)))
        block.append(Paragraph(f.get("description", ""), body))

        # Vuln code
        if f.get("vuln_code"):
            block.append(Paragraph("Vulnerable Code:", h3))
            code = f["vuln_code"][:800].replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
            block.append(Paragraph(code, mono))

        # Fix code
        if f.get("fix_code"):
            block.append(Paragraph("Recommended Fix:", h3))
            code = f["fix_code"][:800].replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
            block.append(Paragraph(code, mono))

        # PoC output
        if poc_status == "proven" and f.get("poc_result", {}).get("output"):
            block.append(Paragraph("PoC Output:", h3))
            out = f["poc_result"]["output"][:400].replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
            block.append(Paragraph(out, mono))

        block.append(Spacer(1, 4*mm))
        story.append(KeepTogether(block))

    # Footer
    story.append(HRFlowable(width="100%", thickness=1, color=BLACK))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(f"Generated by ARGUS — Security Reasoning Protocol v2026.1 | {datetime.now().strftime('%Y-%m-%d %H:%M')}", small))

    doc.build(story)
    print(f"[PDF] Report exported: {filepath}")
    return filepath

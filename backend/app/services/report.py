from __future__ import annotations

from pathlib import Path

from ..core.config import get_settings
from ..schemas import AnalysisResponse
from .ai import pct, prob


def build_pdf_report(analysis: AnalysisResponse) -> Path:
    try:
        from reportlab.lib import colors  # type: ignore
        from reportlab.lib.pagesizes import letter  # type: ignore
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore
        from reportlab.lib.units import inch  # type: ignore
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle  # type: ignore
    except Exception as exc:
        raise RuntimeError("PDF export requires reportlab. Install backend requirements first.") from exc

    settings = get_settings()
    filename = settings.report_dir / f"{analysis.analysis_id}.pdf"
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "QuantTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#111827"),
    )
    heading = ParagraphStyle(
        "QuantHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        spaceBefore=14,
        textColor=colors.HexColor("#111827"),
    )
    body = ParagraphStyle(
        "QuantBody",
        parent=styles["BodyText"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1f2937"),
    )

    doc = SimpleDocTemplate(
        str(filename),
        pagesize=letter,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
    )
    story = [
        Spacer(1, 0.35 * inch),
        Paragraph("Quant Committee AI", title),
        Paragraph("Institutional Quantitative Research Report", heading),
        Paragraph(f"{analysis.ticker} | {analysis.horizon_days}-day horizon | {analysis.analysis_time:%Y-%m-%d %H:%M UTC}", body),
        Spacer(1, 0.2 * inch),
        Paragraph("Executive Summary", heading),
        Paragraph(analysis.consensus.executive_summary, body),
    ]

    verdict_rows = [
        ["Outlook", analysis.consensus.outlook],
        ["Probability Positive", prob(analysis.consensus.estimated_prob_positive)],
        ["95% VaR", pct(analysis.consensus.var95)],
        ["Expected Shortfall", pct(analysis.consensus.expected_shortfall)],
        ["Agreement Score", prob(analysis.consensus.model_agreement_score)],
        ["Overall Confidence", prob(analysis.consensus.overall_confidence)],
    ]
    story.append(_table(verdict_rows, Table, TableStyle, colors))

    model_rows = [["Model", "Expected Return", "VaR", "Expected Shortfall", "Prob Positive", "Confidence"]]
    for result in analysis.model_results:
        model_rows.append([
            result.model,
            pct(result.expected_return),
            pct(result.var95),
            pct(result.expected_shortfall),
            prob(result.prob_positive),
            prob(result.confidence_score),
        ])
    story.extend([Paragraph("Quantitative Results", heading), _table(model_rows, Table, TableStyle, colors, header=True)])

    story.append(Paragraph("Individual Model Analyses", heading))
    for result in analysis.model_results:
        story.append(Paragraph(f"<b>{result.model}</b>: {result.reasoning}", body))
        story.append(Spacer(1, 0.06 * inch))

    story.append(Paragraph("Quant Committee Discussion", heading))
    for statement in analysis.committee:
        story.append(Paragraph(f"<b>{statement.persona} - {statement.role}</b>: {statement.statement}", body))
        story.append(Spacer(1, 0.06 * inch))

    story.append(Paragraph("Major Risks", heading))
    for risk in analysis.consensus.key_risks:
        story.append(Paragraph(f"- {risk}", body))

    story.append(Paragraph("Appendix: Model Assumptions", heading))
    for assumption in analysis.consensus.key_assumptions:
        story.append(Paragraph(f"- {assumption}", body))

    if analysis.consensus.metrics:
        story.append(Paragraph("Appendix: Consensus Metrics", heading))
        metrics = analysis.consensus.metrics
        story.append(Paragraph(f"Most optimistic model: {metrics.most_optimistic_model}", body))
        story.append(Paragraph(f"Most conservative model: {metrics.most_conservative_model}", body))
        story.append(Paragraph(f"Key disagreement: {metrics.most_influential_disagreement}", body))

    doc.build(story)
    return filename


def _table(rows, Table, TableStyle, colors, header: bool = False):
    table = Table(rows, hAlign="LEFT", repeatRows=1 if header else 0)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827") if header else colors.HexColor("#f3f4f6")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white if header else colors.HexColor("#111827")),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d1d5db")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


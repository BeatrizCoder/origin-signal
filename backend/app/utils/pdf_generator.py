from datetime import datetime
from io import BytesIO

from reportlab.lib.colors import HexColor, black
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

# ── Palette ──────────────────────────────────────────────────────────────────
AMBER      = HexColor('#D4900A')
AMBER_BG   = HexColor('#FFF8E6')
DARK       = HexColor('#1E293B')
MUTED      = HexColor('#64748B')
LIGHT_BG   = HexColor('#F8FAFC')
BORDER_CLR = HexColor('#E2E8F0')
RED        = HexColor('#EF4444')
AMBER_RISK = HexColor('#F59E0B')
GREEN      = HexColor('#10B981')


# ── Helpers ──────────────────────────────────────────────────────────────────

def _score_color(score: int) -> HexColor:
    if score >= 70: return RED
    if score >= 40: return AMBER_RISK
    return GREEN


def _risk_color(sev: str) -> HexColor:
    s = sev.lower()
    if s == 'critical': return RED
    if s == 'high':     return AMBER_RISK
    if s == 'medium':   return HexColor('#3B82F6')
    return GREEN


def _risk_level_label(score: int) -> str:
    if score < 30:  return 'LOW'
    if score <= 60: return 'MEDIUM'
    if score <= 80: return 'HIGH'
    return 'CRITICAL'


def _bar_table(score: int, width: float) -> Table:
    col    = _score_color(score)
    filled = max(2.0, width * score / 100)
    empty  = width - filled
    if empty <= 0:
        t = Table([['']], colWidths=[width], rowHeights=[6])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), col),
            ('TOPPADDING',    (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ]))
    else:
        t = Table([['', '']], colWidths=[filled, empty], rowHeights=[6])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), col),
            ('BACKGROUND', (1, 0), (1, 0), BORDER_CLR),
            ('TOPPADDING',    (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ]))
    return t


# ── Paragraph styles ─────────────────────────────────────────────────────────

def _styles():
    return {
        'mono_bold': ParagraphStyle('MonoBold',
            fontName='Courier-Bold', fontSize=8, textColor=DARK, leading=11),
        'mono_sm': ParagraphStyle('MonoSm',
            fontName='Courier', fontSize=8, textColor=MUTED, leading=11),
        'section': ParagraphStyle('Section',
            fontName='Courier-Bold', fontSize=8, textColor=MUTED, leading=12,
            spaceBefore=2, spaceAfter=6, letterSpacing=1.5),
        'body': ParagraphStyle('Body',
            fontName='Helvetica', fontSize=10, textColor=DARK, leading=14),
        'body_muted': ParagraphStyle('BodyMuted',
            fontName='Helvetica', fontSize=10, textColor=MUTED, leading=14),
        'risk_title': ParagraphStyle('RiskTitle',
            fontName='Helvetica-Bold', fontSize=11, textColor=DARK, leading=15),
        'risk_desc': ParagraphStyle('RiskDesc',
            fontName='Helvetica', fontSize=10, textColor=MUTED, leading=14),
        'small': ParagraphStyle('Small',
            fontName='Courier', fontSize=8, textColor=MUTED, leading=10),
        'footer': ParagraphStyle('Footer',
            fontName='Courier', fontSize=7, textColor=MUTED, leading=10, alignment=1),
        'verdict': ParagraphStyle('Verdict',
            fontName='Courier-Bold', fontSize=10, textColor=AMBER, leading=13, spaceAfter=6),
    }


# ── Public API ───────────────────────────────────────────────────────────────

def generate_pdf(data: dict) -> bytes:
    buffer   = BytesIO()
    PAD      = 18 * mm
    PAGE_W   = A4[0]
    usable_w = PAGE_W - 2 * PAD

    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=PAD, rightMargin=PAD,
        topMargin=PAD, bottomMargin=PAD,
    )

    S   = _styles()
    now = datetime.now().strftime('%Y-%m-%d %H:%M UTC')

    trade_dir  = data.get('trade_direction', 'export').upper()
    origin     = data.get('origin', 'Brazil')
    dest       = data.get('destination', 'European Union')
    commodity  = data.get('commodity', 'coffee').capitalize()
    query      = data.get('query', '') or 'Composite trade risk analysis'
    overall    = int(data.get('overall_risk_score', data.get('risk_score', 50)))
    readiness  = int(data.get('export_readiness', data.get('supply_reliability', 100 - overall)))
    reg_score  = int(data.get('regulatory', {}).get('risk_score', 50))
    clim_score = int(data.get('climate',    {}).get('climate_risk_score', 50))
    mkt_score  = int(data.get('market',     {}).get('market_risk_score', 50))
    logi_score = int(data.get('logistics',  {}).get('logistics_risk_score', 50))
    exec_data  = data.get('executive', {})
    key_risks  = exec_data.get('key_risks', []) or []
    exec_sum   = exec_data.get('executive_summary', '') or ''
    verdict    = exec_data.get('overall_verdict', '') or ''
    trade_win  = exec_data.get('trade_window', '') or ''
    actions    = exec_data.get('recommended_actions', []) or []
    gaps       = data.get('gap', {}).get('gaps_identified', []) or []
    origin_port = data.get('logistics', {}).get('origin_port', '') or ''
    dest_port   = data.get('logistics', {}).get('destination_port', '') or ''
    transit     = data.get('logistics', {}).get('estimated_transit_days', 0)

    story = []

    # ── 1. HEADER ────────────────────────────────────────────────────────────
    os_para = Paragraph('<b>OS</b>', ParagraphStyle('OSLabel',
        fontName='Courier-Bold', fontSize=16, textColor=black, alignment=1))
    brand_para = Paragraph(
        '<font name="Courier-Bold" size="18">ORIGINSIGNAL</font><br/>'
        '<font name="Courier" size="8" color="#64748B">TRADE RISK INTELLIGENCE REPORT</font>',
        ParagraphStyle('Brand', leading=26, textColor=DARK),
    )
    ht = Table([[os_para, brand_para]], colWidths=[46, usable_w - 46])
    ht.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (0, 0), AMBER),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN',         (0, 0), (0, 0), 'CENTER'),
        ('TOPPADDING',    (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING',   (0, 0), (0, 0), 6),
        ('RIGHTPADDING',  (0, 0), (0, 0), 6),
        ('LEFTPADDING',   (1, 0), (1, 0), 14),
    ]))
    story.append(ht)
    story.append(Spacer(1, 4))
    story.append(Paragraph(f'Generated: {now}', S['mono_sm']))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width='100%', thickness=2, color=AMBER, spaceAfter=12))

    # ── 2. ANALYSIS CONTEXT ──────────────────────────────────────────────────
    story.append(Paragraph('ANALYSIS CONTEXT', S['section']))
    ctx_rows = [
        [Paragraph('COMMODITY',       S['mono_bold']), Paragraph(commodity, S['body']),
         Paragraph('TRADE DIRECTION', S['mono_bold']), Paragraph(trade_dir, S['body'])],
        [Paragraph('ORIGIN',          S['mono_bold']), Paragraph(origin,    S['body']),
         Paragraph('DESTINATION',     S['mono_bold']), Paragraph(dest,      S['body'])],
        [Paragraph('QUERY',           S['mono_bold']),
         Paragraph(query, ParagraphStyle('QBody', fontName='Helvetica', fontSize=10,
                          textColor=DARK, leading=14)),
         '', ''],
    ]
    col_w = usable_w / 4
    ctx_t = Table(ctx_rows, colWidths=[col_w * 0.6, col_w * 1.4, col_w * 0.6, col_w * 1.4])
    ctx_t.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), LIGHT_BG),
        ('GRID',          (0, 0), (-1, -1), 0.5, BORDER_CLR),
        ('TOPPADDING',    (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('SPAN',          (1, 2), (3, 2)),
    ]))
    story.append(ctx_t)
    story.append(Spacer(1, 14))

    # ── 3. RISK SCORES ───────────────────────────────────────────────────────
    story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER_CLR, spaceAfter=8))
    story.append(Paragraph('TRADE RISK SCORES', S['section']))

    rl_label = _risk_level_label(overall)
    rl_color = _score_color(overall)

    score_head = Table([[
        Paragraph(str(overall), ParagraphStyle('BigScore',
            fontName='Courier-Bold', fontSize=44, textColor=AMBER, leading=50)),
        Paragraph(f'{rl_label}\nOVERALL RISK', ParagraphStyle('RLBadge',
            fontName='Courier-Bold', fontSize=9, textColor=rl_color, leading=14)),
        Paragraph(str(readiness), ParagraphStyle('ReadScore',
            fontName='Courier-Bold', fontSize=44, textColor=GREEN, leading=50)),
        Paragraph(
            'EXPORT READINESS' if trade_dir == 'EXPORT' else 'SUPPLY RELIABILITY',
            S['small']),
    ]], colWidths=[70, 130, 70, usable_w - 270])
    score_head.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(score_head)
    story.append(Spacer(1, 10))

    BAR_W = usable_w - 130
    dims  = [('REGULATORY', reg_score), ('CLIMATE', clim_score),
             ('MARKET', mkt_score),     ('LOGISTICS', logi_score)]
    dim_rows = []
    for label, score in dims:
        col = _score_color(score)
        dim_rows.append([
            Paragraph(label, S['mono_bold']),
            Paragraph(str(score), ParagraphStyle('DimV',
                fontName='Courier-Bold', fontSize=10, textColor=col, leading=14)),
            _bar_table(score, BAR_W),
        ])
    dim_t = Table(dim_rows, colWidths=[90, 40, BAR_W])
    dim_t.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LINEBELOW',     (0, 0), (-1, -2), 0.3, BORDER_CLR),
    ]))
    story.append(dim_t)
    story.append(Spacer(1, 14))

    # ── 4. EXECUTIVE BRIEFING ────────────────────────────────────────────────
    if key_risks or exec_sum:
        story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER_CLR, spaceAfter=8))
        story.append(Paragraph('EXECUTIVE INTELLIGENCE BRIEFING', S['section']))

        for risk in key_risks[:4]:
            sev   = risk.get('severity', 'medium')
            title = risk.get('title', '')
            desc  = risk.get('description', '')
            col   = _risk_color(sev)

            rt = Table([
                [Paragraph(sev.upper(), ParagraphStyle('Sev',
                    fontName='Courier-Bold', fontSize=8, textColor=col, leading=11)),
                 Paragraph(title, S['risk_title'])],
                ['',
                 Paragraph(desc, S['risk_desc'])],
            ], colWidths=[60, usable_w - 60])
            rt.setStyle(TableStyle([
                ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING',    (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING',   (0, 0), (0, -1), 8),
                ('LEFTPADDING',   (1, 0), (1, -1), 10),
                ('LEFTPADDING',   (0, 0), (-1, -1), 0),
                ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
                ('LINEAFTER',     (0, 0), (0, -1), 2.5, col),
                ('LEFTPADDING',   (0, 0), (0, -1), 8),
                ('LEFTPADDING',   (1, 0), (1, -1), 10),
            ]))
            story.append(rt)
            story.append(Spacer(1, 7))

        if exec_sum:
            verdict_parts = []
            if verdict:
                verdict_parts.append(f'VERDICT: {verdict.upper()}')
            if trade_win:
                verdict_parts.append(trade_win)
            if verdict_parts:
                story.append(Paragraph('  ·  '.join(verdict_parts), S['verdict']))

            story.append(Paragraph('EXECUTIVE RECOMMENDATION', S['section']))
            sum_t = Table([[Paragraph(exec_sum, S['body'])]], colWidths=[usable_w])
            sum_t.setStyle(TableStyle([
                ('BACKGROUND',    (0, 0), (-1, -1), AMBER_BG),
                ('LINEAFTER',     (0, 0), (0, -1), 3, AMBER),
                ('TOPPADDING',    (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING',   (0, 0), (-1, -1), 12),
                ('RIGHTPADDING',  (0, 0), (-1, -1), 12),
            ]))
            story.append(sum_t)
            story.append(Spacer(1, 14))

    # ── 5. RECOMMENDED ACTIONS ───────────────────────────────────────────────
    if actions:
        story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER_CLR, spaceAfter=8))
        story.append(Paragraph('RECOMMENDED ACTIONS', S['section']))
        act_rows = []
        for act in actions:
            act_rows.append([
                Paragraph(act.get('timeline', ''), ParagraphStyle('TL',
                    fontName='Courier-Bold', fontSize=8, textColor=black, leading=11)),
                Paragraph(act.get('action', ''), S['body']),
            ])
        act_t = Table(act_rows, colWidths=[80, usable_w - 80])
        act_t.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (0, -1), AMBER),
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING',   (0, 0), (0, -1), 8),
            ('RIGHTPADDING',  (0, 0), (0, -1), 8),
            ('LEFTPADDING',   (1, 0), (1, -1), 10),
            ('LINEBELOW',     (0, 0), (-1, -2), 0.3, BORDER_CLR),
        ]))
        story.append(act_t)
        story.append(Spacer(1, 14))

    # ── 6. TRADE ROUTE ───────────────────────────────────────────────────────
    if origin_port and dest_port:
        story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER_CLR, spaceAfter=8))
        story.append(Paragraph('TRADE ROUTE', S['section']))
        story.append(Paragraph(
            f'{origin_port}  →  {dest_port}  ·  {transit} days transit',
            ParagraphStyle('Route', fontName='Courier-Bold', fontSize=12,
                           textColor=DARK, leading=16),
        ))
        story.append(Spacer(1, 14))

    # ── 7. GAP ANALYSIS ──────────────────────────────────────────────────────
    if gaps:
        story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER_CLR, spaceAfter=8))
        story.append(Paragraph('GAP ANALYSIS', S['section']))
        for gap in gaps:
            story.append(Paragraph(f'• {gap}', S['body']))
        story.append(Spacer(1, 10))

    # ── 8. FOOTER ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width='100%', thickness=1, color=AMBER, spaceAfter=6))
    story.append(Paragraph(
        'Generated by OriginSignal  ·  Powered by Claude Sonnet 4.6  ·  Open-Meteo  ·  USDA FAS  ·  EUR-Lex EUDR',
        S['footer'],
    ))
    story.append(Paragraph(now, S['footer']))

    doc.build(story)
    return buffer.getvalue()

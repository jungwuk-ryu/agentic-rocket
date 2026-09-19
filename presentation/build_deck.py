#!/usr/bin/env python3
"""Rebuild the vector PDF, editable PowerPoint, previews, and layout audit.

python build_deck.py
python build_deck.py --screenshot /absolute/path/to/verified-results.png
"""
from pathlib import Path
import argparse
import json
import math

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from pptx import Presentation
from pptx.util import Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.oxml.xmlchemy import OxmlElement
from PIL import Image, ImageDraw
import pymupdf as fitz

ROOT = Path(__file__).resolve().parent
W, H = 960, 540
BG = '#F7F5EF'
INK = '#172E30'
DARK = '#132D2F'
MUTED = '#536665'
RULE = '#CDD4CE'
WHITE = '#FFFFFF'
CORAL = '#F87759'
ORANGE = '#BD452B'
MINT = '#B9E5CE'
PALE = '#E6EDE5'
LIGHTMUTED = '#C3D0CB'
PANEL = '#203D3E'

for face in ['Regular', 'SemiBold', 'Bold']:
    pdfmetrics.registerFont(TTFont(face, str(ROOT / 'assets/fonts' / f'Pretendard-{face}.ttf')))

from story_slides import NOTES, DEMO_URL, build_story

CORNER_QR = (834, 16, 108, 108)


def rgb(value):
    return RGBColor.from_string(value.lstrip('#'))


class Deck:
    def __init__(self):
        self.pdf = canvas.Canvas(str(ROOT / 'AgenticRocket_3min_KO-EN.pdf'), pagesize=(W, H), pageCompression=1, initialFontName='Regular', initialFontSize=12)
        self.pdf.setTitle('AgenticRocket — AI low-level performance optimization | 한국어 · English')
        self.pdf.setAuthor('AgenticRocket')
        self.pdf.setSubject('Three-minute bilingual pitch: vibe coding, performance as UX, AI optimization on Daytona, and a live demo.')
        self.pdf.setViewerPreference('DisplayDocTitle', 'true')
        self.ppt = Presentation()
        self.ppt.slide_width = Pt(W)
        self.ppt.slide_height = Pt(H)
        self.ppt.core_properties.title = 'AgenticRocket — 3-minute bilingual pitch'
        self.ppt.core_properties.subject = 'AI low-level performance optimization'
        self.ppt.core_properties.author = 'AgenticRocket'
        self.audit = []
        self.index = 0
        self.slide = None

    def page(self, dark=False, section=''):
        if self.index:
            self.pdf.showPage()
        self.index += 1
        self.slide = self.ppt.slides.add_slide(self.ppt.slide_layouts[6])
        self.slide.background.fill.solid()
        self.slide.background.fill.fore_color.rgb = rgb(DARK if dark else BG)
        self.pdf.setFillColor(HexColor(DARK if dark else BG))
        self.pdf.rect(0, 0, W, H, fill=1, stroke=0)
        self.fore = BG if dark else INK
        self.muted = LIGHTMUTED if dark else MUTED
        self.rule = '#3D5655' if dark else RULE
        self.accent = CORAL if dark else ORANGE
        qx, qy, qw, qh = CORNER_QR
        self.image(ROOT/'assets/demo-qr.png', qx, qy, qw, qh)
        self.slide.shapes[-1].name = 'DEMO_QR_TOP_RIGHT'
        self.slide.shapes[-1].click_action.hyperlink.address = DEMO_URL
        self.pdf.linkURL(DEMO_URL, (qx, H-qy-qh, qx+qw, H-qy), relative=0)
        self.line(56, 494, 904, 494, self.rule, 0.8)
        self.text('AGENTICROCKET', 56, 508, 10, self.muted, 'SemiBold', 260, essential=False)
        self.text(section, 352, 508, 10, self.muted, 'Regular', 400, essential=False)
        self.text(f'{self.index:02d} / {len(NOTES):02d}', 852, 508, 10, self.muted, 'Regular', 65, essential=False)
        note = NOTES[self.index - 1]
        self.slide.notes_slide.notes_text_frame.text = (
            f"{note['time']} | {note['seconds']} seconds\n\n한국어\n{note['ko']}\n\nEnglish\n{note['en']}\n\n발표 팁\n{note['cue']}"
        )

    def text(self, value, x, y, size, color=None, face='Regular', width=None, leading=1.14, essential=True, name=None):
        # Requested refinement: quieter typography, with readable body text.
        if size >= 80:
            size = round(size * 0.88)
        elif size >= 40:
            size = round(size * 0.92)
        elif size >= 30:
            size = round(size * 0.94)
        elif size >= 25:
            size = max(24, round(size * 0.96))
        if essential:
            size = max(24, size)
        color = color or self.fore
        lines = value.split('\n')
        widths = [pdfmetrics.stringWidth(v, face, size) for v in lines]
        real_w = max(widths, default=0)
        box_w = width if width is not None else real_w + 3
        if real_w > box_w + 0.1:
            raise ValueError(f'Slide {self.index} text overflow: {value!r}: {real_w:.1f} > {box_w:.1f}')
        asc = pdfmetrics.getAscent(face) / 1000 * size
        desc = abs(pdfmetrics.getDescent(face) / 1000 * size)
        real_h = (len(lines) - 1) * size * leading + asc + desc
        if x < 0 or y < 0 or x + real_w > W + 0.1 or y + real_h > H + 0.1:
            raise ValueError(f'Slide {self.index} out-of-bounds text: {value!r}')
        self.pdf.setFillColor(HexColor(color))
        self.pdf.setFont(face, size)
        for i, val in enumerate(lines):
            self.pdf.drawString(x, H - y - asc - i * size * leading, val)
        shape = self.slide.shapes.add_textbox(Pt(x), Pt(y), Pt(box_w + 2), Pt(max(real_h + 8, size * 1.3)))
        if name:
            shape.name = name
        tf = shape.text_frame
        tf.clear()
        tf.word_wrap = False
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        for i, val in enumerate(lines):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.space_before = p.space_after = Pt(0)
            p.line_spacing = Pt(size * leading)
            r = p.add_run()
            r.text = val
            r.font.name = 'Pretendard'
            r.font.size = Pt(size)
            r.font.bold = face in ['Bold', 'SemiBold']
            r.font.color.rgb = rgb(color)
            rpr = r._r.get_or_add_rPr()
            rpr.set('lang', 'ko-KR' if any('\uac00' <= c <= '\ud7a3' for c in val) else 'en-US')
            ea = OxmlElement('a:ea')
            ea.set('typeface', 'Pretendard')
            rpr.append(ea)
        self.audit.append({'page': self.index, 'text': value, 'bbox': [x, y, real_w, real_h], 'font_pt': size, 'essential': essential})

    def rect(self, x, y, w, h, fill=None, stroke=None, radius=0, line_width=1, name=None):
        self.pdf.setLineWidth(line_width)
        if fill:
            self.pdf.setFillColor(HexColor(fill))
        if stroke:
            self.pdf.setStrokeColor(HexColor(stroke))
        if radius:
            self.pdf.roundRect(x, H - y - h, w, h, radius, fill=bool(fill), stroke=bool(stroke))
        else:
            self.pdf.rect(x, H - y - h, w, h, fill=bool(fill), stroke=bool(stroke))
        sh = self.slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE, Pt(x), Pt(y), Pt(w), Pt(h))
        if name:
            sh.name = name
        if radius:
            sh.adjustments[0] = min(radius / min(w, h), 0.5)
        if fill:
            sh.fill.solid()
            sh.fill.fore_color.rgb = rgb(fill)
        else:
            sh.fill.background()
        if stroke:
            sh.line.color.rgb = rgb(stroke)
            sh.line.width = Pt(line_width)
        else:
            sh.line.fill.background()

    def line(self, x1, y1, x2, y2, color, thickness=1):
        self.pdf.setStrokeColor(HexColor(color))
        self.pdf.setLineWidth(thickness)
        self.pdf.setLineCap(1)
        self.pdf.line(x1, H - y1, x2, H - y2)
        sh = self.slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Pt(x1), Pt(y1), Pt(x2), Pt(y2))
        sh.line.color.rgb = rgb(color)
        sh.line.width = Pt(thickness)

    def arrow(self, x1, y1, x2, y2, color, thickness=2.5, tip=8):
        self.line(x1, y1, x2, y2, color, thickness)
        angle = math.atan2(y2-y1, x2-x1)
        for d in [-0.65, 0.65]:
            self.line(x2, y2, x2 - tip*math.cos(angle+d), y2 - tip*math.sin(angle+d), color, thickness)

    def circle(self, x, y, diameter, fill, stroke=None, line_width=1):
        self.pdf.setFillColor(HexColor(fill))
        if stroke:
            self.pdf.setStrokeColor(HexColor(stroke))
        self.pdf.setLineWidth(line_width)
        self.pdf.circle(x+diameter/2, H-y-diameter/2, diameter/2, fill=1, stroke=bool(stroke))
        sh = self.slide.shapes.add_shape(MSO_SHAPE.OVAL, Pt(x), Pt(y), Pt(diameter), Pt(diameter))
        sh.fill.solid()
        sh.fill.fore_color.rgb = rgb(fill)
        if stroke:
            sh.line.color.rgb = rgb(stroke)
            sh.line.width = Pt(line_width)
        else:
            sh.line.fill.background()

    def mark(self, x, y, size=24, color=None):
        color = color or self.accent
        self.line(x, y+size, x+size, y, color, size*0.15)
        self.line(x+size*0.5, y, x+size, y, color, size*0.15)
        self.line(x+size, y, x+size, y+size*0.5, color, size*0.15)

    def label(self, ko, en, x=56, y=40):
        self.text(ko, x, y, 17, self.muted, 'SemiBold', essential=False)
        offset = pdfmetrics.stringWidth(ko, 'SemiBold', 17) + 18
        self.text(en, x+offset, y+1, 16, self.muted, 'Regular', essential=False)

    def image(self, path, x, y, w, h):
        im = Image.open(path)
        scale = min(w/im.width, h/im.height)
        rw, rh = im.width*scale, im.height*scale
        xx, yy = x+(w-rw)/2, y+(h-rh)/2
        self.pdf.drawImage(str(path), xx, H-yy-rh, width=rw, height=rh, mask='auto')
        self.slide.shapes.add_picture(str(path), Pt(xx), Pt(yy), width=Pt(rw), height=Pt(rh))

    def save(self):
        self.pdf.save()
        self.ppt.save(str(ROOT/'AgenticRocket_3min_KO-EN.pptx'))
        (ROOT/'layout-audit.json').write_text(json.dumps(self.audit, ensure_ascii=False, indent=2))


def build(screenshot=None):
    build_story(Deck(), screenshot)


def render(screenshot=None):
    out = ROOT/'previews'
    out.mkdir(exist_ok=True)
    pdf = fitz.open(ROOT/'AgenticRocket_3min_KO-EN.pdf')
    thumbs = []
    for i, page in enumerate(pdf):
        pix = page.get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False)
        path = out/f'slide-{i+1:02d}.png'
        pix.save(path)
        im = Image.open(path).convert('RGB')
        im.thumbnail((640, 360), Image.Resampling.LANCZOS)
        thumbs.append(im)
    contact = Image.new('RGB', (1328, 16 + math.ceil(len(thumbs)/2)*384), '#DDE0D9')
    for i, im in enumerate(thumbs):
        contact.paste(im, (16 + (i%2)*656, 16 + (i//2)*384))
    contact.save(out/'overview.png')
    fonts = sorted({f[3] for pg in pdf for f in pg.get_fonts()})
    report = {
        'pages': len(pdf), 'page_points': [W, H], 'aspect_ratio': '16:9',
        'timing_seconds': sum(n['seconds'] for n in NOTES), 'fonts': fonts,
        'fonts_embedded': all(bool(pdf.extract_font(f[0])[3]) for pg in pdf for f in pg.get_fonts() if f[2]=='TrueType'),
        'bilingual_pages': all(any('\uac00' <= c <= '\ud7a3' for c in pg.get_text()) and any(c.isascii() and c.isalpha() for c in pg.get_text()) for pg in pdf),
        'screenshots_used': bool(screenshot),
        'corner_qr_pages': list(range(1, len(pdf)+1)),
        'corner_qr_bbox_points': list(CORNER_QR),
        'qr_url': DEMO_URL,
        'note': 'User narrative with a brief market and prepaid-credit business model. Includes the original pigeon image and a large demo QR. 150 seconds of talk plus 30 seconds of demo.'
    }
    (ROOT/'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


def notes():
    parts = ['# AgenticRocket · 3분 발표 대본', '', f'{len(NOTES)}장에 한국어와 영어를 함께 배치했습니다. 발표는 한국어 또는 영어 중 하나로 진행합니다.', '', '설명 2분 30초 + 실제 데모 30초 = 총 3분. 비즈니스 설명은 15초이며, 마지막 장은 전환 멘트 7초와 데모 30초를 포함합니다. 실제 발화 속도에 맞춰 리허설하세요.', '']
    for lang, name in [('ko', '한국어 발표'), ('en', 'English talk')]:
        parts += [f'## {name}', '']
        for i, n in enumerate(NOTES):
            parts += [f"### {i+1}. {n['title']} · {n['time']} ({n['seconds']}초)", '', n[lang], '']
            if lang == 'ko':
                parts += [f"발표 팁: {n['cue']}", '']
    (ROOT/'speaker-notes.md').write_text('\n'.join(parts), encoding='utf-8')
    (ROOT/'slide-copy.json').write_text(json.dumps(NOTES, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--screenshot', type=Path)
    args = parser.parse_args()
    build(args.screenshot)
    notes()
    render(args.screenshot)

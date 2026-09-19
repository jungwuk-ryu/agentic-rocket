"""The presentation narrative, brief business model, and editable slides."""

from pathlib import Path
import qrcode

ROOT = Path(__file__).resolve().parent
BG, INK, DARK = '#F7F5EF', '#172E30', '#132D2F'
MUTED, RULE, WHITE = '#536665', '#CDD4CE', '#FFFFFF'
CORAL, ORANGE, MINT = '#F87759', '#BD452B', '#B9E5CE'
PALE, LIGHTMUTED, PANEL = '#E6EDE5', '#C3D0CB', '#203D3E'
DEMO_URL = 'https://jungwuk.jungwuk.com'

NOTES = [
    {
        'seconds': 7, 'title': 'AgenticRocket',
        'ko': '안녕하세요. AI가 코드를 직접 고치고 검증하는 성능 최적화 솔루션, AgenticRocket입니다.',
        'en': 'Meet AgenticRocket: an AI performance engineer that changes code and verifies the improvement.',
        'cue': '제품명 뒤 잠깐 멈추고 다음 장으로 전환한다.'
    },
    {
        'seconds': 11, 'title': '바이브코딩으로 쉬워진 제품 개발',
        'ko': '바이브코딩 덕분에 AI와 대화하며 프로덕트를 만드는 일이 쉬워졌습니다. 새로운 프로덕트도 매일 쏟아집니다.',
        'en': 'Vibe coding makes it easier to build a product by talking to AI. New products keep appearing every day.',
        'cue': '“만드는 일은 쉬워졌다”만 전달하고 길게 설명하지 않는다.'
    },
    {
        'seconds': 14, 'title': '성능 최적화도 사용자 경험',
        'ko': '차별점은 어디서 만들까요? 기획, UI, UX를 고민하지만, 사용자가 기다리는 시간도 UX입니다. 같은 기능이라면 바로 반응하는 제품이 좋겠죠. 최적화도 사용자 경험의 일부입니다.',
        'en': 'How does a product stand out? We think about the idea, UI, and UX. But waiting is part of UX, too. A responsive product feels better. Performance matters.',
        'cue': '오른쪽 UX 영역 안의 성능을 짚는다.'
    },
    {
        'seconds': 12, 'title': '올바르고 빠르게 작동해야 한다',
        'ko': '작동하기만 하면 끝일까요? 이 비둘기도 일단 날아가긴 합니다. 하지만 우리가 원하는 건, 의도한 방식으로 제대로, 그리고 빠르게 움직이는 제품입니다.',
        'en': 'Is working enough? This pigeon does fly, in its own way. What we want is software that behaves as intended, and does it fast.',
        'cue': '비둘기 그림을 보여주고 청중이 볼 시간을 짧게 준다.'
    },
    {
        'seconds': 17, 'title': '성능 개선에는 검증이 필수',
        'ko': '빨라졌다는 말에는 검증이 필요합니다. 원본과 수정본을 반복 실행하고 기능도 확인해야 하죠. 로컬 측정은 시간이 걸리고 다른 작업의 간섭도 받습니다. 외부 환경에서 검증하면 내 컴퓨터에서는 개발을 계속할 수 있습니다.',
        'en': 'A speedup needs evidence: repeated comparisons and behavior checks. Local tests take time, and other work can affect the measurements. Remote verification lets us keep developing on our own machine.',
        'cue': '로컬의 자원 경쟁과 외부 실행의 작업 분리를 설명한다. 외부 환경만으로 측정 정확도가 보장된다는 표현은 쓰지 않는다.'
    },
    {
        'seconds': 14, 'title': '보안에서 성능 최적화로',
        'ko': '보안에는 Strix, Snyk, Semgrep처럼 문제를 찾고 수정을 돕는 서비스들이 있습니다. 성능 최적화도 에이전트에게 맡겨, 병목을 고친 코드와 검증 결과를 받을 수 있지 않을까요?',
        'en': 'Strix, Snyk, and Semgrep help find and fix security issues. Could an agent handle performance optimization, too, returning a code change and the evidence behind it?',
        'cue': '서비스 이름은 한 번에 읽는다. 경쟁 제품이 없다는 주장 대신 성능 최적화의 위임으로 연결한다.'
    },
    {
        'seconds': 13, 'title': 'Daytona로 만든 AgenticRocket',
        'ko': '그래서 Daytona 위에 AgenticRocket을 만들었습니다. 빠른 환경 준비와 손쉬운 도구 연결 덕분에, 에이전트가 코드를 고치고 실행할 공간을 구성하기 좋았습니다.',
        'en': 'We built AgenticRocket on Daytona. Its fast sandbox setup and agent-friendly tools give the AI a workspace to inspect, change, and run code.',
        'cue': 'Daytona의 연결·실행·에이전트 도구 세 항목을 짚고 넘어간다.'
    },
    {
        'seconds': 24, 'title': '코드 탐색, 개선안, 수정, 병렬 검증',
        'ko': 'GPT 같은 에이전트가 코드를 탐색하고 개선 가설을 세워 소스를 직접 수정합니다. 같은 에이전트가 프로젝트 맥락을 유지합니다. 이어서 Daytona 샌드박스 여러 개를 병렬로 실행합니다. 각 환경에서 같은 수정안을 원본과 반복 비교하고, 기능 검사와 성능 측정으로 개선 여부를 판단합니다.',
        'en': 'An agent such as GPT explores the code, forms a hypothesis, and edits the source while keeping the project context. Multiple Daytona sandboxes then run in parallel. Each repeatedly compares the same patch against the original, checking behavior and measuring performance.',
        'cue': '왼쪽의 한 에이전트에서 오른쪽의 여러 검증 환경으로 이어지는 흐름을 짚는다.'
    },
    {
        'seconds': 16, 'title': '프로젝트를 맡기면 결과를 받는다',
        'ko': '프로젝트를 등록하고 목표를 정하면, 에이전트가 최적화를 진행해 수정 코드와 검증 결과를 돌려줍니다. 무엇이 달라졌는지 확인하고 변경을 받아들일지 결정하면 됩니다.',
        'en': 'Add a project and set a goal. The agent returns a patch and verification results. Review what changed and how it performed, then decide whether to adopt it.',
        'cue': '프로젝트 입력과 수정 코드·검증 결과 두 산출물을 짚는다.'
    },
    {
        'seconds': 15, 'title': '시장과 크레딧 충전 모델',
        'ko': '첫 고객은 성능 개선이 필요한 시스템·네이티브 소프트웨어 개발팀입니다. 수익 모델은 크레딧 충전입니다. 고객이 크레딧을 구매하고, 최적화와 검증을 실행한 사용량만큼 차감하는 방식입니다.',
        'en': 'We’ll start with systems and native software teams that need better performance. Revenue comes from prepaid credits: customers top up, then spend credits on optimization and verification, based on usage.',
        'cue': '초기 타깃과 크레딧 충전 모델만 짧게 설명한다. 가격이나 아직 정하지 않은 과금 단위는 덧붙이지 않는다.'
    },
    {
        'seconds': 37, 'title': '실제 데모',
        'ko': '이제 실제 데모를 보시겠습니다. QR로 접속하실 수 있습니다. AI가 고친 코드와 검증 결과를 확인해보죠.',
        'en': 'Let’s see it in action. Scan the QR code to open the demo. We’ll look at the patch and verification results.',
        'cue': '02:23–02:30 전환 멘트. 02:30–03:00 실제 웹 데모: 목표와 프로젝트 → 실제 코드 변경 → 기능 검사와 측정 결과. QR을 스캔하거나 클릭해 https://jungwuk.jungwuk.com 에 접속한다. 숫자는 화면에서 확인되는 실제 결과만 말한다.'
    },
]

elapsed = 0
for note in NOTES:
    start, end = elapsed, elapsed + note['seconds']
    note['time'] = f'{start//60:02d}:{start%60:02d}–{end//60:02d}:{end%60:02d}'
    elapsed = end


def mini_window(d, x, y, w, h, accent=ORANGE, fill=WHITE):
    d.rect(x, y, w, h, fill, RULE, radius=9)
    d.line(x, y+27, x+w, y+27, RULE, 0.8)
    for i in range(3):
        d.circle(x+12+i*12, y+10, 5, RULE)
    d.rect(x+18, y+49, w*0.55, 9, accent, radius=4)
    d.rect(x+18, y+70, w*0.72, 6, RULE, radius=3)
    d.rect(x+18, y+86, w*0.43, 6, RULE, radius=3)
    if h > 145:
        d.rect(x+18, y+113, w-36, h-132, PALE, radius=5)


def build_story(d, screenshot=None):
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, box_size=24, border=4)
    qr.add_data(DEMO_URL)
    qr.make(fit=True)
    qr_path = ROOT/'assets/demo-qr.png'
    qr.make_image(fill_color='black', back_color='white').save(qr_path)
    # 01. A quiet cover. Low-level optimization remains the product category.
    d.page(True, 'AI PERFORMANCE ENGINEER')
    d.mark(58, 46, 29, CORAL)
    d.text('AgenticRocket', 54, 154, 83, BG, 'Bold', 850)
    d.text('코드를 고치고, 성능을 검증하는 AI', 59, 287, 34, BG, 'SemiBold', 842)
    d.text('AI that optimizes code and verifies the gain.', 59, 343, 29, MINT, 'Regular', 842)
    d.text('로우레벨 성능 최적화', 59, 439, 24, LIGHTMUTED, 'Regular', 350)
    d.text('Low-level performance optimization', 367, 441, 24, LIGHTMUTED, 'Regular', 536)

    # 02. The user-supplied unverified daily count becomes a qualitative claim.
    d.page(False, 'THE VIBE-CODING ERA')
    d.label('바이브코딩의 시대', 'The vibe-coding era')
    d.text('만드는 일은\n쉬워졌습니다.', 56, 107, 52, INK, 'Bold', 555, 1.12)
    d.text('Building products\nis getting easier.', 58, 246, 35, MUTED, 'Regular', 560)
    d.text('새로운 프로덕트가 매일 쏟아집니다.', 58, 394, 27, INK, 'SemiBold', 845)
    d.text('New products launch every day.', 58, 435, 27, MUTED, 'Regular', 845)
    mini_window(d, 661, 144, 232, 146, '#88A893', PALE)
    mini_window(d, 625, 186, 232, 178, ORANGE, WHITE)
    d.mark(792, 315, 43, ORANGE)

    # 03. Make the relationship between responsiveness and UX immediately visible.
    d.page(True, 'PERFORMANCE IS UX')
    d.label('무엇으로 차별화할까요?', 'What makes a product stand out?')
    d.text('최적화도\nUX입니다.', 56, 121, 58, BG, 'Bold', 440, 1.12)
    d.text('Performance\nis part of UX.', 58, 276, 36, MINT, 'Regular', 437)
    d.text('기획 · UI · UX', 551, 126, 32, LIGHTMUTED, 'SemiBold', 351)
    d.text('Product · UI · UX', 552, 171, 27, LIGHTMUTED, 'Regular', 351)
    d.rect(544, 238, 360, 201, PANEL, '#506C66', radius=13)
    d.text('UX', 568, 256, 27, MINT, 'SemiBold', 310)
    d.rect(568, 307, 312, 106, MINT, radius=8)
    d.text('빠른 반응', 590, 321, 33, INK, 'SemiBold', 265)
    d.text('Responsiveness', 591, 369, 28, INK, 'Regular', 265)

    # 04. Embed the original attachment intact; no generative redraw or crop.
    d.page(False, 'CORRECT. AND FAST.')
    d.label('작동, 그다음', 'Beyond working')
    d.text('작동을 넘어,', 56, 123, 44, INK, 'Bold', 410)
    d.text('올바르고\n빠르게.', 56, 187, 54, ORANGE, 'Bold', 403, 1.14)
    d.text('It needs to work.\nCorrectly. And fast.', 58, 341, 30, MUTED, 'Regular', 400, 1.22)
    d.image(ROOT/'assets/pigeon-meme.png', 432, 90, 392, 392)

    # 05. Remote execution separates the benchmark from the developer's work.
    d.page(False, 'A SPEEDUP NEEDS EVIDENCE')
    d.label('성능 개선의 조건', 'Verification matters')
    d.text('빨라졌다면, 검증해야죠.', 56, 101, 48, INK, 'Bold', 848)
    d.text('A speedup needs evidence.', 58, 165, 33, MUTED, 'Regular', 848)
    d.rect(56, 256, 386, 210, '#EEEEE7', radius=12)
    d.rect(518, 256, 386, 210, PALE, radius=12)
    d.text('로컬 측정', 80, 278, 32, INK, 'SemiBold', 338)
    d.text('Local benchmarks', 81, 322, 27, MUTED, 'Regular', 338)
    d.line(80, 366, 418, 366, RULE, 1)
    d.text('다른 작업이 측정에 간섭', 81, 385, 26, INK, 'Regular', 338)
    d.text('Other work adds noise', 81, 424, 26, MUTED, 'Regular', 338)
    d.text('외부 실행 환경', 542, 278, 32, INK, 'SemiBold', 338)
    d.text('Remote execution', 543, 322, 27, MUTED, 'Regular', 338)
    d.line(542, 366, 880, 366, RULE, 1)
    d.text('검증하는 동안 개발 계속', 543, 385, 26, INK, 'Regular', 338)
    d.text('Keep building as tests run', 543, 424, 25, MUTED, 'Regular', 338)
    d.arrow(458, 355, 498, 355, ORANGE, 3, 8)

    # 06. Real security examples, framed as an analogy rather than an empty market.
    d.page(False, 'FROM SECURITY TO PERFORMANCE')
    d.label('보안에는 익숙한 선택지', 'Familiar tools for security')
    d.text('성능 최적화도\n맡길 수 있을까요?', 56, 96, 48, INK, 'Bold', 848, 1.14)
    d.text('Can we delegate performance, too?', 58, 230, 33, MUTED, 'Regular', 848)
    d.line(56, 317, 904, 317, RULE, 1)
    d.text('보안 검사와 수정 지원', 58, 342, 25, MUTED, 'Regular', 400)
    d.text('Security checks & fixes', 491, 344, 25, MUTED, 'Regular', 412)
    d.text('Strix', 58, 399, 43, INK, 'SemiBold', 235)
    d.text('Snyk', 355, 399, 43, INK, 'SemiBold', 230)
    d.text('Semgrep', 647, 399, 43, INK, 'SemiBold', 255)
    # Linked source references stay out of the visual hierarchy.
    d.pdf.linkURL('https://www.strix.ai/', (58, 91, 205, 145), relative=0)
    d.pdf.linkURL('https://snyk.io/platform/deepcode-ai/', (355, 91, 510, 145), relative=0)
    d.pdf.linkURL('https://semgrep.dev/blog/2024/assistant-ga-launch/', (647, 91, 887, 145), relative=0)

    # 07. Why Daytona belongs in the product, at an audience-friendly level.
    d.page(True, 'BUILT WITH DAYTONA')
    d.label('그래서 만들었습니다', 'Introducing')
    d.text('AgenticRocket', 54, 103, 68, BG, 'Bold', 850)
    d.text('Daytona 위에서.', 58, 213, 37, BG, 'SemiBold', 848)
    d.text('Built with Daytona.', 59, 268, 31, MINT, 'Regular', 848)
    for x, ko, en in [(56, '쉬운 연결', 'Simple setup'), (346, '빠른 실행', 'Fast startup'), (636, '에이전트 중심', 'Built for agents')]:
        d.line(x, 355, x+268, 355, '#506C66', 1.1)
        d.text(ko, x, 381, 30, BG, 'SemiBold', 268)
        d.text(en, x+1, 425, 26, LIGHTMUTED, 'Regular', 267)
    d.mark(833, 149, 54, CORAL)

    # 08. One agent owns context; its verification tools fan out in parallel.
    d.page(False, 'EXPLORE · PLAN · EDIT · VERIFY')
    d.label('실제로 하는 일', 'How it works')
    d.text('코드를 고치고, 병렬로 검증합니다.', 56, 95, 42, INK, 'Bold', 848)
    d.text('Edit the code. Verify in parallel.', 58, 154, 32, MUTED, 'Regular', 848)
    d.text('하나의 AI 에이전트', 58, 232, 27, INK, 'SemiBold', 480)
    d.text('One project. One agent.', 58, 270, 25, MUTED, 'Regular', 480)
    for x, ko, en in [(56, '코드 탐색', 'Explore'), (242, '개선안', 'Plan a fix'), (428, '직접 수정', 'Edit code')]:
        d.rect(x, 330, 166, 112, WHITE, RULE, radius=8)
        d.text(ko, x+16, 350, 27, INK, 'SemiBold', 142)
        d.text(en, x+17, 391, 24, MUTED, 'Regular', 140)
    d.arrow(225, 383, 237, 383, ORANGE, 1.8, 4)
    d.arrow(411, 383, 424, 383, ORANGE, 1.8, 4)
    d.text('Daytona', 705, 221, 27, INK, 'SemiBold', 198)
    d.text('병렬 검증', 704, 260, 25, MUTED, 'Regular', 199)
    # Tiny source labels are auxiliary; before/after and parallelism are large.
    d.line(604, 383, 640, 383, ORANGE, 2)
    d.line(640, 319, 640, 451, ORANGE, 2)
    for yy in [296, 362, 428]:
        d.arrow(640, yy+23, 687, yy+23, ORANGE, 2, 6)
        d.rect(698, yy, 206, 48, PALE, RULE, radius=6)
        d.text('Before / After', 721, yy+10, 25, INK, 'SemiBold', 165)
    d.text('수정 전후 비교', 700, 188, 24, MUTED, 'Regular', 205, essential=False)

    # 09. A single input and two concrete outputs, with no invented success metric.
    d.page(False, 'A PROJECT IN. A PATCH AND EVIDENCE OUT.')
    d.label('사용자가 할 일', 'Your part')
    d.text('프로젝트를 맡기면,\n최적화 결과가 돌아옵니다.', 56, 95, 47, INK, 'Bold', 848, 1.14)
    d.text('Bring your project.\nGet the patch and the evidence.', 58, 226, 31, MUTED, 'Regular', 845, 1.2)
    if screenshot:
        d.rect(56, 326, 848, 152, WHITE, RULE, radius=8)
        d.image(screenshot, 68, 336, 824, 130)
    else:
        d.rect(56, 359, 249, 109, WHITE, RULE, radius=9)
        d.text('프로젝트 등록', 77, 377, 29, INK, 'SemiBold', 212)
        d.text('Add a project', 78, 419, 25, MUTED, 'Regular', 211)
        d.arrow(326, 413, 391, 413, ORANGE, 3, 9)
        for xx, ko, en in [(416, '수정 코드', 'Patch'), (674, '검증 결과', 'Evidence')]:
            d.rect(xx, 359, 230, 109, PALE, radius=9)
            d.text(ko, xx+22, 377, 29, INK, 'SemiBold', 187)
            d.text(en, xx+23, 419, 25, MUTED, 'Regular', 186)

    # 10. A focused initial market and the user's prepaid-credit business model.
    d.page(False, 'MARKET & BUSINESS MODEL')
    d.label('비즈니스', 'Business')
    d.text('시장과 수익 모델', 56, 95, 47, INK, 'Bold', 848)
    d.text('Market & business model', 58, 160, 32, MUTED, 'Regular', 845)
    d.rect(56, 243, 403, 228, WHITE, RULE, radius=12)
    d.rect(485, 243, 419, 228, PALE, radius=12)
    d.text('초기 타깃', 80, 261, 24, MUTED, 'SemiBold', 355)
    d.text('Initial market', 270, 263, 24, MUTED, 'Regular', 165)
    d.text('시스템·네이티브\n소프트웨어 개발팀', 80, 315, 32, INK, 'SemiBold', 355, 1.13)
    d.text('Systems & native\nsoftware teams', 81, 402, 25, MUTED, 'Regular', 355, 1.14)
    d.text('크레딧 충전', 509, 263, 39, ORANGE, 'Bold', 368)
    d.text('Prepaid credits', 511, 320, 30, INK, 'SemiBold', 367)
    d.line(510, 371, 878, 371, RULE, 1)
    d.text('최적화·검증 사용량만큼 차감', 510, 392, 26, INK, 'Regular', 368)
    d.text('Pay for optimization & verification', 511, 434, 24, MUTED, 'Regular', 367)

    # 11. Finish the introduction by handing over to the real application.
    d.page(True, 'LIVE DEMO')
    d.label('실제 데모', 'Live demo')
    d.text('실제 데모를\n보시겠습니다.', 56, 133, 48, BG, 'Bold', 437, 1.16)
    d.text('Let’s see it\nin action.', 59, 272, 35, MINT, 'Regular', 434, 1.16)
    d.text('QR로 바로 접속하세요.', 59, 409, 26, LIGHTMUTED, 'Regular', 434)
    d.text('Scan to open the demo.', 60, 450, 25, LIGHTMUTED, 'Regular', 433)
    d.text('데모 열기', 565, 91, 25, BG, 'SemiBold', 125)
    d.text('Open demo', 700, 93, 24, MINT, 'Regular', 128)
    d.image(qr_path, 565, 136, 316, 316)
    d.pdf.linkURL(DEMO_URL, (565, 88, 881, 404), relative=0)
    d.slide.shapes[-1].click_action.hyperlink.address = DEMO_URL
    d.text('jungwuk.jungwuk.com', 570, 459, 24, LIGHTMUTED, 'SemiBold', 309)
    d.pdf.linkURL(DEMO_URL, (570, 50, 889, 83), relative=0)

    d.save()

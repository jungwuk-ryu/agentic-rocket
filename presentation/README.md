# AgenticRocket 발표 자료

11장 · 16:9 · 한국어/영어 병기 · Pretendard 내장

발표 시간은 **설명 2분 30초 + 실제 데모 30초**로 배정했습니다. 비즈니스 설명은 15초입니다. 한국어와 영어 대본 중 하나로 발표합니다.

- `AgenticRocket_3min_KO-EN.pdf`: 발표용 PDF.
- `AgenticRocket_3min_KO-EN.pptx`: 편집용 PowerPoint. 발표자 노트에 한영 대본과 시간이 있습니다.
- `speaker-notes.md`: 발표 대본과 데모 진행 순서.
- `previews/overview.png`: 11장 전체 미리보기.
- `assets/demo-qr.png`: https://jungwuk.jungwuk.com 으로 연결되는 QR 원본.
- `story_slides.py`: 발표 흐름·문구·배치.
- `build_deck.py`: PDF·PowerPoint·미리보기 생성기.
- `archive/AgenticRocket_6slide_previous.zip`: 이전 6장 버전 보관본.
- `archive/AgenticRocket_10slide_before_business.zip`: 비즈니스 장 추가 전 보관본.

## 구성

1. AgenticRocket
2. 바이브코딩으로 쉬워진 제품 개발
3. 최적화도 사용자 경험
4. 작동을 넘어 올바르고 빠르게 — 첨부한 비둘기 이미지
5. 성능 개선에는 검증이 필요하며, 외부 환경에서 내 작업과 분리
6. Strix·Snyk·Semgrep의 보안 사례에서 성능 최적화로 연결
7. Daytona로 만든 AgenticRocket
8. 코드 탐색 → 개선안 → 직접 수정 → 여러 샌드박스의 병렬 검증
9. 프로젝트를 맡기고 수정 코드·검증 결과 확인
10. 초기 타깃 시장과 크레딧 충전 수익 모델
11. 실제 데모와 큰 QR

## 편집과 다시 만들기

PowerPoint 편집 시 `assets/fonts`의 Pretendard를 설치하면 서체가 유지됩니다. 라이선스도 포함했습니다. PDF에는 글꼴이 내장되어 있습니다. 핵심 본문과 도식은 24pt 이상입니다.

```bash
python3 -m venv .venv
.venv/bin/pip install reportlab pymupdf python-pptx 'qrcode[pil]'
.venv/bin/python build_deck.py
```

`--screenshot /absolute/path/to/results.png` 옵션은 9장의 하단 도식을 실제 결과 화면으로 교체합니다. 그림이 복잡하다면 PowerPoint에서 해당 장을 다시 배치해 결과를 크게 보여주는 편이 좋습니다.

비둘기 그림은 원본 비율로 그대로 넣었습니다. 모든 장 오른쪽 위에 108pt 정사각형 데모 QR을 넣었습니다. 마지막 장에는 큰 316pt QR도 유지했습니다. QR은 스캔에 필요한 흰색 여백을 포함합니다. PDF와 PowerPoint의 QR은 클릭으로도 연결됩니다.

## 문구의 근거와 범위

사용자가 제공한 10단계 흐름에 간략한 비즈니스 설명을 추가했습니다. 초기 타깃은 시스템·네이티브 소프트웨어 개발팀으로 제안하고, 수익 모델은 사용자가 정한 크레딧 충전 방식으로 표현했습니다. 최적화·검증 사용량만큼 크레딧을 차감하는 모델이며, 가격과 세부 과금 단위는 정하지 않았습니다. 결제 기능의 구현 상태를 주장하는 장은 아닙니다.

확인되지 않은 숫자와 과한 단정은 다음과 같이 다듬었습니다.

- 하루 제품 출시 수는 숫자 대신 “새로운 프로덕트가 매일 쏟아집니다”로 표현했습니다.
- 로컬에서 다른 작업을 절대 해서는 안 된다는 주장 대신, 다른 작업이 측정에 간섭할 수 있다고 설명했습니다. 외부 실행 환경에서도 조건을 맞춘 반복 측정은 필요합니다.
- 성능 최적화 제품도 존재하므로, 시장에 제품이 없다는 주장 대신 “성능 최적화도 맡길 수 있을까요?”로 연결했습니다.
- 현재 앱의 GPT 기반 설정을 확인했습니다. 화면에는 AI 에이전트, 대본에는 GPT를 예로 들었습니다.
- 실제 성능 수치는 슬라이드에 넣지 않았습니다. 마지막 데모에서 확인되는 측정 결과를 설명하면 됩니다.

## 출처 · 2026-09-19 확인

- [Strix](https://www.strix.ai/): 취약점 탐지와 검증·수정.
- [Snyk DeepCode AI](https://snyk.io/platform/deepcode-ai/): 코드 보안 분석과 수정 지원.
- [Semgrep Assistant](https://semgrep.dev/blog/2024/assistant-ga-launch/): AI 기반 보안 분류와 수정 제안.
- [Daytona](https://www.daytona.io/): AI 코드 실행용 샌드박스 인프라.
- [Google Benchmark의 변동성 제어 안내](https://github.com/google/benchmark/blob/main/docs/reducing_variance.md): 측정 결과가 실행 환경의 영향을 받는다는 근거.
- [CodSpeed](https://codspeed.io/)와 [Codeflash](https://www.codeflash.ai/): 성능 측정·자동 최적화 제품이 존재한다는 사실 확인.
- 저장소의 `AGENTICROCKET_MASTER_PROMPT.md`, `app/README.md`, `app/server/lib/config.mjs`: 제품 흐름, 지속적인 프로젝트 세션, 모델 설정, Daytona 검증 설계.

이 자료는 제품 발표용이며, 서비스 전체의 실행 검증 보고서는 아닙니다.

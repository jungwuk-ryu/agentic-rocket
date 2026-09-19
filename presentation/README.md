# AgenticRocket 발표 자료

6장 · 16:9 · 한영 병기 · 3분 발표

- `AgenticRocket_3min_KO-EN.pdf`: 발표용 PDF. 한글 글꼴을 내장한 벡터 문서입니다.
- `AgenticRocket_3min_KO-EN.pptx`: 편집 가능한 원본. 각 슬라이드의 발표자 노트에 한국어와 영어 대본을 넣었습니다.
- `speaker-notes.md`: 슬라이드별 시간과 대본. 한국어 또는 영어 중 한 언어로 발표합니다.
- `previews/overview.png`: 전체 미리보기.
- `build_deck.py`: PDF와 PowerPoint를 함께 생성하는 소스.

발표의 중심은 **병목 발견 → 실제 로우레벨 소스 수정 → 실행과 반복 검증**입니다. 성능 검사만 하는 도구로 소개하지 않습니다.

## Wine 사례의 범위

2장의 메모리 할당·재사용 그림은 로우레벨 최적화를 설명하는 **활용 시나리오**입니다. 실제 Wine 코드에서 발견된 결함이나 측정 결과를 뜻하지 않습니다. 발표 대본에도 이 범위를 반영했습니다.

프로젝트 명세의 첫 데모 대상은 C++17 PulseLog입니다. 이번 자료에는 확인되지 않은 성능 수치, 실사용 사례, 실제 Wine 최적화 완료 주장을 넣지 않았습니다. 제품의 기획과 동작을 설명하는 발표 자료이며, 서비스의 구현 완료 인증 자료는 아닙니다.

## 스크린샷 추가

5장 오른쪽 결과 보고서 영역을 실제 화면으로 교체하면 됩니다. PowerPoint에서는 `RESULT_SCREENSHOT_REGION` 도형 영역에 수정 코드·테스트·측정 결과가 보이는 화면을 배치하세요. 작은 글씨가 많은 전체 대시보드보다 결과 영역을 크게 보여주는 편이 좋습니다.

생성 소스로 교체하려면:

```bash
python3 -m venv .venv
.venv/bin/pip install reportlab pymupdf python-pptx
.venv/bin/python build_deck.py --screenshot /absolute/path/to/results.png
```

Wine 측정이 아닌 화면을 넣을 때는 해당 저장소 이름을 그대로 유지하세요. 4장의 세 샌드박스는 각 환경 내부의 수정 전후 반복 비교를 뜻합니다.

## 폰트와 가독성

PDF에는 Pretendard를 내장했습니다. 편집용 PowerPoint를 열 때는 `assets/fonts`의 Pretendard를 설치하면 서체가 유지됩니다. 라이선스도 같은 폴더에 포함했습니다. 요청에 따라 제목을 약 8–12% 줄였으며, 주요 문장은 29–78pt, 설명과 도식은 24pt 이상입니다. 페이지 번호와 보조 표기는 작게 처리했습니다.

## 참고 자료 · 2026-09-19 확인

- [프로젝트 기획 대화](https://chatgpt.com/c/6a887f75-72e0-83e8-8eab-962dee8434d2)와 저장소의 `AGENTICROCKET_MASTER_PROMPT.md`: 지속적인 한 프로젝트 세션, 실제 소스 패치, 동일 수정안의 세 샌드박스 검증, 검증 근거 전달.
- [Wine 공식 소스 미러 README](https://github.com/wine-mirror/wine/blob/master/README.md): Windows 프로그램을 Unix 계열 환경에서 실행하는 소프트웨어라는 소개.
- [Daytona 공식 문서](https://www.daytona.io/docs/en/): 코드 실행용 sandbox와 관리 기능. 세 환경의 판정 기준은 AgenticRocket 자체 기획입니다.
- [PulseLog 데모 저장소](https://github.com/jungwuk-ryu/agenticrocket-demo-perf): C++17, CMake, correctness tests, CPU 중심 benchmark.
- [CodSpeed](https://codspeed.io/), [Codeflash](https://www.codeflash.ai/), [Bencher](https://bencher.dev/): 성능 검사·최적화 제품이 이미 있으므로, 시장에 경쟁 제품이 없다는 주장은 사용하지 않았습니다.
- [Daytona HackSprint Seoul](https://luma.com/daytonaseoul): 행사 맥락.

발표 화면에서는 출처와 구현 세부 내용을 줄이고, 핵심 메시지와 개념 도식에 집중했습니다.

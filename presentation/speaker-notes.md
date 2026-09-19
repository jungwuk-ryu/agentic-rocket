# AgenticRocket · 3분 발표 대본

화면에는 한국어와 영어가 함께 나옵니다. 발표는 아래 한국어 대본 또는 영어 대본 중 하나를 사용합니다. 두 언어를 연달아 읽으면 3분을 넘습니다.

배정 시간은 총 180초입니다. 문장 사이의 멈춤과 화면을 짚는 시간을 포함한 리허설 기준이며, 실제 발화 속도에 맞춰 조정하세요.

## 한국어 발표

### 1. 느린 코드를 직접 고치는 AI · 00:00–00:20 (20초)

안녕하세요. AgenticRocket은 느린 코드의 병목을 찾아 직접 고치는 AI 성능 최적화 솔루션입니다. 프로그램 안쪽의 로우레벨 코드를 다룹니다. 불필요한 계산이나 메모리 작업을 줄여 같은 일을 더 빠르게 끝내는 것이 목표입니다.

발표 팁: 첫 문장 뒤 한 박자 쉰다. “직접 고치는”에 힘을 준다.

### 2. Wine으로 이해하는 로우레벨 최적화 · 00:20–00:55 (35초)

Wine을 예로 들어보겠습니다. Windows 프로그램을 Linux에서도 실행하게 해주는 오픈소스입니다. 프로그램은 잘 실행되는데, 안에서 같은 메모리 공간을 매번 새로 준비하느라 시간을 쓴다고 가정해보죠. 기존 공간을 다시 쓸 수 있다면, 같은 결과를 내는 데 필요한 작업이 줄어듭니다. 화면은 이런 최적화를 설명하는 예시입니다. AgenticRocket은 이렇게 코드 깊숙한 곳의 낭비를 찾아 줄이려 합니다.

발표 팁: 왼쪽의 반복 할당에서 오른쪽의 재사용으로 손짓한다. Wine은 활용 시나리오로 소개한다.

### 3. 병목 발견부터 실제 소스 수정까지 · 00:55–01:30 (35초)

사용자는 프로젝트와 목표를 맡깁니다. 기존 동작을 유지하면서 더 빠르게 만들어달라는 겁니다. 에이전트는 코드를 읽고 실행 결과를 확인해 느린 원인을 찾습니다. 수정할 방법을 정하면 소스를 직접 바꾸고 빌드와 테스트를 돌립니다. 오류가 나면 그 결과를 읽고 다시 고칩니다. 이 일을 한 에이전트가 같은 프로젝트에서 계속 맡습니다. 사용자가 이 패치로 다시 측정해달라고 하면, 앞선 작업을 이어서 진행합니다.

발표 팁: 분석 → 수정 → 재실행 순서로 짚는다. “소스를 직접 바꾼다”가 핵심이다.

### 4. Daytona에서 실행하고 반복 검증 · 01:30–02:10 (40초)

여기서 Daytona가 핵심 역할을 합니다. AI가 실제 코드를 고치고 실행하는 작업 공간이면서 개선을 확인하는 실험실입니다. 수정안 하나를 세 개의 샌드박스, 즉 분리된 실행 공간에 보냅니다. 각 공간 안에서 원본과 수정본을 같은 조건으로 여러 번 비교합니다. 기능 테스트와 결과값도 확인합니다. 한 번 우연히 빨랐다는 이유로 성공이라고 하지 않습니다. 반복해서 개선이 확인돼야 하고 결과가 불안정하면 판단을 보류합니다.

발표 팁: 세 상자를 천천히 짚는다. “각 공간 안에서 전후 비교”를 분명히 말한다.

### 5. 코드와 검증 근거를 함께 전달 · 02:10–02:40 (30초)

개발자는 실제 수정 코드와 검증 근거를 가져갑니다. 무엇을 바꿨는지, 어떤 기능 테스트를 통과했는지, 측정한 작업이 얼마나 빨라졌는지 함께 확인합니다. 수정안과 보고서를 내려받아 코드 리뷰에 사용할 수 있습니다. AI가 왜 이렇게 고쳤는지도 같은 프로젝트에서 물어볼 수 있습니다. 개발자는 코드와 실행 결과를 보고 이 변경을 받아들일지 결정합니다.

발표 팁: 실제 화면이 준비되면 오른쪽 보고서 도식을 교체하고, 수정 코드와 측정 결과를 짚는다.

### 6. AgenticRocket · 02:40–03:00 (20초)

저희가 만들고 싶은 것은, 프로젝트를 맡기면 병목을 찾아 고치고 검증까지 이어가는 AI 성능 엔지니어입니다. Wine 같은 복잡한 소프트웨어에도 이런 최적화 작업을 더 쉽게 맡길 수 있도록 하겠습니다. AgenticRocket. AI가 고치고 실행으로 증명합니다. 감사합니다.

발표 팁: 마지막 제품명과 핵심 문장을 말한 뒤 멈춘다.

## English talk

### 1. 느린 코드를 직접 고치는 AI · 00:00–00:20 (20초)

AgenticRocket is an AI performance engineer that finds bottlenecks and changes the code. We focus on low-level optimization: removing unnecessary computation and memory work so software can do the same job faster.

### 2. Wine으로 이해하는 로우레벨 최적화 · 00:20–00:55 (35초)

Take Wine, the open-source project that runs Windows programs on Linux. Imagine a frequently called path allocating fresh memory every time. If it can safely reuse that memory, it can do the same work with less overhead. This diagram illustrates an optimization idea, rather than a measured Wine result. It makes our focus tangible: finding and removing wasted work deep inside the code.

### 3. 병목 발견부터 실제 소스 수정까지 · 00:55–01:30 (35초)

You give the agent a project and a goal: make it faster while preserving its behavior. It reads the code, examines execution results, and narrows down the bottleneck. Then it edits the source, builds it, and runs the tests. If something fails, it uses that result to revise the fix. One agent stays with the project, so follow-up requests continue from the existing work.

### 4. Daytona에서 실행하고 반복 검증 · 01:30–02:10 (40초)

Daytona provides both the workspace where the agent changes and runs code, and the sandboxes where we check the improvement. We send one fixed patch to three sandboxes. Within each sandbox, we compare the original and modified code repeatedly under matched conditions. We also check tests and outputs. One lucky fast run is not enough. The improvement must be consistent, and uncertain results remain inconclusive.

### 5. 코드와 검증 근거를 함께 전달 · 02:10–02:40 (30초)

The developer gets the actual patch together with the evidence: what changed, which tests passed, and the measured performance difference. The patch and report can be downloaded for code review. You can also ask the same agent why it made the change. That gives the developer something concrete to review before deciding whether to adopt the optimization.

### 6. AgenticRocket · 02:40–03:00 (20초)

Our goal is an AI performance engineer that stays with a project, finds the bottleneck, makes the fix, and verifies it. We want to make that work accessible even for complex software like Wine. AgenticRocket: AI makes the fix. Real runs prove the gain. Thank you.

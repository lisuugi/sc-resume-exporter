# 프로젝트 지침

삼성 커리어스 지원서 미리보기를 Markdown / 이미지로 내보내는 **북마클릿**입니다.
빌드 산출물이 `javascript:` URL 이라는 점이 이 프로젝트의 모든 제약을 만듭니다.

## 구조

| 경로 | 역할 |
|---|---|
| `src/exporter.js` | 전체 로직. 단일 파일, 런타임 의존성 없음 |
| `build.mjs` | terser 최소화 → `javascript:` URL → `index.html` 주입 |
| `index.html` | GitHub Pages 안내 페이지. 북마클릿 링크가 주입됨 |
| `docs/PARSING.md` | 파싱 규칙과 **설계 근거**. 코드 수정 전 필독 |
| `test/` | jsdom 기반 검증 38건 |
| `dist/` | 빌드 산출물. 직접 편집하지 말 것 |
| `scripts/demo.mjs` | README 데모 스크린샷(`docs/assets/demo.png`) 생성. 픽스처만 사용 |
| `.github/workflows/test.yml` | CI. 빌드 결과 커밋 여부 + src/dist 테스트 |

## 작업 규칙

- `src/exporter.js` 를 고쳤으면 **반드시** `npm run build` 를 돌린다.
  안 돌리면 `index.html` 의 북마클릿과 `dist/` 가 소스와 어긋난 채 배포된다.
- 커밋 전 `npm test` 와 `TARGET=dist npm test` 를 둘 다 통과시킨다.
  최소화 과정에서 깨지는 경우가 있어 빌드 결과도 따로 검증한다.
- `dist/` 는 커밋 대상이다. GitHub Pages 가 정적 파일만 서빙하므로 빌드 결과가 저장소에 있어야 한다.
- 파싱 분기 순서를 바꾸기 전에 `docs/PARSING.md` 4장을 읽는다.
  `.dl` 분기가 `h4` 분기보다 먼저여야 하는 이유가 적혀 있고, 뒤집으면 문서 구조가 무너진다.
- ES5 문법을 유지한다. 북마클릿은 구형 환경에서도 실행될 수 있다.

## 절대 하지 말 것

- 실제 지원자의 개인정보를 저장소에 넣지 않는다.
  테스트 픽스처와 예시는 전부 가공 데이터여야 한다.
- 외부로 데이터를 보내는 코드를 추가하지 않는다.
  분석 스크립트, 에러 리포팅, 원격 로깅 모두 포함이다. 이 도구의 신뢰는 여기에 달려 있다.
- 삼성전자 상표·로고·브랜드 색을 사용하지 않는다. 비공식 도구임이 명확해야 한다.

## 배포 절차

1. `OWNER` 자리표시자를 실제 GitHub 아이디로 치환 (`README.md`, `index.html`)
2. `npm run build`
3. `npm test && TARGET=dist npm test`
4. commit → push (기본 브랜치 `main`)
5. GitHub Pages: Source = `main` / root

배포 후 `https://<아이디>.github.io/<저장소>/` 에서 북마클릿을 즐겨찾기로 끌어다 놓아 확인한다.

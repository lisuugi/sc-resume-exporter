/**
 * exporter.js 파싱 로직 검증.
 *
 * jsdom 은 innerText 를 구현하지 않으므로, 테스트 전에 렌더링에 가까운
 * innerText 근사치를 심어 준다. (블록 요소 경계와 <br> 을 줄바꿈으로)
 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { HTML } from './fixture.js';

const dom = new JSDOM(`<!doctype html><html><body>${HTML}</body></html>`, {
  pretendToBeVisual: true,
  runScripts: 'outside-only' // window.eval 이 window 컨텍스트에서 실행되도록
});
const { window } = dom;

// --- innerText 폴리필 (jsdom 미구현) ---------------------------------
Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
  get() {
    // 텍스트 노드의 개행을 보존하고, 블록 경계마다 개행을 넣는다.
    const walk = (node) => {
      let out = '';
      for (const c of node.childNodes) {
        if (c.nodeType === 3) out += c.textContent;
        else if (c.nodeType === 1) {
          if (c.tagName === 'BR') out += '\n';
          else {
            const disp = window.getComputedStyle(c).display;
            const block = disp === 'block' || /^(DIV|P|TR|TABLE|H\d|LI)$/.test(c.tagName);
            if (block) out += '\n';
            out += walk(c);
            if (block) out += '\n';
          }
        }
      }
      return out;
    };
    return walk(this).replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  },
  configurable: true
});

// --- 전역 주입 후 exporter 실행 ---------------------------------------
const src = readFileSync(new URL(process.env.TARGET === 'dist' ? '../dist/exporter.min.js' : '../src/exporter.js', import.meta.url), 'utf8');

let alerted = null;
window.alert = (m) => { alerted = m; };
window.URL.createObjectURL = () => 'blob:test';
window.URL.revokeObjectURL = () => {};

const captured = [];
// 다운로드를 가로채 결과 문자열을 확보한다.
const origCreate = window.document.createElement.bind(window.document);
window.document.createElement = function (tag) {
  const el = origCreate(tag);
  if (tag === 'a') {
    let name = '';
    Object.defineProperty(el, 'download', {
      set(v) { name = v; }, get() { return name; }, configurable: true
    });
    el.click = () => captured.push({ name });
  }
  return el;
};

window.eval(src);

// --- 검증 -------------------------------------------------------------
const panel = window.document.getElementById('__scre_panel__');
let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${extra ? '\n        ' + extra : ''}`); failures++; }
};

console.log('\n[1] 부트');
check('패널이 생성됨', !!panel);
check('alert 미발생', alerted === null, String(alerted));
if (!panel) { console.log('\n중단: 패널 없음'); process.exit(1); }

// 마크다운 버튼 클릭 → Blob 내용 확보
const sh = panel.shadowRoot;
let md = '';
const OrigBlob = window.Blob;
window.Blob = class extends OrigBlob {
  constructor(parts, opts) { super(parts, opts); if (String(opts?.type).includes('markdown')) md = parts.join(''); }
};
sh.querySelector('[data-a="md"]').click();

console.log('\n[2] 추출 실행');
check('마크다운이 생성됨', md.length > 0);
check('파일 다운로드가 트리거됨', captured.length === 1, JSON.stringify(captured));
check('파일명에 지원자명 포함', /홍길동/.test(captured[0]?.name || ''), captured[0]?.name);
const mdPlain = md; // DUMP=1 로 examples/sample-output.md 를 다시 만들 때 쓴다

console.log('\n[3] 스코프 — 배경 폼·숨김 요소 배제');
check('배경 편집 폼 제목 미포함', !md.includes('배경 편집 폼 제목'));
check('배경 필드 미포함', !md.includes('배경값'));
check('숨김 섹션 미포함', !md.includes('숨겨진 섹션') && !md.includes('숨김값'));
check('닫힌 로그인 모달 미포함', !md.includes('있으면 안 되는 값'));

console.log('\n[4] 구조');
check('front matter 존재', md.startsWith('---\n'));
check('공고명이 h1', md.includes('# 20XX년 상반기 신입사원 채용 공고 (샘플부문)'));
check('breadcrumb 인용', md.includes('> [샘플전자] | AB - 가나다사업부 | 시스템 소프트웨어'));
check('섹션 번호 부여', md.includes('## 1. 지원 부문/직무/지역'));
check('필드명이 소제목으로 오분류되지 않음', !md.includes('### 지원자'));

console.log('\n[5] 다중값 — 지망 표 재구성');
check('지망 표 헤더', md.includes('| 지망 | 지원부문 | 지원직무 | 희망근무지역 |'));
check('1지망 행', md.includes('| 1 | AB - 가나다사업부 | 시스템 소프트웨어 | 어딘가 |'));
check('3지망 행', md.includes('| 3 | AB - Sample Research | 응용 소프트웨어 | 다른곳 |'));
check('원본 나열 필드는 제거됨', !md.includes('- **지원부문**:'));

console.log('\n[6] 붙음 버그 수정 (구 로직의 "국내서울특별시" 문제)');
check('주소에 구분자 삽입', md.includes('- **주소**: 국내 | 어느도 어느시 어느로 1 (샘플동) 101동 101호'),
  (md.match(/- \*\*주소\*\*.*/) || [''])[0]);
check('값 없는 필드는 (없음) 으로 보존', md.includes('- **지원직군**: (없음)') || md.includes('| 지원직군 |'));

console.log('\n[7] 표 정리');
check('상수 열이 표 밖으로', /전공명: 샘플공학\(샘플대-학사-주전공\)/.test(md));
check('재수강 여부도 상수로 추출', /재수강 여부: N/.test(md));
check('과목유형으로 분할 — 전공', md.includes('#### 전공 (3과목)'));
check('과목유형으로 분할 — 교양기타', md.includes('#### 교양기타 (2과목)'));
check('분할된 표에 과목유형 열 없음', !/\| 과목유형 \|/.test(md));
check('요약 표(3행 미만)는 그대로 유지', md.includes('| 과정 | 전공 | 학교 |'));

console.log('\n[8] 에세이');
check('문항이 소제목으로', md.includes('### 지원 동기를 기술하십시오.'));
check('두 번째 문항도', md.includes('### 성장과정을 기술하십시오.'));
check('문단 줄바꿈 보존', /\[첫 번째 소제목\]\n첫 문단입니다/.test(md));
check('문단 사이 빈 줄 보존', /\n\n\[두 번째 소제목\]/.test(md));

console.log('\n[9] 경력 표 — 셀 내 줄바꿈 평탄화');
check('셀 줄바꿈이 표를 깨뜨리지 않음', md.includes('1. 첫 번째 업무 2. 두 번째 업무'));

console.log('\n[10] 마스킹');
captured.length = 0; md = '';
sh.querySelector('#mk').checked = true;
sh.querySelector('[data-a="md"]').click();
check('주소 마스킹', md.includes('- **주소**: ███ (마스킹)'));
check('휴대폰 마스킹', md.includes('- **휴대폰 번호**: ███ (마스킹)'));
check('지원자명 front matter 제외', !/^applicant:/m.test(md));
check('지원자명 본문 마스킹', md.includes('- **지원자**: ███ (마스킹)'));
check('영문 이름 마스킹', md.includes('- **영문 이름**: ███ (마스킹)'));
check('생년월일 마스킹', md.includes('- **생년월일**: ███ (마스킹)'));
check('이메일 마스킹', md.includes('- **이메일**: ███ (마스킹)'));
const LEAKS = ['홍길동', 'HONG GILDONG', '어느도', '0000-0000', '2000.01.01', 'gildong@', '샘플대', '샘플공학', '샘플회사', '샘플팀'];
check('식별 정보가 문서 어디에도 없음', LEAKS.every((s) => !md.includes(s)), LEAKS.filter((s) => md.includes(s)).join(', '));
check('학교·전공 열 마스킹', md.includes('| 학사 | ███ | ███ |'), (md.match(/\| 과정 \| 전공 \| 학교 \|\n.*\n.*/) || [''])[0]);
check('경력 회사명 열 마스킹', /\| ███ \| 2024-01 ~ 2024-12 \| ███ \|/.test(md));
check('파일명에 지원자명 미포함', !/홍길동/.test(captured[0]?.name || '') && /_마스킹\.md$/.test(captured[0]?.name || ''),
  captured[0]?.name);
check('마스킹 표기', md.includes('privacy: 개인정보 마스킹 적용됨'));
check('본문은 유지', md.includes('### 지원 동기를 기술하십시오.') && md.includes('첫 문단입니다.'));
check('에세이 문항은 키워드가 있어도 유지', md.includes('### 전공 역량을 기술하십시오.'));
check('에세이 속 재등장 값만 가림', md.includes('███ ███ 수업에서 ███ 이라는 이름으로 발표했습니다.'),
  (md.match(/.*수업에서.*/) || [''])[0]);
check('과목명·성적은 유지', md.includes('| 2020 | 1 | 가전공과목 | 3 | A+ |'));
check('지망 정보는 유지', md.includes('| 1 | AB - 가나다사업부 | 시스템 소프트웨어 | 어딘가 |'));

console.log('\n[11] 중복 실행 방지');
const before = window.document.querySelectorAll('#__scre_panel__').length;
window.eval(src);
check('패널이 하나만 유지됨', window.document.querySelectorAll('#__scre_panel__').length === before);

// --- 이미지 캡처 -------------------------------------------------------
// html2canvas 를 가짜로 바꿔, 렌더링 시점에 모달에 적혀 있던 글자를 확보한다.
// 이 글자가 곧 이미지에 찍히는 내용이다.
let drawn = null;
let photoHidden = null;
const photo = () => window.document.querySelector('#formPreview .photo img');
window.html2canvas = (el) => {
  drawn = el.textContent;
  photoHidden = photo().style.visibility === 'hidden';
  return Promise.resolve({ width: 10, height: 20, toBlob: (cb) => cb(new window.Blob(['jpg'])) });
};
window.scrollTo = () => {};
const modalText = () => window.document.querySelector('#formPreview .modalBody').textContent;
const capture = async () => {
  captured.length = 0; drawn = null;
  sh.querySelector('[data-a="img"]').click();
  for (let i = 0; i < 50 && !captured.length; i++) await new Promise((r) => setTimeout(r, 10));
};
const SECRETS = ['홍길동', 'HONG GILDONG', '어느도 어느시', '+82-010-0000-0000', '2000.01.01',
  'gildong@example.com', '샘플대', '샘플공학', '샘플회사', '샘플팀'];

console.log('\n[12] 이미지 캡처 — 마스킹');
sh.querySelector('#mk').checked = true;
await capture();
check('캡처 실행됨', drawn !== null && captured.length === 1, sh.querySelector('.st').textContent);
check('이미지에 인적사항 없음', drawn !== null && SECRETS.every((s) => !drawn.includes(s)),
  SECRETS.filter((s) => drawn?.includes(s)).join(', '));
check('마스킹 표기가 찍힘', (drawn || '').includes('███ (마스킹)'));
check('본문은 유지', (drawn || '').includes('지원 동기를 기술하십시오.') && (drawn || '').includes('가전공과목'));
check('에세이 문항은 유지', (drawn || '').includes('전공 역량을 기술하십시오.'));
check('사진 숨김', photoHidden === true);
check('캡처 후 화면 원상복구', SECRETS.every((s) => modalText().includes(s)),
  SECRETS.filter((s) => !modalText().includes(s)).join(', '));
check('캡처 후 사진 복구', photo().style.visibility === '');
check('모달이 원래 자리로 복귀', !!window.document.querySelector('main.application > #formPreview'));
check('파일명에 지원자명 미포함', /_마스킹\.jpg$/.test(captured[0]?.name || ''), captured[0]?.name);
check('완료 문구에 마스킹 표시', sh.querySelector('.st').textContent.includes('마스킹 적용'));

console.log('\n[13] 이미지 캡처 — 마스킹 해제');
sh.querySelector('#mk').checked = false;
await capture();
check('인적사항이 그대로 찍힘', drawn !== null && SECRETS.every((s) => drawn.includes(s)));
check('사진도 그대로', photoHidden === false);
check('파일명에 지원자명 포함', /홍길동\.jpg$/.test(captured[0]?.name || ''), captured[0]?.name);

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures}건 실패\n`);
if (process.env.DUMP) console.log(process.env.DUMP === 'masked' ? md : mdPlain);
process.exit(failures ? 1 : 0);

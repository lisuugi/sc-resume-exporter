/**
 * README 용 데모 스크린샷 생성
 *
 *   test/fixture.js (가공 데이터) 를 모달처럼 꾸며 띄우고
 *   src/exporter.js 를 실행해 패널이 뜬 화면을 찍는다.
 *     → docs/assets/demo.png
 *
 * 실행: npx playwright install chromium && npm run demo
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { HTML } from '../test/fixture.js';

// 실제 사이트의 스타일을 흉내 내지 않는다. 구조만 읽히도록 중립적으로 꾸민다.
const CSS = `
  body{margin:0;font:14px/1.6 "Noto Sans KR","Malgun Gothic",-apple-system,sans-serif;color:#222;background:#eceef1}
  .application > .container{padding:40px;filter:blur(2px);opacity:.5}
  #formPreview{position:fixed;inset:0;background:rgba(15,18,24,.55);display:flex;justify-content:center;padding:36px 0}
  .modal{background:#fff;width:880px;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column}
  .modalBody{max-height:100%;overflow:auto;padding:28px 36px}
  .info span{display:inline-block;font-size:12px;color:#666;background:#f2f3f5;border-radius:999px;padding:2px 10px;margin-right:6px}
  h2{font-size:21px;margin:10px 0 18px}
  h3{font-size:15px;margin:26px 0 10px;padding-bottom:6px;border-bottom:2px solid #222}
  .dl{display:flex;gap:16px;padding:7px 0;border-bottom:1px solid #eee}
  .dt{flex:0 0 130px;margin:0;font-size:13px;color:#666;font-weight:600}
  .dd{margin:0;white-space:pre-line}
  .dd span{display:block}
  .tableWrap{overflow-x:auto;max-width:620px}
  table{border-collapse:collapse;font-size:12px;margin-bottom:10px;white-space:nowrap}
  th,td{border:1px solid #ddd;padding:5px 9px}
  th{background:#f6f7f9}
`;

const src = readFileSync(new URL('../src/exporter.js', import.meta.url), 'utf8');
const out = new URL('../docs/assets/', import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${HTML}</body></html>`);
await page.addScriptTag({ content: src });
// 호스트 div 자체는 크기가 0 이다(패널은 Shadow DOM 안의 position:fixed). 붙었는지만 확인한다.
await page.waitForSelector('#__scre_panel__', { state: 'attached' });
await page.screenshot({ path: fileURLToPath(new URL('demo.png', out)) });
await browser.close();
console.log('docs/assets/demo.png');

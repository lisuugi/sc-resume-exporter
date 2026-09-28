/**
 * 빌드 스크립트
 *
 *   src/exporter.js
 *     → dist/exporter.min.js     (콘솔 붙여넣기용)
 *     → dist/bookmarklet.txt     (javascript: URL)
 *     → index.html 의 북마클릿 링크에 주입
 *
 * 실행: npm run build
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { minify } from 'terser';

const src = readFileSync(new URL('./src/exporter.js', import.meta.url), 'utf8');

const result = await minify(src, {
  compress: { passes: 2 },
  mangle: true,
  format: { comments: false, ascii_only: false }
});

if (result.error) throw result.error;
const min = result.code.trim();

// javascript: URL 로 감싼다.
// 북마클릿은 주소창/즐겨찾기 URL 로 해석되므로 반드시 인코딩해야 한다.
// 인코딩하지 않으면 #, %, & 같은 문자에서 잘린다.
const bookmarklet = 'javascript:' + encodeURIComponent(min);

writeFileSync(new URL('./dist/exporter.min.js', import.meta.url), min + '\n');
writeFileSync(new URL('./dist/bookmarklet.txt', import.meta.url), bookmarklet + '\n');

// index.html 에 주입
const idxUrl = new URL('./index.html', import.meta.url);
let html = readFileSync(idxUrl, 'utf8');

const attr = bookmarklet.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const before = html;
html = html.replace(
  /(<a[^>]*id="bm"[^>]*href=")[^"]*(")/,
  (_m, a, b) => a + attr + b
);
// 콘솔 붙여넣기 폴백에도 같은 코드를 심는다.
html = html.replace(
  /(<textarea[^>]*id="raw"[^>]*>)[\s\S]*?(<\/textarea>)/,
  (_m, a, b) => a + min.replace(/</g, '&lt;').replace(/>/g, '&gt;') + b
);

if (html === before) {
  console.warn('! index.html 주입 지점(#bm / #raw)을 찾지 못했습니다.');
}
writeFileSync(idxUrl, html);

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log('원본        ', kb(src.length));
console.log('minified    ', kb(min.length));
console.log('북마클릿 URL', kb(bookmarklet.length), bookmarklet.length > 60000 ? '(⚠ 일부 브라우저 한계 근접)' : '');

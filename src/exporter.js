/*!
 * Samsung Careers Resume Exporter
 * 삼성 커리어스 지원서 미리보기 → Markdown / 이미지 내보내기
 *
 * https://github.com/OWNER/sc-resume-exporter
 * MIT License
 *
 * 비공식 도구입니다. 삼성전자와 무관합니다.
 * 모든 처리는 사용자의 브라우저 안에서만 일어나며, 외부로 데이터를 전송하지 않습니다.
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var PANEL_ID = '__scre_panel__';
  var H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

  /* ===================================================================
   * 0. 진입점 — 이미 떠 있으면 재실행하지 않음
   * =================================================================*/
  if (document.getElementById(PANEL_ID)) {
    document.getElementById(PANEL_ID).__scre.focus();
    return;
  }

  /* ===================================================================
   * 1. DOM 탐색
   *    모달 뒤의 편집 폼에도 같은 클래스명이 존재하므로
   *    반드시 #formPreview 하위로 스코프를 좁힌다.
   * =================================================================*/
  function findModal() {
    var wrap = document.getElementById('formPreview');
    if (!wrap) return null;
    if (getComputedStyle(wrap).display === 'none') return null;
    var modal = wrap.querySelector('.modal');
    var body = wrap.querySelector('.modalBody');
    if (!modal || !body) return null;
    var root = body.querySelector('.container') || body;
    if (!root.textContent.trim()) return null;
    return { wrap: wrap, modal: modal, body: body, root: root };
  }

  function visible(el) {
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  /* ===================================================================
   * 2. 텍스트 추출
   *
   *  - innerText 를 쓴다: 에세이의 문단 줄바꿈(\n)이 보존되어야 한다.
   *  - 공백 정규화는 [ \t]+ 만 대상으로 한다. \s+ 를 쓰면 \n 까지
   *    사라져 에세이가 한 줄로 뭉개진다. (표 셀은 반대 정책 — 5장 참고)
   *  - 다중값 필드(1·2·3지망, "국내 + 상세주소" 등)는 하나의 .dd 안에
   *    여러 노드로 들어 있고 구분자가 렌더링되지 않는다. 직계 자식 노드를
   *    개별로 읽어 ' | ' 로 조인해 순서와 경계를 보존한다.
   * =================================================================*/
  function normalizeInline(s) {
    return s.trim().replace(/[ \t]+/g, ' ');
  }

  function readValue(el) {
    var raw = el.innerText || '';
    // 여러 줄(에세이·경력 상세)은 다중값 조인 대상이 아니다. 먼저 걸러낸다.
    if (raw.indexOf('\n') !== -1) {
      return raw
        .split('\n')
        .map(function (l) { return normalizeInline(l); })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    var kids = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      var t = (el.childNodes[i].textContent || '').trim();
      if (t) kids.push(t);
    }
    if (kids.length > 1) return kids.join(' | ');
    return normalizeInline(raw);
  }

  function readLabel(el) {
    return normalizeInline(el.innerText || '');
  }

  /* ===================================================================
   * 3. 문서 모델
   *
   *  문자열을 바로 만들지 않고 중간 모델을 세운다. 지망 필드를 표로
   *  재구성하거나, 표에서 상수 열을 뽑아내는 변환이 문자열 치환보다
   *  모델 위에서 훨씬 안전하기 때문이다.
   *
   *  doc = {
   *    breadcrumb: [문자열],
   *    title: 문자열,
   *    sections: [ { title, blocks: [ block ] } ]
   *  }
   *  block =
   *    | { type:'field', label, value }        한 줄 값
   *    | { type:'longfield', label, value }    여러 줄 값(에세이 등)
   *    | { type:'heading', text }              .dl 바깥의 소제목
   *    | { type:'table', rows:[[셀]] }         첫 행이 헤더
   *    | { type:'text', value }                말단 텍스트
   * =================================================================*/
  function buildModel(root) {
    var doc = { breadcrumb: [], title: '', sections: [] };
    var current = null;

    function section() {
      if (!current) {
        current = { title: '', blocks: [] };
        doc.sections.push(current);
      }
      return current;
    }

    function pushTable(t) {
      var rows = [];
      var trs = t.querySelectorAll('tr');
      for (var i = 0; i < trs.length; i++) {
        if (!visible(trs[i])) continue;
        var cells = [];
        var kids = trs[i].children;
        for (var j = 0; j < kids.length; j++) {
          // 표 셀은 줄바꿈이 GFM 표를 깨뜨리므로 여기서만 \s+ 로 납작하게 만든다.
          cells.push((kids[j].innerText || '').trim().replace(/\s+/g, ' '));
        }
        if (cells.length) rows.push(cells);
      }
      if (rows.length) section().blocks.push({ type: 'table', rows: rows });
    }

    function walk(el) {
      var kids = el.children;
      for (var i = 0; i < kids.length; i++) {
        var ch = kids[i];
        if (!visible(ch) || !ch.textContent.trim()) continue;

        // --- 분기 순서가 곧 규칙이다. 구체적인 것부터 일반적인 것 순.
        if (ch.matches('h2')) {
          doc.title = readLabel(ch);
        } else if (ch.matches('h3')) {
          current = { title: readLabel(ch), blocks: [] };
          doc.sections.push(current);
        } else if (ch.matches('p.info')) {
          var parts = [];
          for (var n = 0; n < ch.childNodes.length; n++) {
            var t = (ch.childNodes[n].textContent || '').trim();
            if (t) parts.push(t);
          }
          doc.breadcrumb = parts;
        } else if (ch.matches('.dl')) {
          // .dl 은 h4.dt 를 자식으로 갖는다. 아래 heading 분기보다 반드시 먼저
          // 처리해야 필드명이 소제목으로 오분류되지 않는다.
          var dt = ch.querySelector('.dt');
          var dd = ch.querySelector('.dd');
          if (dt) {
            var label = readLabel(dt);
            var value = dd ? readValue(dd) : '';
            if (value.indexOf('\n') !== -1) {
              section().blocks.push({ type: 'longfield', label: label, value: value });
            } else {
              // 값이 없어도 필드의 존재 자체는 보존한다.
              section().blocks.push({ type: 'field', label: label, value: value || '(없음)' });
            }
          }
        } else if (ch.matches('table')) {
          pushTable(ch);
        } else if (ch.matches('h4,h5,strong,.subTitle,.tit') && !ch.closest('.dl')) {
          section().blocks.push({ type: 'heading', text: readLabel(ch) });
        } else if (ch.children.length) {
          walk(ch);
        } else {
          var v = readValue(ch);
          if (v) section().blocks.push({ type: 'text', value: v });
        }
      }
    }

    walk(root);
    doc.sections = doc.sections.filter(function (s) { return s.blocks.length; });
    return doc;
  }

  /* ===================================================================
   * 4. 변환 — 지망 필드를 표로
   *
   *  원본은 "필드별 나열"이지만 의미는 "지망별 묶음"이다.
   *    지원부문:      A | B | C
   *    지원직무:      X | Y | Z     →   지망 | 지원부문 | 지원직무 | …
   *    희망근무지역:  P | Q | R
   *  구성 요소 개수가 모두 같고 2개 이상일 때만 적용한다.
   * =================================================================*/
  var CHOICE_LABELS = ['지원부문', '지원직군', '지원직무', '희망근무지역'];

  function transformChoices(sec) {
    // 값이 비어 있는 지망 필드(예: 미입력된 '지원직군')는 표 구성에서 제외한다.
    // 이것을 포함하면 구성 요소 개수가 어긋나 변환 전체가 무산된다.
    var picked = [];
    sec.blocks.forEach(function (b) {
      if (b.type !== 'field') return;
      if (CHOICE_LABELS.indexOf(b.label) === -1) return;
      if (b.value === '(없음)' || !b.value) return;
      picked.push(b);
    });
    if (picked.length < 2) return;

    var split = picked.map(function (b) {
      return { block: b, parts: b.value.split(' | ').map(function (s) { return s.trim(); }) };
    });
    var counts = split.map(function (s) { return s.parts.length; });
    var n = counts[0];
    if (n < 2) return;
    for (var i = 1; i < counts.length; i++) if (counts[i] !== n) return;

    var header = ['지망'].concat(split.map(function (s) { return s.block.label; }));
    var rows = [header];
    for (var k = 0; k < n; k++) {
      rows.push([String(k + 1)].concat(split.map(function (s) { return s.parts[k]; })));
    }
    var idx = sec.blocks.indexOf(picked[0]);
    sec.blocks = sec.blocks.filter(function (b) { return picked.indexOf(b) === -1; });
    sec.blocks.splice(idx, 0, { type: 'table', rows: rows, note: '지망 순서대로 정리했습니다.' });
  }

  /* ===================================================================
   * 5. 변환 — 표 정리
   *
   *  (a) 모든 데이터 행에서 값이 같은 열은 표에서 빼고 표 위에 한 줄로 적는다.
   *      이수교과목 표는 54행 전부가 동일한 전공명·재수강여부를 반복한다.
   *  (b) '과목유형' 처럼 분류 성격의 열이 있으면 값별로 표를 쪼갠다.
   *  (c) 병합 셀(rowspan/colspan)은 지원하지 않는다. 열 수가 헤더와 다른
   *      행이 있으면 정리를 포기하고 원본 표를 그대로 둔다.
   * =================================================================*/
  var SPLIT_COLUMNS = ['과목유형', '활동구분'];

  function tidyTable(block) {
    var rows = block.rows;
    if (rows.length < 3) return [block];
    var header = rows[0];
    var data = rows.slice(1);
    for (var i = 0; i < data.length; i++) {
      if (data[i].length !== header.length) return [block]; // 병합 셀 의심 → 손대지 않음
    }
    if (data.length < 3) return [block];

    // (a) 상수 열 추출
    var constants = [];
    var keep = [];
    for (var c = 0; c < header.length; c++) {
      var first = data[0][c];
      var same = data.every(function (r) { return r[c] === first; });
      if (same && first) constants.push(header[c] + ': ' + first);
      else keep.push(c);
    }
    if (keep.length < 2) return [block]; // 전부 상수면 정리 의미 없음

    function project(r) { return keep.map(function (c) { return r[c]; }); }

    // (b) 분류 열로 분할 — 단, 그 열이 남아 있고 값이 2종 이상일 때만
    var splitIdx = -1;
    for (var s = 0; s < SPLIT_COLUMNS.length && splitIdx === -1; s++) {
      var hi = header.indexOf(SPLIT_COLUMNS[s]);
      if (hi !== -1 && keep.indexOf(hi) !== -1) {
        var vals = {};
        data.forEach(function (r) { vals[r[hi]] = 1; });
        if (Object.keys(vals).length > 1) splitIdx = hi;
      }
    }

    var note = constants.length ? constants.join(' · ') : '';

    if (splitIdx === -1) {
      var keptHeader = keep.map(function (c) { return header[c]; });
      return [{ type: 'table', rows: [keptHeader].concat(data.map(project)), note: note }];
    }

    // 분할 시에는 분류 열 자체도 제목으로 올라가므로 표에서 제거한다.
    var keep2 = keep.filter(function (c) { return c !== splitIdx; });
    var header2 = keep2.map(function (c) { return header[c]; });
    var order = [];
    var groups = {};
    data.forEach(function (r) {
      var k = r[splitIdx];
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(keep2.map(function (c) { return r[c]; }));
    });

    var out = [];
    if (note) out.push({ type: 'text', value: note });
    order.forEach(function (k) {
      out.push({ type: 'heading', text: k + ' (' + groups[k].length + '과목)', level: 4 });
      out.push({ type: 'table', rows: [header2].concat(groups[k]) });
    });
    return out;
  }

  /* ===================================================================
   * 6. 개인정보 마스킹 (선택)
   *    저장소·커뮤니티에 예시로 올릴 때를 위한 기능.
   * =================================================================*/
  var SENSITIVE_LABELS = ['주소', '휴대폰 번호', '전화 번호', '이메일', '자격번호', '학번'];

  function maskText(s) {
    return String(s)
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '███@███')
      .replace(/(\+?\d{1,3}[-\s]?)?0?1[016-9][-\s]?\d{3,4}[-\s]?\d{4}/g, '███-████-████');
  }

  function maskDoc(doc) {
    doc.sections.forEach(function (sec) {
      sec.blocks.forEach(function (b) {
        if (b.type === 'field' || b.type === 'longfield') {
          if (SENSITIVE_LABELS.indexOf(b.label) !== -1) b.value = '███ (마스킹)';
          else b.value = maskText(b.value);
        } else if (b.type === 'table') {
          var hdr = b.rows[0];
          b.rows = b.rows.map(function (r, ri) {
            if (ri === 0) return r;
            return r.map(function (cell, ci) {
              if (SENSITIVE_LABELS.indexOf(hdr[ci]) !== -1) return '███';
              return maskText(cell);
            });
          });
        } else if (b.type === 'text') {
          b.value = maskText(b.value);
        }
      });
    });
    return doc;
  }

  /* ===================================================================
   * 7. 렌더링 — 모델 → Markdown
   * =================================================================*/
  function esc(s) { return String(s).replace(/\|/g, '\\|'); }

  function renderTable(rows) {
    var out = [];
    var header = rows[0];
    out.push('| ' + header.map(esc).join(' | ') + ' |');
    out.push('|' + header.map(function () { return '---'; }).join('|') + '|');
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i].slice();
      while (r.length < header.length) r.push('');
      out.push('| ' + r.slice(0, header.length).map(esc).join(' | ') + ' |');
    }
    out.push('');
    return out;
  }

  function findField(doc, label) {
    for (var i = 0; i < doc.sections.length; i++) {
      var bs = doc.sections[i].blocks;
      for (var j = 0; j < bs.length; j++) {
        if ((bs[j].type === 'field' || bs[j].type === 'longfield') && bs[j].label === label) {
          return bs[j].value;
        }
      }
    }
    return '';
  }

  function today() {
    var d = new Date();
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function yamlSafe(s) {
    return String(s).replace(/"/g, '\\"');
  }

  function render(doc, opts) {
    var out = [];
    var applicant = findField(doc, '지원자') || '(미상)';

    out.push('---');
    out.push('document_type: 입사 지원서 (Samsung Careers 미리보기 추출본)');
    out.push('recruitment: "' + yamlSafe(doc.title) + '"');
    if (!opts.mask) out.push('applicant: "' + yamlSafe(applicant) + '"');
    out.push('extracted_at: ' + today());
    out.push('source: samsungcareers.com 지원서 미리보기 모달');
    out.push('generated_by: sc-resume-exporter v' + VERSION);
    if (opts.mask) out.push('privacy: 개인정보 마스킹 적용됨');
    out.push('---');
    out.push('');

    if (doc.title) { out.push('# ' + doc.title); out.push(''); }
    if (doc.breadcrumb.length) { out.push('> ' + doc.breadcrumb.join(' | ')); out.push(''); }

    doc.sections.forEach(function (sec, si) {
      // 변환 적용
      transformChoices(sec);
      var blocks = [];
      sec.blocks.forEach(function (b) {
        if (b.type === 'table') blocks = blocks.concat(tidyTable(b));
        else blocks.push(b);
      });

      if (sec.title) { out.push('## ' + (si + 1) + '. ' + sec.title); out.push(''); }

      var pendingList = false;
      blocks.forEach(function (b) {
        if (b.type !== 'field' && pendingList) { out.push(''); pendingList = false; }

        if (b.type === 'field') {
          out.push('- **' + b.label + '**: ' + b.value);
          pendingList = true;
        } else if (b.type === 'longfield') {
          out.push('### ' + b.label);
          out.push('');
          out.push(b.value);
          out.push('');
        } else if (b.type === 'heading') {
          out.push((b.level === 4 ? '#### ' : '### ') + b.text);
          out.push('');
        } else if (b.type === 'table') {
          if (b.note) { out.push(b.note); out.push(''); }
          out = out.concat(renderTable(b.rows));
        } else if (b.type === 'text') {
          out.push(b.value);
          out.push('');
        }
      });
      if (pendingList) out.push('');
    });

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  /* ===================================================================
   * 8. 다운로드
   * =================================================================*/
  function safeName(s) {
    return String(s).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80);
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
  }

  /* ===================================================================
   * 9. 이미지 캡처
   *
   *  모달은 세 겹으로 잘려 있다.
   *    #formPreview  position:fixed        → 페이지 스크롤로 접근 불가
   *    .modalBody    max-height + overflow → 내부 스크롤
   *    .tableWrap    overflow-x            → 성적표 우측 열이 잘림
   *  세 가지를 모두 풀고, 폭을 1600px 로 넓혀야 표가 온전히 들어간다.
   *
   *  페이지를 크게 변형하므로 건드린 요소의 inline style 을 전부 기록해
   *  finally 에서 원상복구한다. 지원서 편집 화면을 망가뜨리면 안 된다.
   * =================================================================*/
  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = H2C_URL;
      s.onload = function () { res(window.html2canvas); };
      s.onerror = function () { rej(new Error('html2canvas 로드 실패 (네트워크 또는 보안 정책 차단)')); };
      document.head.appendChild(s);
    });
  }

  function captureImage(ctx, opts, onProgress) {
    var undo = [];
    function set(el, css) {
      undo.push({ el: el, css: el.style.cssText });
      el.style.cssText += ';' + css;
    }

    var wrap = ctx.wrap, modal = ctx.modal, body = ctx.body;
    var parent = wrap.parentNode;
    var next = wrap.nextSibling;
    var scrollX = window.scrollX, scrollY = window.scrollY;
    var bodyScroll = body.scrollTop;
    var width = opts.width || 1600;

    return loadHtml2Canvas()
      .then(function (h2c) {
        onProgress('레이아웃 해제 중…');

        // 모달을 body 직속으로 꺼내고 배경을 숨긴다.
        document.body.appendChild(wrap);
        var kids = Array.prototype.slice.call(document.body.children);
        kids.forEach(function (c) {
          if (c === wrap || c.matches('script,style,link')) return;
          set(c, 'display:none!important');
        });

        set(document.documentElement, 'overflow:auto!important;height:auto!important');
        set(document.body, 'overflow:visible!important;height:auto!important;min-height:0!important;margin:0!important;background:#fff!important');
        set(wrap, 'position:relative!important;top:0!important;left:0!important;width:100%!important;height:auto!important;max-height:none!important;overflow:visible!important;display:block!important');
        set(modal, 'height:auto!important;max-height:none!important;overflow:visible!important;width:' + width + 'px!important;max-width:none!important;margin:0 auto!important');
        set(body, 'height:auto!important;max-height:none!important;overflow:visible!important;width:auto!important;max-width:none!important');

        // 성적표 가로 클리핑 해제
        var wraps = wrap.querySelectorAll('.tableWrap');
        for (var i = 0; i < wraps.length; i++) {
          set(wraps[i], 'overflow:visible!important;width:auto!important');
        }

        body.scrollTop = 0;
        window.scrollTo(0, 0);

        // 표가 모달 폭 안에 들어왔는지 검증
        var mr = modal.getBoundingClientRect();
        var overflowing = 0;
        var tables = modal.querySelectorAll('table');
        for (var t = 0; t < tables.length; t++) {
          var tr = tables[t].getBoundingClientRect();
          if (tr.width > 0 && tr.right > mr.right + 1) overflowing++;
        }
        if (overflowing) {
          throw new Error('표 ' + overflowing + '개가 여전히 잘립니다. 캡처 폭을 늘려 다시 시도하세요.');
        }

        onProgress('렌더링 중… (내용이 길어 수십 초 걸릴 수 있습니다)');
        return h2c(modal, {
          scale: opts.scale || 1.5,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollY: 0,
          windowWidth: Math.max(window.innerWidth, width + 400),
          windowHeight: modal.scrollHeight + 200,
          logging: false
        });
      })
      .then(function (canvas) {
        onProgress('이미지 생성 중…');
        return new Promise(function (res) {
          canvas.toBlob(function (b) { res({ blob: b, canvas: canvas }); }, 'image/jpeg', 0.92);
        });
      })
      .finally(function () {
        // 원상복구 — 어떤 경로로 끝나든 반드시 실행
        for (var i = undo.length - 1; i >= 0; i--) undo[i].el.style.cssText = undo[i].css;
        if (parent) parent.insertBefore(wrap, next);
        body.scrollTop = bodyScroll;
        window.scrollTo(scrollX, scrollY);
      });
  }

  /* ===================================================================
   * 10. UI — Shadow DOM 으로 격리해 페이지 스타일과 충돌하지 않게 한다.
   * =================================================================*/
  var CSS = [
    ':host{all:initial}',
    '.box{position:fixed;top:16px;right:16px;z-index:2147483647;width:300px;',
    'font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR",sans-serif;',
    'background:#fff;color:#1a1a1a;border:1px solid #d8d8d8;border-radius:12px;',
    'box-shadow:0 8px 32px rgba(0,0,0,.18);overflow:hidden}',
    '.hd{display:flex;align-items:center;justify-content:space-between;',
    'padding:11px 14px;background:#111;color:#fff}',
    '.hd b{font-size:13px;font-weight:600;letter-spacing:-.01em}',
    '.hd button{all:unset;cursor:pointer;font-size:17px;line-height:1;padding:2px 5px;',
    'border-radius:5px;color:#bbb}',
    '.hd button:hover{background:rgba(255,255,255,.14);color:#fff}',
    '.bd{padding:14px}',
    'button.act{all:unset;box-sizing:border-box;display:block;width:100%;text-align:center;',
    'cursor:pointer;padding:10px 12px;border-radius:8px;font-weight:600;font-size:13px;',
    'margin-bottom:8px;border:1px solid transparent;transition:.12s}',
    'button.act.p{background:#0f766e;color:#fff}',
    'button.act.p:hover{background:#0b5c56}',
    'button.act.s{background:#f2f3f5;color:#222;border-color:#e0e1e4}',
    'button.act.s:hover{background:#e8e9ec}',
    'button.act[disabled]{opacity:.45;cursor:not-allowed}',
    '.opt{display:flex;align-items:center;gap:7px;margin:10px 0 12px;color:#444;font-size:12px}',
    '.opt input{margin:0;cursor:pointer}',
    '.opt label{cursor:pointer;user-select:none}',
    '.st{min-height:17px;font-size:12px;color:#666;word-break:keep-all;line-height:1.5}',
    '.st.err{color:#c0392b}',
    '.st.ok{color:#1e7e34}',
    '.ft{border-top:1px solid #eee;padding:9px 14px;font-size:11px;color:#999;line-height:1.5}',
    '.ft a{color:#888}'
  ].join('');

  function buildUI(ctx) {
    var host = document.createElement('div');
    host.id = PANEL_ID;
    var sh = host.attachShadow({ mode: 'open' });
    var st = document.createElement('style');
    st.textContent = CSS;
    sh.appendChild(st);

    var box = document.createElement('div');
    box.className = 'box';
    box.innerHTML =
      '<div class="hd"><b>지원서 내보내기</b><button title="닫기">×</button></div>' +
      '<div class="bd">' +
      '<button class="act p" data-a="md">Markdown 추출</button>' +
      '<button class="act s" data-a="img">전체 이미지 캡처</button>' +
      '<div class="opt"><input type="checkbox" id="mk"><label for="mk">개인정보 마스킹</label></div>' +
      '<div class="st"></div>' +
      '</div>' +
      '<div class="ft">비공식 도구 · 삼성전자와 무관<br>모든 처리는 이 브라우저 안에서만 실행됩니다.</div>';
    sh.appendChild(box);

    var status = box.querySelector('.st');
    var maskBox = box.querySelector('#mk');
    var buttons = box.querySelectorAll('button.act');

    function say(msg, kind) {
      status.textContent = msg || '';
      status.className = 'st' + (kind ? ' ' + kind : '');
    }
    function lock(on) {
      for (var i = 0; i < buttons.length; i++) buttons[i].disabled = on;
    }

    box.querySelector('.hd button').onclick = function () { host.remove(); };

    function baseName() {
      var doc = buildModel(ctx.root);
      var who = findField(doc, '지원자');
      var title = doc.title || '지원서';
      return safeName(title + (who ? '_' + who : ''));
    }

    box.querySelector('[data-a="md"]').onclick = function () {
      try {
        say('추출 중…');
        var doc = buildModel(ctx.root);
        if (maskBox.checked) maskDoc(doc);
        var md = render(doc, { mask: maskBox.checked });
        var n = md.split('\n').length;
        download(new Blob([md], { type: 'text/markdown;charset=utf-8' }), baseName() + '.md');
        say('완료 — ' + md.length.toLocaleString() + '자 / ' + n + '줄 다운로드됨', 'ok');
      } catch (e) {
        say('실패: ' + e.message, 'err');
      }
    };

    box.querySelector('[data-a="img"]').onclick = function () {
      lock(true);
      say('준비 중…');
      captureImage(ctx, {}, say)
        .then(function (r) {
          download(r.blob, baseName() + '.jpg');
          say('완료 — ' + r.canvas.width + '×' + r.canvas.height + 'px, ' +
            Math.round(r.blob.size / 1024).toLocaleString() + 'KB', 'ok');
        })
        .catch(function (e) { say('실패: ' + e.message, 'err'); })
        .finally(function () { lock(false); });
    };

    host.__scre = {
      focus: function () {
        box.style.outline = '3px solid #0f766e';
        setTimeout(function () { box.style.outline = ''; }, 900);
      }
    };

    document.body.appendChild(host);
    return host;
  }

  /* ===================================================================
   * 11. 부트
   * =================================================================*/
  var ctx = findModal();
  if (!ctx) {
    alert(
      '지원서 미리보기를 찾지 못했습니다.\n\n' +
      '삼성 커리어스에 로그인한 뒤 지원서 화면에서\n' +
      '[미리보기] 를 열어 둔 상태에서 실행해 주세요.'
    );
    return;
  }
  buildUI(ctx);
})();

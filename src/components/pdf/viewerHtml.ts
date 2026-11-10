/**
 * The page shown inside the PDF reader's WebView: the PDF drawn page by page (pdf.js) with a
 * transparent text layer on top, so words can be selected like on any web page.
 *
 * The app and this page talk by messages (JSON):
 *   page -> app: ready, page {page,pages}, words {words}, select {text,context}, text {from,pages}, textDone, error
 *   app -> page: window.onRN({t: "chunk"|"open"|"unknown"|"reclassify"|"clear"|"goto"|"zoom"|"night", ...})
 * Everything is plain ES2017 with no backticks, so it can sit inside the string below.
 */

const STYLE = String.raw`
:root { --bg:#14151a; --bar:#1d1f26; --fg:#e8e8ee; --muted:#8b8d99; --accent:#4f9dff; --hl:rgba(79,157,255,0.30); }
html, body { margin:0; height:100%; background:var(--bg); color:var(--fg); overflow:hidden;
  font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
#scroller { position:absolute; top:0; left:0; right:0; bottom:60px; overflow:auto; -webkit-overflow-scrolling:touch; }
#sheet { position:relative; margin:10px auto; background:#fff; box-shadow:0 2px 14px rgba(0,0,0,0.45); }
#sheet.night canvas { filter: invert(0.9) hue-rotate(180deg); }
canvas { display:block; }
#text { position:absolute; left:0; top:0; right:0; bottom:0; overflow:hidden; line-height:1; text-size-adjust:none; -webkit-text-size-adjust:none; }
#text > span { position:absolute; white-space:pre; color:transparent; transform-origin:0 0; cursor:text; }
#text ::selection { background:rgba(0,110,255,0.35); }
.u { background:var(--hl); border-bottom:2px solid var(--accent); border-radius:3px; }
#bar { position:absolute; left:0; right:0; bottom:0; height:60px; background:var(--bar); display:flex; align-items:center; gap:4px; padding:0 8px; box-sizing:border-box; }
.btn { flex:none; width:40px; height:40px; border:0; border-radius:10px; background:transparent; color:var(--fg); font-size:22px; line-height:40px; text-align:center; padding:0; }
.btn:active { background:rgba(255,255,255,0.12); }
.btn[disabled] { opacity:0.3; }
#mid { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
#label { font-size:12px; color:var(--muted); text-align:center; }
#track { position:relative; height:22px; display:flex; align-items:center; touch-action:none; }
#rail { position:absolute; left:0; right:0; height:6px; border-radius:3px; background:rgba(255,255,255,0.14); }
#fill { position:absolute; left:0; height:6px; border-radius:3px; background:var(--accent); width:0; }
#thumb { position:absolute; width:16px; height:16px; margin-left:-8px; border-radius:8px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.5); left:0; }
#msg { position:absolute; left:0; right:0; top:40%; text-align:center; color:var(--muted); padding:0 30px; font-size:15px; }
`;

const SCRIPT = String.raw`
(function () {
  var post = function (m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var pdfjs = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;
  var scroller = document.getElementById("scroller");
  var sheet = document.getElementById("sheet");
  var canvas = document.getElementById("canvas");
  var textEl = document.getElementById("text");
  var msg = document.getElementById("msg");
  var label = document.getElementById("label");
  var fill = document.getElementById("fill");
  var thumb = document.getElementById("thumb");
  var track = document.getElementById("track");
  var prevBtn = document.getElementById("prev");
  var nextBtn = document.getElementById("next");

  var doc = null, pages = 0, pageNo = 1, zoom = 1, token = 0, needText = false;
  var unknown = {}, asked = {}, textDivs = [];
  var chunks = [], expected = 0;
  var WORD = /[\p{L}\p{M}][\p{L}\p{M}'’\-]*/gu;

  var key = function (w) { return w.normalize("NFC").toLowerCase().replace(/ё/g, "е"); };
  var setMsg = function (t) { msg.textContent = t || ""; msg.style.display = t ? "block" : "none"; };

  function setTheme(t) {
    var r = document.documentElement.style;
    if (t.bg) r.setProperty("--bg", t.bg);
    if (t.bar) r.setProperty("--bar", t.bar);
    if (t.fg) r.setProperty("--fg", t.fg);
    if (t.muted) r.setProperty("--muted", t.muted);
    if (t.accent) r.setProperty("--accent", t.accent);
    if (t.hl) r.setProperty("--hl", t.hl);
  }

  function updateBar() {
    label.textContent = pages ? pageNo + " / " + pages : "";
    var f = pages > 1 ? (pageNo - 1) / (pages - 1) : (pages ? 1 : 0);
    var w = track.clientWidth;
    fill.style.width = (f * w) + "px";
    thumb.style.left = (f * w) + "px";
    prevBtn.disabled = pageNo <= 1;
    nextBtn.disabled = pageNo >= pages;
  }

  /* ---------- drawing a page ---------- */
  function render(keepScroll) {
    if (!doc) return;
    var my = ++token;
    var top = keepScroll ? scroller.scrollTop : 0;
    doc.getPage(pageNo).then(function (page) {
      if (my !== token) return;
      var base = page.getViewport({ scale: 1 });
      var avail = scroller.clientWidth - 20;
      var scale = (avail / base.width) * zoom;
      var viewport = page.getViewport({ scale: scale });
      var ratio = Math.min(window.devicePixelRatio || 1, 3);
      var out = ratio;
      while (viewport.width * out * viewport.height * out > 16000000 && out > 1) out -= 0.5;
      canvas.width = Math.floor(viewport.width * out);
      canvas.height = Math.floor(viewport.height * out);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";
      sheet.style.width = Math.floor(viewport.width) + "px";
      sheet.style.height = Math.floor(viewport.height) + "px";
      textEl.innerHTML = "";
      textDivs = [];
      var ctx = canvas.getContext("2d");
      var task = page.render({ canvasContext: ctx, viewport: viewport, transform: out !== 1 ? [out, 0, 0, out, 0, 0] : null });
      task.promise.then(function () { setMsg(""); }, function () {});
      page.getTextContent().then(function (content) {
        if (my !== token) return;
        textEl.style.setProperty("--scale-factor", String(viewport.scale));
        var layer = pdfjs.renderTextLayer({ textContentSource: content, container: textEl, viewport: viewport, textDivs: textDivs });
        layer.promise.then(function () {
          if (my !== token) return;
          for (var i = 0; i < textDivs.length; i++) textDivs[i].setAttribute("data-raw", textDivs[i].textContent);
          highlight();
          announceWords();
        }, function () {});
      });
      scroller.scrollTop = top;
      updateBar();
      post({ type: "page", page: pageNo, pages: pages });
    });
  }

  /* ---------- words you do not know yet ---------- */
  function highlight() {
    for (var i = 0; i < textDivs.length; i++) {
      var div = textDivs[i];
      var raw = div.getAttribute("data-raw");
      if (raw === null || raw === "") continue;
      var html = "", last = 0, m, any = false;
      WORD.lastIndex = 0;
      while ((m = WORD.exec(raw))) {
        if (m[0].length > 1 && unknown[key(m[0])]) {
          html += esc(raw.slice(last, m.index)) + '<span class="u">' + esc(m[0]) + "</span>";
          last = m.index + m[0].length;
          any = true;
        }
      }
      if (any) { div.innerHTML = html + esc(raw.slice(last)); }
      else if (div.children.length) { div.textContent = raw; }
    }
  }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // Asks the app which of this page's words are unknown (each word is only asked once).
  function announceWords(all) {
    var fresh = [], seen = {};
    for (var i = 0; i < textDivs.length; i++) {
      var raw = textDivs[i].getAttribute("data-raw") || "";
      var m; WORD.lastIndex = 0;
      while ((m = WORD.exec(raw))) {
        if (m[0].length < 2) continue;
        var k = key(m[0]);
        if (seen[k]) continue;
        seen[k] = 1;
        if (all || !asked[k]) { asked[k] = 1; fresh.push(k); }
      }
    }
    if (all) fresh = Object.keys(asked);
    if (fresh.length) post({ type: "words", words: fresh, replace: !!all });
  }

  /* ---------- picking text ---------- */
  var selTimer = null;
  function contextFor(node) {
    var el = node && (node.nodeType === 3 ? node.parentNode : node);
    while (el && el.parentNode !== textEl) el = el.parentNode;
    if (!el) return "";
    var idx = textDivs.indexOf(el), out = [];
    for (var i = Math.max(0, idx - 1); i <= Math.min(textDivs.length - 1, idx + 1); i++) out.push(textDivs[i].textContent);
    return out.join(" ").replace(/\s+/g, " ").trim().slice(0, 280);
  }
  function sendSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    var text = sel.toString().replace(/\s+/g, " ").trim();
    if (!text || text.length > 200 || !textEl.contains(sel.anchorNode)) return;
    post({ type: "select", text: text, context: contextFor(sel.anchorNode) });
  }
  document.addEventListener("selectionchange", function () {
    clearTimeout(selTimer);
    selTimer = setTimeout(sendSelection, 500);
  });
  textEl.addEventListener("click", function (e) {
    var sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    var t = e.target;
    if (t && t.className === "u") post({ type: "select", text: t.textContent, context: contextFor(t) });
  });

  /* ---------- moving around ---------- */
  function goto(n, keep) {
    if (!doc) return;
    n = Math.max(1, Math.min(pages, n | 0));
    if (n === pageNo && keep !== "force") return;
    pageNo = n;
    window.getSelection().removeAllRanges();
    render(false);
  }
  prevBtn.onclick = function () { goto(pageNo - 1); };
  nextBtn.onclick = function () { goto(pageNo + 1); };
  document.getElementById("zout").onclick = function () { setZoom(zoom / 1.25); };
  document.getElementById("zin").onclick = function () { setZoom(zoom * 1.25); };
  document.getElementById("night").onclick = function () { sheet.classList.toggle("night"); post({ type: "night", on: sheet.classList.contains("night") }); };
  function setZoom(z) { zoom = Math.max(0.6, Math.min(4, z)); render(true); }

  function fromTrack(e) {
    var rect = track.getBoundingClientRect();
    var f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return Math.round(f * (pages - 1)) + 1;
  }
  var dragging = false;
  track.addEventListener("pointerdown", function (e) { dragging = true; track.setPointerCapture(e.pointerId); preview(fromTrack(e)); });
  track.addEventListener("pointermove", function (e) { if (dragging) preview(fromTrack(e)); });
  track.addEventListener("pointerup", function (e) { if (dragging) { dragging = false; goto(fromTrack(e)); } });
  function preview(n) {
    label.textContent = n + " / " + pages;
    var f = pages > 1 ? (n - 1) / (pages - 1) : 1;
    fill.style.width = (f * track.clientWidth) + "px";
    thumb.style.left = (f * track.clientWidth) + "px";
  }

  // A quick sideways swipe turns the page (only when the page is not zoomed in, and not while picking text).
  var sx = 0, sy = 0, st = 0;
  scroller.addEventListener("touchstart", function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
  scroller.addEventListener("touchend", function (e) {
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    var sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    if (zoom > 1.01 || Date.now() - st > 450 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    goto(pageNo + (dx < 0 ? 1 : -1));
  }, { passive: true });
  window.addEventListener("resize", function () { render(true); updateBar(); });

  /* ---------- reading the text of the whole book (for coverage) ---------- */
  function pageText(content) {
    var out = "", prev = null;
    for (var i = 0; i < content.items.length; i++) {
      var it = content.items[i];
      if (typeof it.str !== "string") continue;
      if (prev && it.str.length && prev.str.length && !/\s$/.test(prev.str) && !/^\s/.test(it.str)) {
        var sameLine = Math.abs(it.transform[5] - prev.transform[5]) < (it.height || 8) * 0.6;
        var gap = it.transform[4] - (prev.transform[4] + prev.width);
        if (!sameLine || gap > (it.height || 8) * 0.15) out += sameLine ? " " : "\n";
      }
      out += it.str;
      if (it.hasEOL) out += "\n";
      if (it.str.length) prev = it;
    }
    return out.replace(/[ \t]+/g, " ").trim();
  }
  function extractAll() {
    var n = 1, batch = [], from = 1;
    function step() {
      if (n > pages) {
        if (batch.length) post({ type: "text", from: from, pages: batch });
        post({ type: "textDone" });
        return;
      }
      doc.getPage(n).then(function (p) { return p.getTextContent(); }).then(function (c) {
        batch.push(pageText(c));
        n++;
        if (batch.length >= 10) { post({ type: "text", from: from, pages: batch }); from = n; batch = []; }
        setTimeout(step, 0);
      }, function () { batch.push(""); n++; setTimeout(step, 0); });
    }
    step();
  }

  /* ---------- the app talking to this page ---------- */
  function openFromChunks() {
    var parts = [], total = 0, i;
    for (i = 0; i < chunks.length; i++) {
      var bin = atob(chunks[i]);
      var arr = new Uint8Array(bin.length);
      for (var j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
      parts.push(arr); total += arr.length;
    }
    chunks = [];
    var data = new Uint8Array(total), off = 0;
    for (i = 0; i < parts.length; i++) { data.set(parts[i], off); off += parts[i].length; }
    pdfjs.getDocument({ data: data }).promise.then(function (d) {
      doc = d; pages = d.numPages;
      pageNo = Math.max(1, Math.min(pages, pageNo));
      setMsg("");
      render(false);
      if (needText) setTimeout(extractAll, 400);
    }, function (err) {
      setMsg("Could not open this PDF.");
      post({ type: "error", message: String(err && err.message || err) });
    });
  }

  window.onRN = function (m) {
    if (m.t === "open") {
      if (m.theme) setTheme(m.theme);
      if (m.night) sheet.classList.add("night");
      pageNo = m.page || 1; needText = !!m.needText; expected = m.chunks; chunks = [];
      setMsg("Opening…");
    } else if (m.t === "chunk") {
      chunks[m.i] = m.d;
      if (chunks.length === expected && chunks.every(function (c) { return typeof c === "string"; })) openFromChunks();
    } else if (m.t === "unknown") {
      if (m.replace) unknown = {};
      for (var i = 0; i < m.keys.length; i++) unknown[m.keys[i]] = 1;
      highlight();
    } else if (m.t === "reclassify") {
      announceWords(true);
    } else if (m.t === "clear") {
      window.getSelection().removeAllRanges();
    } else if (m.t === "goto") {
      goto(m.page, "force");
    } else if (m.t === "theme") {
      setTheme(m.theme);
    }
  };

  window.addEventListener("error", function (e) { post({ type: "error", message: String(e.message) }); });
  try {
    var blob = new Blob([window.__WORKER__], { type: "text/javascript" });
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  } catch (e) { post({ type: "error", message: "worker: " + e.message }); }
  updateBar();
  post({ type: "ready" });
})();
`;

const BODY = `
<div id="scroller"><div id="sheet"><canvas id="canvas"></canvas><div id="text"></div></div><div id="msg">Opening…</div></div>
<div id="bar">
  <button class="btn" id="prev" aria-label="Previous page">&#8249;</button>
  <div id="mid"><div id="label"></div><div id="track"><div id="rail"></div><div id="fill"></div><div id="thumb"></div></div></div>
  <button class="btn" id="next" aria-label="Next page">&#8250;</button>
  <button class="btn" id="zout" aria-label="Zoom out">&#8722;</button>
  <button class="btn" id="zin" aria-label="Zoom in">+</button>
  <button class="btn" id="night" aria-label="Dark pages">&#9680;</button>
</div>`;

/** The whole page as one string, with pdf.js and its worker inside it, so nothing is loaded from disk or the network. */
export function viewerHtml(pdfjsSource: string, workerSource: string): string {
  // "</script" inside a script would end it early.
  const safe = (code: string) => code.replace(/<\/script/gi, "<\\/script");
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">' +
    "<style>" + STYLE + "</style></head><body>" + BODY +
    "<script>window.__WORKER__ = " + safe(JSON.stringify(workerSource)) + ";</script>" +
    "<script>" + safe(pdfjsSource) + "</script>" +
    "<script>" + SCRIPT + "</script></body></html>"
  );
}

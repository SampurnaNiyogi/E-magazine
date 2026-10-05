/* Securing the Northeast — screen-only motion layer. Safe to remove; magazine works without it. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) { document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));

    /* ================= BOOK VIEW (landscape spread + page flip) ================= */
    var book = (function () {
      var MM = 3.7795, active = false, single = false, busy = false, cur = 0, spreads = [];
      var marker = document.createComment('pages'); pages[0].parentNode.insertBefore(marker, pages[0]);
      var after = marker.nextSibling; // first node after the marker (re-read on exit)

      function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
      var stage = el('div', 'book-stage'), scaler = el('div', 'book-scaler'), shift = el('div', 'book-shift'),
          bookEl = el('div', 'book'), spine = el('div', 'book-spine');
      bookEl.appendChild(spine); shift.appendChild(bookEl); scaler.appendChild(shift); stage.appendChild(scaler);

      var chev = function (d) { return '<svg viewBox="0 0 24 24"><path d="' + d + '"/></svg>'; };
      var prevBtn = el('button', 'book-nav prev', chev('M15 4l-8 8 8 8')), nextBtn = el('button', 'book-nav next', chev('M9 4l8 8-8 8'));
      prevBtn.type = nextBtn.type = 'button'; prevBtn.setAttribute('aria-label', 'Previous page'); nextBtn.setAttribute('aria-label', 'Next page');
      var bar = el('div', 'book-bar'), range = el('input'), label = el('span', 'book-label');
      range.type = 'range'; range.min = 0; range.value = 0; range.setAttribute('aria-label', 'Jump to page');
      bar.appendChild(range); bar.appendChild(label);
      document.body.appendChild(stage); document.body.appendChild(prevBtn); document.body.appendChild(nextBtn); document.body.appendChild(bar);

      var pg = function (i) { return i == null ? null : pages[i]; };
      function wantSingle() { return window.innerWidth / window.innerHeight < 1.25; }
      function buildSpreads() {
        var n = pages.length;
        if (single) spreads = pages.map(function (_, i) { return [null, i]; });
        else {
          spreads = [[null, 0]];
          for (var i = 1; i < n; i += 2) spreads.push([i, i + 1 < n ? i + 1 : null]);
        }
        range.max = spreads.length - 1;
      }
      function spreadOf(idx) { for (var i = 0; i < spreads.length; i++) if (spreads[i][0] === idx || spreads[i][1] === idx) return i; return 0; }
      function firstPage(i) { var s = spreads[i]; return s[0] != null ? s[0] : s[1]; }

      function reset(p) {
        p.getAnimations().forEach(function (a) { a.cancel(); });
        p.style.display = 'none'; p.style.left = ''; p.style.zIndex = ''; p.style.transformOrigin = ''; p.style.willChange = '';
        var sh = p.querySelector(':scope > .flip-shade'); if (sh) sh.remove();
      }
      function show(p, side) {              /* settle a page without hiding it first (no flash) */
        p.getAnimations().forEach(function (a) { a.cancel(); });
        p.style.transformOrigin = ''; p.style.willChange = '';
        var sh = p.querySelector(':scope > .flip-shade'); if (sh) sh.remove();
        put(p, side, 2);
      }
      function put(p, side, z) {
        p.style.display = ''; p.style.zIndex = z;
        p.style.left = (!single && side === 'R') ? '210mm' : '0';
      }
      function setShift(i) {
        var s = spreads[i], x = 0;
        if (!single) { if (s[0] == null) x = -105; else if (s[1] == null) x = 105; }
        shift.style.transform = 'translateX(' + x + 'mm)';
        spine.style.opacity = (!single && s[0] != null && s[1] != null) ? 1 : 0;
      }
      function ui(i) {
        var s = spreads[i].filter(function (x) { return x != null; }).map(function (x) { return x + 1; });
        label.textContent = 'Page ' + s.join('\u2013') + ' / ' + pages.length;
        range.value = i; prevBtn.disabled = i === 0; nextBtn.disabled = i === spreads.length - 1;
      }
      function replay(p) {                       /* restart this page's entrance animations (same ones scroll view uses) */
        p._played = true;
        p.classList.remove('in-view'); void p.offsetWidth; p.classList.add('in-view');
        p.querySelectorAll(numSel).forEach(function (n) { delete n.dataset.counted; setTimeout(function () { countUp(n); }, 500); });
      }
      function render(i) {
        var s = spreads[i];
        pages.forEach(function (p, idx) { if (idx !== s[0] && idx !== s[1]) reset(p); });
        if (s[0] != null) show(pages[s[0]], 'L');
        if (s[1] != null) show(pages[s[1]], 'R');
        pages.forEach(function (p, idx) { if (idx !== s[0] && idx !== s[1]) p._played = false; });
        [s[0], s[1]].forEach(function (idx) { if (idx != null && !pages[idx]._played) replay(pages[idx]); });
        setShift(i); ui(i);
      }
      function layout() {
        var w = (single ? 210 : 420) * MM, h = 297 * MM;
        var s = Math.min((window.innerWidth - (single ? 16 : 116)) / w, (window.innerHeight - 48) / h, 2);
        scaler.style.width = (single ? 210 : 420) + 'mm';
        scaler.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
      }

      /* One turn = two halves with matched ease-in / ease-out, so speed is continuous at the edge-on moment.
         Only transform + opacity are animated (compositor-only), no filter / box-shadow repaints. */
      var HALF = 400;
      function shadeOf(p) { var s = el('div', 'flip-shade'); p.appendChild(s); return s; }
      function half(p, from, to, easing, shFrom, shTo) {
        p.style.willChange = 'transform';
        var sh = p.querySelector(':scope > .flip-shade') || shadeOf(p);
        sh.animate([{ opacity: shFrom }, { opacity: shTo }], { duration: HALF, easing: easing, fill: 'forwards' });
        return p.animate([{ transform: 'rotateY(' + from + ')' }, { transform: 'rotateY(' + to + ')' }],
          { duration: HALF, easing: easing, fill: 'forwards' }).finished;
      }
      var pending = null;
      function tgt() { return pending !== null ? pending : cur; }
      async function go(to) {
        if (!active || to < 0 || to >= spreads.length) return;
        if (busy) { pending = to; return; }               /* remember the latest request, play it right after */
        if (to === cur) { range.value = cur; return; }
        var from = cur; cur = to;
        if (reduce || !pages[0].animate) { render(to); return; }
        busy = true; setShift(to); ui(to);
        var c = spreads[from], n = spreads[to];
        try {
          if (to > from) {                                   // turn forward: right page lifts, left page lands
            var Rc = pg(c[1]), Rn = pg(n[1]), Ln = pg(n[0]);
            if (Rn) { replay(Rn); put(Rn, 'R', 1); }
            if (Rc) { Rc.style.transformOrigin = 'left center'; await half(Rc, '0deg', '-90deg', 'ease-in', 0, 0.4); }
            if (Ln) { replay(Ln); put(Ln, 'L', 10); Ln.style.transformOrigin = 'right center'; await half(Ln, '90deg', '0deg', 'ease-out', 0.4, 0); }
          } else {                                           // turn back: left page lifts, right page lands
            var Lc = pg(c[0]), Lp = pg(n[0]), Rp = pg(n[1]);
            if (Lp) { replay(Lp); put(Lp, 'L', 1); }
            if (Lc) { Lc.style.transformOrigin = 'right center'; await half(Lc, '0deg', '90deg', 'ease-in', 0, 0.4); }
            if (Rp) { replay(Rp); put(Rp, 'R', 10); Rp.style.transformOrigin = 'left center'; await half(Rp, '-90deg', '0deg', 'ease-out', 0.4, 0); }
          }
        } catch (e) { /* animation cancelled */ }
        render(to); busy = false;
        if (pending !== null) { var t = pending; pending = null; go(t); }
      }

      function currentPageIdx() {
        for (var i = 0; i < pages.length; i++) if (pages[i].getBoundingClientRect().bottom > window.innerHeight * 0.4) return i;
        return 0;
      }
      function enter() {
        if (active) return;
        var idx = currentPageIdx();
        single = wantSingle(); buildSpreads();
        pages.forEach(function (p) { p.classList.add('in-view'); p.style.display = 'none'; bookEl.appendChild(p); });
        document.documentElement.classList.add('book-mode');
        active = true; busy = false; cur = spreadOf(idx);
        layout(); render(cur); setToggle();
      }
      function exit() {
        if (!active) return;
        var idx = firstPage(cur);
        pages.forEach(function (p) { reset(p); p.style.display = ''; });
        var ref = marker.nextSibling;
        pages.forEach(function (p) { marker.parentNode.insertBefore(p, ref); });
        document.documentElement.classList.remove('book-mode');
        active = false; setToggle();
        pages[idx].scrollIntoView({ block: 'start' });
      }

      /* view toggle (Scroll | Book) */
      var toggle = el('div', 'view-toggle'), bScroll = el('button', 'active', 'Scroll'), bBook = el('button', '', 'Book');
      bScroll.type = bBook.type = 'button'; bBook.title = 'Landscape book view with page flip';
      toggle.appendChild(bScroll); toggle.appendChild(bBook); document.body.appendChild(toggle);
      function setToggle() { bScroll.classList.toggle('active', !active); bBook.classList.toggle('active', active); }
      bScroll.addEventListener('click', exit); bBook.addEventListener('click', enter);

      prevBtn.addEventListener('click', function () { go(tgt() - 1); });
      nextBtn.addEventListener('click', function () { go(tgt() + 1); });
      range.addEventListener('input', function () { go(parseInt(range.value, 10)); });
      document.addEventListener('keydown', function (e) {
        if (!active || e.target === range) return;
        var k = e.key;
        if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); go(tgt() + 1); }
        else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); go(tgt() - 1); }
        else if (k === 'Home') { e.preventDefault(); go(0); }
        else if (k === 'End') { e.preventDefault(); go(spreads.length - 1); }
        else if (k === 'Escape') exit();
      });
      var tx = null;
      stage.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        if (tx === null) return; var dx = e.changedTouches[0].clientX - tx; tx = null;
        if (Math.abs(dx) > 50) go(tgt() + (dx < 0 ? 1 : -1));
      }, { passive: true });
      window.addEventListener('resize', function () {
        if (!active) return;
        layout();
        if (!busy && wantSingle() !== single) { var idx = firstPage(cur); single = !single; buildSpreads(); cur = spreadOf(idx); render(cur); }
      });
      window.addEventListener('beforeprint', exit);

      return {
        active: function () { return active; },
        goToPage: function (idx) { go(spreadOf(idx)); }
      };
    })();

    /* ================= WEB PHOTOS for every image placeholder (Wikimedia Commons) ================= */
    (function () {
      var RULES = [
        ['siliguri', 'Siliguri Corridor'], ['mon district', 'Nagaland forest Indian Army'], ['surrender', 'Assam Rifles soldiers'],
        ['border fencing', 'India Myanmar border Mizoram'], ['counter-drone', 'Indian Army drone'], ['security meeting', 'Imphal Manipur'],
        ['tawang', 'Tawang Arunachal Pradesh'], ['sadbhavana', 'solar panels village India'], ['hospital', 'Dimapur Nagaland'],
        ['school', 'Garo Hills Meghalaya'], ['flood-damaged roads', 'Tripura landslide road'], ['medical camp', 'Mizoram Champhai'],
        ['water purification', 'Arunachal Pradesh village'], ['sela tunnel', 'Sela Pass Arunachal'],
        ['drug awareness', 'Manipur Moreh'], ['tripura university', 'Tripura University Agartala'], ['archer', 'archery India tribal'],
        ['raising day', 'Fort William Kolkata'], ['job fair', 'Guwahati'], ['super 30', 'students India classroom'],
        ['empowerment', 'Kohima Nagaland women'], ['swachh', 'Shillong Meghalaya'], ['football', 'Shillong football'],
        ['marathon', 'Shillong'], ['polo', 'Manipur polo Imphal'], ['jal rahat', 'Assam flood rescue'],
        ['gajraj', 'Tezpur Assam'], ['gurudongmar', 'Gurudongmar Lake Sikkim'], ['army band', 'Shillong Meghalaya'],
        ['development in focus', 'Arunachal Pradesh road bridge']
      ];
      var FALLBACK = { security: 'Arunachal Pradesh mountains', development: 'Northeast India road bridge', regional: 'Northeast India landscape', society: 'Northeast India students', sports: 'Northeast India sports' };
      RULES.push(['job fair','Guwahati Assam city'],['super 30','students India classroom'],['women','Kohima Nagaland'],['integration tour','Aizawl Mizoram'],
        ['skill development','Tirap Arunachal Pradesh'],['half marathon','Shillong Meghalaya'],['boxing','boxing ring'],['wushu','wushu martial arts'],
        ['mountaineering','Sikkim Himalaya mountain'],['quick reaction','North Sikkim Himalaya'],['veterinary','cattle Meghalaya'],
        ['coordination meeting','Shillong Meghalaya'],['bands perform','military band India'],['flood relief','Assam flood'],['cultural exchange','Tezpur Assam']);
      var used = {}, cache = {};
      try { cache = JSON.parse(localStorage.getItem('stn-photos3') || '{}'); } catch (e) {}
      function save() { try { localStorage.setItem('stn-photos3', JSON.stringify(cache)); } catch (e) {} }
      function sectionKey(pg) { var t = (pg.querySelector('.section-label') || pg).textContent.slice(0, 120).toLowerCase();
        return /secur/.test(t) ? 'security' : /develop/.test(t) ? 'development' : /society|youth/.test(t) ? 'society' : /sport/.test(t) ? 'sports' : 'regional'; }
      function queryFor(box) {
        var blk = box.closest('.article-block') || box.closest('.page');
        var cap = box.nextElementSibling && box.nextElementSibling.classList.contains('article-caption') ? box.nextElementSibling.textContent : '';
        var head = (blk.querySelector('h1,h2') || {}).textContent || '';
        var txt = (cap + ' ' + box.textContent + ' ' + head).toLowerCase();
        for (var i = 0; i < RULES.length; i++) if (txt.indexOf(RULES[i][0]) > -1) return RULES[i][1];
        return FALLBACK[sectionKey(box.closest('.page'))];
      }
      function getJSON(u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }); }
      function openverse(q) {
        return getJSON('https://api.openverse.org/v1/images/?page_size=20&mimetype=jpg,jpeg&q=' + encodeURIComponent(q)).then(function (d) {
          return (d.results || []).filter(function (r) { return r.thumbnail; }).map(function (r) { return { u: r.thumbnail, c: 'Photo: ' + (r.creator || r.source || 'Openverse') + ' / Openverse' }; });
        }).catch(function () { return []; });
      }
      function wikimedia(q) {
        return getJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=' +
          encodeURIComponent(q) + '&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=900').then(function (d) {
          return Object.keys((d.query && d.query.pages) || {}).map(function (k) { return d.query.pages[k]; })
            .sort(function (a, b) { return a.index - b.index; }).map(function (p) { return p.imageinfo && p.imageinfo[0]; })
            .filter(function (i) { return i && /jpeg/.test(i.mime) && i.width >= 600 && i.thumburl; })
            .map(function (i) { return { u: i.thumburl, c: 'Photo: Wikimedia Commons' }; });
        }).catch(function () { return []; });
      }
      function find(q) {
        if (cache[q] && cache[q].length) return Promise.resolve(cache[q]);
        return openverse(q).then(function (a) { return a.length >= 6 ? a : wikimedia(q).then(function (b) { return a.concat(b); }); })
          .then(function (list) { if (list.length) { cache[q] = list; save(); } return list; });
      }
      /* built-in illustration so a box is never left blank when no web photo can be loaded */
      var PAL = { security: ['#17301f', '#2f5a3c', '#e9972b'], development: ['#0E3B38', '#2a7d73', '#f3c26b'], society: ['#4A2E1B', '#8a5a36', '#f0b35a'], sports: ['#5E1A12', '#a8402b', '#f6c177'], regional: ['#1D3347', '#3f6585', '#f0b35a'] };
      var artN = 0;
      function art(sec) {
        var p = PAL[sec] || PAL.regional, o = ((artN++) * 37) % 90;
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[2] + '" stop-opacity=".55"/></linearGradient></defs>' +
          '<rect width="600" height="400" fill="url(#g)"/><circle cx="' + (130 + o * 4) + '" cy="115" r="38" fill="' + p[2] + '" opacity=".9"/>' +
          '<path d="M0 270 L' + (70 + o) + ' 190 L' + (150 + o) + ' 250 L' + (250 + o) + ' 150 L360 255 L450 190 L600 270 V400 H0Z" fill="' + p[1] + '" opacity=".75"/>' +
          '<path d="M0 320 L120 255 L' + (210 - o / 2) + ' 310 L330 235 L450 315 L600 260 V400 H0Z" fill="' + p[0] + '" opacity=".9"/></svg>';
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      }
      function fill(box, list, sec) {
        var oc = box.querySelector('.photo-credit'); if (oc) oc.remove();
        var img = new Image(), i = 0, label = (box.textContent || '').trim();
        img.className = 'article-photo'; img.alt = label || 'Photo from the Northeast'; img.referrerPolicy = 'no-referrer';
        function done(credit, isArt) {
          box.classList.add('has-photo', 'web-photo'); if (isArt) box.classList.add('art');
          box.insertBefore(img, box.firstChild);
          var c = document.createElement('span'); c.className = 'photo-credit'; c.textContent = credit; box.appendChild(c);
        }
        function next() {
          while (i < list.length && used[list[i].u]) i++;
          if (i >= list.length) { img.onload = function () { done('Illustration', true); }; img.onerror = null; img.src = art(sec); return; }
          var cur = list[i++]; used[cur.u] = 1;
          img.onload = function () { done(cur.c, false); }; img.onerror = next; img.src = cur.u;
        }
        next();
      }
      var boxes = Array.prototype.filter.call(document.querySelectorAll('.article-image'), function (b) { return !b.classList.contains('has-photo'); });
      var groups = {};
      boxes.forEach(function (b) { var q = queryFor(b); (groups[q] = groups[q] || []).push(b); });
      Object.keys(groups).forEach(function (q) {
        find(q).then(function (urls) {
          groups[q].forEach(function (b) { fill(b, urls, sectionKey(b.closest('.page'))); });
        });
      });
    })();

    /* stagger index (--i) for siblings so cards/rows cascade */
    document.querySelectorAll('.toc-page, .block-stats, .stat-fill .stat-row, .about-grid, .glance-grid, .info-row, .stat-row, .takeaway-grid, .timeline, .divider-stats, .cover-tags')
      .forEach(function (g) {
        if (g.classList.contains('toc-page')) return;
        Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty('--i', i + 1); });
      });
    document.querySelectorAll('.page-inner').forEach(function (p) {
      p.querySelectorAll(':scope > .toc-section').forEach(function (s, i) { s.style.setProperty('--i', i + 1); });
    });

    /* count-up numbers */
    var numSel = '.d-stat-num, .stat-number, .stat-value, .info-num, .s-num';
    function countUp(el) {
      if (el.dataset.counted) return; el.dataset.counted = '1';
      var txt = el.dataset.final || (el.dataset.final = el.textContent.trim());
      var m = txt.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/);
      if (!m) return;
      var raw = m[2], target = parseFloat(raw.replace(/,/g, ''));
      var dec = (raw.split('.')[1] || '').length, comma = raw.indexOf(',') > -1;
      if (reduce || !isFinite(target)) return;
      var start = null, dur = 1400;
      function fmt(v) {
        var s = v.toFixed(dec);
        return comma ? Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : s;
      }
      el.textContent = m[1] + fmt(0) + m[3];
      function step(t) {
        if (start === null) start = t;
        var p = Math.min((t - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = m[1] + fmt(target * e) + m[3];
        if (p < 1) requestAnimationFrame(step); else el.textContent = txt;
      }
      requestAnimationFrame(step);
    }

    /* reveal pages as they scroll into view */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('in-view');
          en.target.querySelectorAll(numSel).forEach(function (n) { setTimeout(function () { countUp(n); }, 500); });
          io.unobserve(en.target);
        });
      }, { threshold: 0.08 });
      pages.forEach(function (p) { io.observe(p); });
    } else {
      pages.forEach(function (p) { p.classList.add('in-view'); });
    }

    /* clickable contents: map printed page number -> page element */
    var byNumber = {};
    pages.forEach(function (p, i) {
      var n = p.querySelector('.page-number');
      byNumber[n ? parseInt(n.textContent, 10) : i + 1] = p;
    });
    document.querySelectorAll('.toc-item').forEach(function (item) {
      var pg = item.querySelector('.toc-page');
      var target = pg && byNumber[parseInt(pg.textContent, 10)];
      if (!target) return;
      item.setAttribute('data-goto', '');
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'link');
      var go = function () { if (book.active()) book.goToPage(pages.indexOf(target)); else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); };
      item.addEventListener('click', go);
      item.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    });

    /* cover tabs -> jump to their section (works in scroll and book view) */
    document.querySelectorAll('.cover-tags [data-target]').forEach(function (t) {
      var go = function () {
        var d = document.querySelector('.section-divider.' + t.getAttribute('data-target'));
        if (!d) return;
        if (book.active()) book.goToPage(pages.indexOf(d));
        else d.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      };
      t.addEventListener('click', go);
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });

    /* progress bar + back-to-top */
    var bar = document.createElement('div'); bar.className = 'read-progress';
    var top = document.createElement('button'); top.className = 'to-top'; top.type = 'button';
    top.setAttribute('aria-label', 'Back to top'); top.innerHTML = '&uarr;';
    document.body.appendChild(bar); document.body.appendChild(top);
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

    var ticking = false;
    function onScroll() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? window.scrollY / h : 0) + ')';
      top.classList.toggle('show', window.scrollY > 600);
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  });
})();
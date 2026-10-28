/* All Clean Group — site script. Loaded with `defer`; no inline scripts anywhere (strict CSP). */
(function () {
  "use strict";

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Language preference (local only, no cookies) ---------- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-set-lang]");
    if (a) store.set("acg-lang", a.getAttribute("data-set-lang"));
  });

  /* ---------- Navigation ---------- */
  function initNav() {
    var nav = document.getElementById("site-nav");
    if (!nav) return;
    var toggle = nav.querySelector(".nav-toggle");
    var menu = document.getElementById("nav-menu");
    var label = toggle.querySelector(".visually-hidden");

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
      nav.classList.toggle("menu-open", open);
      label.textContent = toggle.getAttribute(open ? "data-label-close" : "data-label-open");
    }
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    // Over the carousel the bar is transparent; once the carousel scrolls away it turns solid.
    var hero = document.getElementById("hero");
    if (hero && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        nav.classList.toggle("site-nav--solid", !entries[0].isIntersecting);
      }, { rootMargin: "-72px 0px 0px 0px" }).observe(hero);
    }
  }

  /* ---------- Hero carousel (mechanics of the reference design) ---------- */
  function initCarousel() {
    var hero = document.getElementById("hero");
    if (!hero) return;
    var cover = hero.querySelector(".cover");
    var gsap = window.gsap;
    var cards = Array.prototype.slice.call(hero.querySelectorAll(".card"));
    var n = cards.length;
    if (!gsap || n < 2) {
      if (cover) cover.remove();
      return;
    }

    var contents = cards.map(function (_, i) { return document.getElementById("card-content-" + i); });
    var items = cards.map(function (_, i) { return document.getElementById("slide-item-" + i); });
    var panels = { even: document.getElementById("details-even"), odd: document.getElementById("details-odd") };
    var pagination = document.getElementById("pagination");
    var progress = hero.querySelector(".progress-sub-foreground");
    var indicator = document.getElementById("indicator");
    var status = document.getElementById("hero-status");
    var playBtn = hero.querySelector(".arrow-play");
    var interval = parseFloat(hero.getAttribute("data-autoplay")) || 6;
    var nav = document.getElementById("site-nav");

    var order = cards.map(function (_, i) { return i; });
    var detailsEven = true;
    var busy = false;
    var userPaused = reduceMotion.matches; // never auto-advance when the user asked for less motion
    var holds = 0; // focus / visibility holds that pause autoplay temporarily
    var loopTl = null;
    var ease = "sine.inOut";
    var NUM = 50;
    var g = {};

    function T(v) { return reduceMotion.matches ? 0 : v; }
    function activePanel() { return detailsEven ? panels.even : panels.odd; }
    function inactivePanel() { return detailsEven ? panels.odd : panels.even; }

    function geometry() {
      var w = hero.clientWidth;
      var h = hero.clientHeight;
      var mobile = w < 768;
      var gutter = mobile ? 16 : Math.min(36, Math.max(16, w * 0.04));
      g = { w: w, h: h, mobile: mobile };
      if (mobile) {
        g.cardW = 96; g.cardH = 132; g.gap = 12; g.contentOffset = 70;
        g.offsetTop = h - g.cardH - 84;
        g.offsetLeft = gutter;
        g.pagTop = g.offsetTop + g.cardH + 18;
        g.arrowsW = 3 * 54;
      } else {
        g.cardW = 200; g.cardH = 300; g.gap = 40; g.contentOffset = 100;
        g.offsetTop = h - 430;
        g.offsetLeft = Math.max(w - 830, Math.min(600, w * 0.58));
        g.pagTop = g.offsetTop + 330;
        g.arrowsW = 3 * 66;
      }
      g.progressW = Math.max(40, Math.min(500, w - g.offsetLeft - g.arrowsW - NUM - 32 - gutter));
      hero.style.setProperty("--progress-w", g.progressW + "px");
    }
    function cardX(idx) { return g.offsetLeft + idx * (g.cardW + g.gap); }
    function progressWidth(active) { return g.progressW * ((active + 1) / n); }

    function resetPanelParts(panel) {
      gsap.set(panel.querySelector(".text"), { y: 100 });
      gsap.set(panel.querySelector(".title-1"), { y: 100 });
      gsap.set(panel.querySelector(".title-2"), { y: 100 });
      gsap.set(panel.querySelector(".desc"), { y: 50 });
      gsap.set(panel.querySelector(".cta"), { y: 60 });
      gsap.set(panel.querySelector(".details-more"), { y: 60 });
    }

    function fillPanel(panel, i) {
      var d = cards[i].dataset;
      panel.querySelector('[data-field="category"]').textContent = d.category;
      panel.querySelector('[data-field="title1"]').textContent = d.title1;
      panel.querySelector('[data-field="title2"]').textContent = d.title2;
      panel.querySelector('[data-field="desc"]').textContent = d.desc;
      panel.querySelector('[data-field="quote"]').setAttribute("href", d.quote);
      panel.querySelector('[data-field="more"]').setAttribute("href", d.more);
    }

    function setA11y(active) {
      cards.forEach(function (c, i) {
        if (i === active) c.removeAttribute("aria-hidden");
        else c.setAttribute("aria-hidden", "true");
      });
      var on = activePanel();
      var off = inactivePanel();
      on.removeAttribute("aria-hidden");
      on.inert = false;
      // Keep keyboard focus if it was inside the panel that is about to hide.
      var focused = document.activeElement;
      var refocus = null;
      if (focused && off.contains(focused)) {
        var field = focused.getAttribute("data-field");
        refocus = field ? on.querySelector('[data-field="' + field + '"]') : on.querySelector(".bookmark");
      }
      off.setAttribute("aria-hidden", "true");
      off.inert = true;
      if (refocus) refocus.focus({ preventScroll: true });
    }

    function announce(active) {
      if (status) status.textContent = cards[active].getAttribute("aria-label");
    }

    // Lay everything out for the current order without animating (start, resize, reduced motion).
    function placeAll() {
      var active = order[0];
      var rest = order.slice(1);
      gsap.set(cards[active], { x: 0, y: 0, width: g.w, height: g.h, borderRadius: 0, zIndex: 20, scale: 1 });
      gsap.set(contents[active], { x: 0, y: 0, opacity: 0 });
      gsap.set(items[active], { x: 0 });
      rest.forEach(function (i, idx) {
        gsap.set(cards[i], { x: cardX(idx), y: g.offsetTop, width: g.cardW, height: g.cardH, zIndex: 30, borderRadius: 10, scale: 1 });
        gsap.set(contents[i], { x: cardX(idx), y: g.offsetTop + g.cardH - g.contentOffset, zIndex: 40, opacity: 1 });
        gsap.set(items[i], { x: (idx + 1) * NUM });
      });
      gsap.set(progress, { width: progressWidth(active) });
      gsap.set(pagination, { x: g.offsetLeft, y: g.pagTop, opacity: 1 });
      gsap.set(activePanel(), { opacity: 1, x: 0, zIndex: 22 });
      gsap.set(activePanel().querySelectorAll(".text, .title-1, .title-2, .desc, .cta, .details-more"), { y: 0 });
      gsap.set(inactivePanel(), { opacity: 0, zIndex: 12 });
      resetPanelParts(inactivePanel());
    }

    function revealPanel(panel, resolve) {
      gsap.set(panel, { zIndex: 22 });
      gsap.to(panel, { opacity: 1, delay: T(0.4), duration: T(0.5), ease: ease });
      gsap.to(panel.querySelector(".text"), { y: 0, delay: T(0.1), duration: T(0.7), ease: ease });
      gsap.to(panel.querySelector(".title-1"), { y: 0, delay: T(0.15), duration: T(0.7), ease: ease });
      gsap.to(panel.querySelector(".title-2"), { y: 0, delay: T(0.15), duration: T(0.7), ease: ease });
      gsap.to(panel.querySelector(".desc"), { y: 0, delay: T(0.3), duration: T(0.4), ease: ease });
      gsap.to(panel.querySelector(".details-more"), { y: 0, delay: T(0.38), duration: T(0.4), ease: ease });
      gsap.to(panel.querySelector(".cta"), { y: 0, delay: T(0.35), duration: T(0.4), ease: ease, onComplete: resolve });
    }

    function settleInactive() {
      var off = inactivePanel();
      gsap.set(off, { opacity: 0 });
      resetPanelParts(off);
    }

    // One step forward: the first small card grows to full screen; the old slide goes to the end of the row.
    function stepNext() {
      return new Promise(function (resolve) {
        order.push(order.shift());
        detailsEven = !detailsEven;
        var active = order[0];
        var rest = order.slice(1);
        var prv = rest[rest.length - 1];
        var on = activePanel();
        fillPanel(on, active);
        setA11y(active);
        gsap.set(inactivePanel(), { zIndex: 12 });

        var pending = 2;
        function done() { if (--pending === 0) resolve(); }
        revealPanel(on, done);

        gsap.set(cards[prv], { zIndex: 10 });
        gsap.set(cards[active], { zIndex: 20 });
        gsap.to(cards[prv], { scale: 1.5, duration: T(0.5), ease: ease });
        gsap.to(contents[active], { y: g.offsetTop + g.cardH - 10, opacity: 0, duration: T(0.3), ease: ease });
        gsap.to(items[active], { x: 0, duration: T(0.5), ease: ease });
        gsap.to(items[prv], { x: -NUM, duration: T(0.5), ease: ease });
        gsap.to(progress, { width: progressWidth(active), duration: T(0.5), ease: ease });
        gsap.to(cards[active], {
          x: 0, y: 0, width: g.w, height: g.h, borderRadius: 0, duration: T(0.5), ease: ease,
          onComplete: function () {
            var xNew = cardX(rest.length - 1);
            gsap.set(cards[prv], { x: xNew, y: g.offsetTop, width: g.cardW, height: g.cardH, zIndex: 30, borderRadius: 10, scale: 1 });
            gsap.set(contents[prv], { x: xNew, y: g.offsetTop + g.cardH - g.contentOffset, opacity: 1, zIndex: 40 });
            gsap.set(items[prv], { x: rest.length * NUM });
            settleInactive();
            done();
          },
        });
        rest.forEach(function (i, idx) {
          if (i === prv) return;
          var xNew = cardX(idx);
          gsap.set(cards[i], { zIndex: 30 });
          gsap.to(cards[i], { x: xNew, y: g.offsetTop, width: g.cardW, height: g.cardH, duration: T(0.5), ease: ease, delay: T(0.1 * (idx + 1)) });
          gsap.to(contents[i], { x: xNew, y: g.offsetTop + g.cardH - g.contentOffset, opacity: 1, zIndex: 40, duration: T(0.5), ease: ease, delay: T(0.1 * (idx + 1)) });
          gsap.to(items[i], { x: (idx + 1) * NUM, duration: T(0.5), ease: ease });
        });
      });
    }

    // One step back: the last card of the row grows to full screen; the old slide becomes the first small card.
    function stepPrev() {
      return new Promise(function (resolve) {
        order.unshift(order.pop());
        detailsEven = !detailsEven;
        var active = order[0];
        var rest = order.slice(1);
        var old = rest[0];
        var on = activePanel();
        fillPanel(on, active);
        setA11y(active);
        gsap.set(inactivePanel(), { zIndex: 12 });

        var pending = 2;
        function done() { if (--pending === 0) resolve(); }
        revealPanel(on, done);

        gsap.set(cards[old], { zIndex: 10 });
        gsap.set(cards[active], { zIndex: 20 });
        gsap.to(cards[old], { scale: 1.5, duration: T(0.5), ease: ease });
        gsap.to(contents[active], { opacity: 0, duration: T(0.3), ease: ease });
        gsap.fromTo(items[active], { x: -NUM }, { x: 0, duration: T(0.5), ease: ease });
        gsap.to(items[old], { x: NUM, duration: T(0.5), ease: ease });
        gsap.to(progress, { width: progressWidth(active), duration: T(0.5), ease: ease });
        gsap.to(cards[active], {
          x: 0, y: 0, width: g.w, height: g.h, borderRadius: 0, duration: T(0.5), ease: ease,
          onComplete: function () {
            gsap.set(cards[old], { x: cardX(0), y: g.offsetTop, width: g.cardW, height: g.cardH, zIndex: 30, borderRadius: 10, scale: 1 });
            gsap.set(contents[old], { x: cardX(0), y: g.offsetTop + g.cardH - g.contentOffset, zIndex: 40 });
            gsap.to(contents[old], { opacity: 1, duration: T(0.3), ease: ease });
            settleInactive();
            done();
          },
        });
        rest.forEach(function (i, idx) {
          if (i === old) return;
          var xNew = cardX(idx);
          gsap.set(cards[i], { zIndex: 30 });
          gsap.to(cards[i], { x: xNew, y: g.offsetTop, width: g.cardW, height: g.cardH, duration: T(0.5), ease: ease, delay: T(0.05 * (idx + 1)) });
          gsap.to(contents[i], { x: xNew, y: g.offsetTop + g.cardH - g.contentOffset, opacity: 1, zIndex: 40, duration: T(0.5), ease: ease, delay: T(0.05 * (idx + 1)) });
          gsap.to(items[i], { x: (idx + 1) * NUM, duration: T(0.5), ease: ease });
        });
      });
    }

    /* Autoplay: the top indicator fills, then the next slide comes in (as in the reference). */
    function isPaused() { return userPaused || holds > 0; }
    function stopLoop() {
      if (loopTl) { loopTl.kill(); loopTl = null; }
      gsap.set(indicator, { xPercent: -100 });
    }
    function startLoop() {
      stopLoop();
      if (isPaused() || reduceMotion.matches) return;
      loopTl = gsap.timeline({
        onComplete: function () {
          loopTl = null;
          run(stepNext, false).then(function () { if (!isPaused()) startLoop(); });
        },
      });
      loopTl
        .set(indicator, { xPercent: -100 })
        .to(indicator, { xPercent: 0, duration: interval, ease: "none" })
        .to(indicator, { xPercent: 100, duration: 0.8, delay: 0.3, ease: ease });
    }
    function hold() { holds++; if (loopTl) loopTl.pause(); }
    function release() {
      holds = Math.max(0, holds - 1);
      if (isPaused()) return;
      if (loopTl) loopTl.resume(); else startLoop();
    }

    function run(fn, fromUser) {
      if (busy) return Promise.resolve();
      busy = true;
      return fn().then(function () {
        busy = false;
        if (fromUser) announce(order[0]);
      });
    }
    function userStep(fn) {
      if (busy) return;
      stopLoop();
      run(fn, true).then(function () { if (!isPaused()) startLoop(); });
    }
    function goTo(index) {
      var k = order.indexOf(index);
      if (k <= 0 || busy) return;
      stopLoop();
      gsap.globalTimeline.timeScale(k > 1 ? 2.5 : 1);
      var chain = Promise.resolve();
      for (var s = 0; s < k; s++) chain = chain.then(function () { return run(stepNext, false); });
      chain.then(function () {
        gsap.globalTimeline.timeScale(1);
        announce(order[0]);
        if (!isPaused()) startLoop();
      });
    }

    function setUserPaused(p) {
      userPaused = p;
      playBtn.setAttribute("aria-pressed", String(p));
      playBtn.setAttribute("aria-label", playBtn.getAttribute(p ? "data-label-play" : "data-label-pause"));
      if (p) stopLoop(); else startLoop();
    }

    // Controls
    hero.querySelector(".arrow-right").addEventListener("click", function () { userStep(stepNext); });
    hero.querySelector(".arrow-left").addEventListener("click", function () { userStep(stepPrev); });
    playBtn.addEventListener("click", function () { setUserPaused(!userPaused); });
    cards.forEach(function (c, i) {
      c.addEventListener("click", function () { if (order[0] !== i) goTo(i); });
    });

    // Keyboard: arrows move the slideshow while it is on screen (never while typing in a field).
    var heroVisible = true;
    document.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var el = document.activeElement;
      var inHero = el && hero.contains(el);
      if (!inHero && el && el.closest && el.closest("input, textarea, select, [contenteditable], .nav-menu.is-open")) return;
      if (!inHero && !heroVisible) return;
      e.preventDefault();
      userStep(e.key === "ArrowRight" ? stepNext : stepPrev);
    });

    // Touch / pen swipe
    var sx = 0, sy = 0, tracking = false;
    hero.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      tracking = true; sx = e.clientX; sy = e.clientY;
    });
    hero.addEventListener("pointerup", function (e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) userStep(dx < 0 ? stepNext : stepPrev);
    });
    hero.addEventListener("pointercancel", function () { tracking = false; });

    // Pause while the user is interacting inside the slideshow, while it is off screen or the tab is hidden.
    hero.addEventListener("focusin", hold);
    hero.addEventListener("focusout", release);
    if ("IntersectionObserver" in window) {
      var wasHeld = false;
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].intersectionRatio >= 0.4;
        if (!heroVisible && !wasHeld) { wasHeld = true; hold(); }
        else if (heroVisible && wasHeld) { wasHeld = false; release(); }
      }, { threshold: [0, 0.4, 1] }).observe(hero);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) hold(); else release();
    });

    // Reduced motion can change while the page is open.
    var onMotionChange = function () {
      if (reduceMotion.matches) setUserPaused(true);
    };
    if (reduceMotion.addEventListener) reduceMotion.addEventListener("change", onMotionChange);

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var all = cards.concat(contents, items, [progress, pagination, panels.even, panels.odd]);
        gsap.killTweensOf(all);
        busy = false;
        geometry();
        placeAll();
        if (!isPaused()) startLoop();
      }, 150);
    });

    // ---- Start: lay out, then the reference intro (cover sweep, cards slide in, HUD rises) ----
    // Let GSAP read every element's current transform in one pass before any write,
    // so the browser computes styles once instead of once per element.
    cards.concat(contents, items, [pagination, panels.even, panels.odd, indicator]).forEach(function (el) {
      gsap.getProperty(el, "x");
    });
    geometry();
    placeAll();
    pagination.hidden = false;
    hero.classList.add("is-ready");
    gsap.set(indicator, { xPercent: -100 });
    if (playBtn) {
      playBtn.setAttribute("aria-pressed", String(userPaused));
      playBtn.setAttribute("aria-label", playBtn.getAttribute(userPaused ? "data-label-play" : "data-label-pause"));
    }

    if (reduceMotion.matches) {
      if (cover) cover.remove();
      return;
    }
    if (cover) cover.style.animation = "none";
    var startDelay = 0.4;
    var rest = order.slice(1);
    rest.forEach(function (i, idx) {
      gsap.fromTo(cards[i], { x: cardX(idx) + 400 }, { x: cardX(idx), ease: ease, delay: startDelay + 0.05 * idx, duration: 0.5 });
      gsap.fromTo(contents[i], { x: cardX(idx) + 400 }, { x: cardX(idx), ease: ease, delay: startDelay + 0.05 * idx, duration: 0.5 });
    });
    gsap.fromTo(pagination, { y: g.pagTop + 200, opacity: 0 }, { y: g.pagTop, opacity: 1, ease: ease, delay: startDelay, duration: 0.5 });
    if (nav) gsap.fromTo(nav, { y: -120, opacity: 0 }, { y: 0, opacity: 1, ease: ease, delay: startDelay, duration: 0.5, clearProps: "transform,opacity" });
    // Slides in from the left like the reference, but stays opaque so the heading counts as painted at once (LCP).
    gsap.fromTo(activePanel(), { x: -200 }, { x: 0, ease: ease, delay: startDelay, duration: 0.5 });
    gsap.to(cover, {
      x: g.w + 400, delay: 0.3, duration: 0.6, ease: ease,
      onComplete: function () {
        cover.remove();
        setTimeout(startLoop, 500);
      },
    });
  }

  /* ---------- Quote form ---------- */
  function initForm() {
    var form = document.getElementById("quote-form");
    if (!form) return;
    var lang = document.body.getAttribute("data-lang") || "en";
    var msgs = {};
    var tpl = document.getElementById("form-messages");
    if (tpl) {
      Array.prototype.forEach.call(tpl.content.querySelectorAll("[data-key]"), function (el) {
        msgs[el.getAttribute("data-key")] = el.textContent;
      });
    }
    var summary = document.getElementById("form-errors");
    var statusEl = document.getElementById("form-status");
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitText = submitBtn.textContent;
    var sitekey = form.getAttribute("data-sitekey");
    var widgetId = null;
    var token = "";

    // Pre-select the service chosen on the slide ("Get a quote" → ?service=…)
    var wanted = new URLSearchParams(window.location.search).get("service");
    var select = form.elements.service;
    if (wanted && select.querySelector('option[value="' + CSS.escape(wanted) + '"]')) select.value = wanted;

    // Cloudflare Turnstile is loaded only when the form is about to be used.
    var turnstileRequested = false;
    function loadTurnstile() {
      if (turnstileRequested || !sitekey) return;
      turnstileRequested = true;
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = function () {
        if (!window.turnstile) return;
        widgetId = window.turnstile.render("#turnstile", {
          sitekey: sitekey,
          language: lang,
          theme: "light",
          action: "quote",
          callback: function (t) { token = t; clearError("captcha"); },
          "expired-callback": function () { token = ""; },
          "error-callback": function () { token = ""; },
        });
      };
      document.head.appendChild(s);
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { loadTurnstile(); io.disconnect(); }
      }, { rootMargin: "400px 0px" });
      io.observe(form);
    } else {
      loadTurnstile();
    }
    form.addEventListener("focusin", loadTurnstile);

    var fieldIds = { name: "f-name", phone: "f-phone", email: "f-email", service: "f-service", zip: "f-zip", message: "f-message", privacy: "f-privacy" };

    function digits(v) { return String(v || "").replace(/\D/g, ""); }
    function validate(d) {
      var e = {};
      var name = d.name.trim();
      if (name.length < 2 || name.length > 100) e.name = "name";
      var p = digits(d.phone);
      if (p.length === 11 && p.charAt(0) === "1") p = p.slice(1);
      if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(p)) e.phone = "phone";
      if (d.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = "email";
      var options = Array.prototype.map.call(select.options, function (o) { return o.value; }).filter(Boolean);
      if (options.indexOf(d.service) === -1) e.service = "service";
      var z = parseInt(d.zip, 10);
      if (!/^\d{5}$/.test(d.zip) || z < 32004 || z > 34997) e.zip = "zip";
      if (d.message.length > 2000) e.message = "message";
      if (!d.privacy) e.privacy = "privacy";
      if (sitekey && !d.turnstile) e.captcha = "captcha";
      return e;
    }

    function clearError(key) {
      var err = document.getElementById("err-" + key);
      if (err) { err.hidden = true; err.textContent = ""; }
      var input = fieldIds[key] && document.getElementById(fieldIds[key]);
      if (input) input.removeAttribute("aria-invalid");
    }
    function showErrors(errors) {
      var keys = Object.keys(errors);
      ["name", "phone", "email", "service", "zip", "message", "privacy", "captcha"].forEach(clearError);
      if (!keys.length) { summary.hidden = true; return; }
      keys.forEach(function (k) {
        var err = document.getElementById("err-" + k);
        if (err) { err.textContent = msgs[errors[k]] || msgs.server; err.hidden = false; }
        var input = fieldIds[k] && document.getElementById(fieldIds[k]);
        if (input) input.setAttribute("aria-invalid", "true");
      });
      summary.textContent = msgs.summary;
      summary.hidden = false;
      var first = keys.map(function (k) { return fieldIds[k] && document.getElementById(fieldIds[k]); }).filter(Boolean)[0];
      (first || summary).focus();
    }

    // Clear an error while the user corrects the field. Not on "change": that fires on blur, and the
    // layout shift it causes would make the click that triggered the blur miss its target.
    Object.keys(fieldIds).forEach(function (k) {
      var el = document.getElementById(fieldIds[k]);
      var evt = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(evt, function () { if (el.getAttribute("aria-invalid")) clearError(k); });
    });

    function collect() {
      var smsBox = form.elements.sms_consent;
      return {
        name: form.elements.name.value,
        phone: form.elements.phone.value,
        email: form.elements.email.value,
        service: select.value,
        zip: form.elements.zip.value.trim(),
        message: form.elements.message.value,
        privacy: form.elements.privacy.checked,
        sms_consent: smsBox.checked,
        sms_text: smsBox.checked ? form.querySelector('label[for="f-sms"]').textContent.replace(/\s+/g, " ").trim() : "",
        website: form.elements.website.value,
        lang: lang,
        page: window.location.pathname,
        turnstile: token,
      };
    }

    function setSending(on) {
      submitBtn.disabled = on;
      submitBtn.textContent = on ? submitBtn.getAttribute("data-sending") : submitText;
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      statusEl.textContent = "";
      statusEl.classList.remove("is-success");
      var data = collect();
      var errors = validate(data);
      showErrors(errors);
      if (Object.keys(errors).length) return;
      setSending(true);
      fetch(form.getAttribute("action"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
        credentials: "omit",
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
        })
        .then(function (r) {
          if (r.res.ok && r.body.ok) {
            form.reset();
            token = "";
            if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
            statusEl.textContent = msgs.success;
            statusEl.classList.add("is-success");
            statusEl.setAttribute("tabindex", "-1");
            statusEl.focus();
            return;
          }
          if (window.turnstile && widgetId !== null) { window.turnstile.reset(widgetId); token = ""; }
          if (r.body.errors && Object.keys(r.body.errors).length) { showErrors(r.body.errors); return; }
          var code = r.res.status === 429 ? "rate" : r.body.error === "captcha" ? "captcha" : "server";
          if (code === "captcha") { showErrors({ captcha: "captcha" }); return; }
          summary.textContent = msgs[code];
          summary.hidden = false;
          summary.focus();
        })
        .catch(function () {
          summary.textContent = msgs.network;
          summary.hidden = false;
          summary.focus();
        })
        .then(function () { setSending(false); });
    });
  }

  /* ---------- Analytics: Cloudflare Web Analytics, only after explicit consent ---------- */
  function initConsent() {
    var token = document.body.getAttribute("data-cf-token");
    var banner = document.getElementById("consent");
    if (!token || !banner) return;
    var choice = store.get("acg-consent");
    var gpc = navigator.globalPrivacyControl === true;

    function loadBeacon() {
      if (document.querySelector("script[data-cf-beacon]")) return;
      var s = document.createElement("script");
      s.src = "https://static.cloudflareinsights.com/beacon.min.js";
      s.defer = true;
      s.setAttribute("data-cf-beacon", JSON.stringify({ token: token, spa: false }));
      document.head.appendChild(s);
    }

    if (choice === "yes") loadBeacon();
    else if (!choice && !gpc) banner.hidden = false;

    banner.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-consent]");
      if (!btn) return;
      var yes = btn.getAttribute("data-consent") === "yes";
      store.set("acg-consent", yes ? "yes" : "no");
      banner.hidden = true;
      if (yes) loadBeacon();
      else if (document.querySelector("script[data-cf-beacon]")) window.location.reload();
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-open-consent]")) {
        banner.hidden = false;
        banner.querySelector("[data-consent]").focus();
      }
    });
  }

  initNav();
  if (window.performance && performance.mark) performance.mark("carousel-start");
  initCarousel();
  if (window.performance && performance.measure) performance.measure("carousel-init", "carousel-start");
  initForm();
  initConsent();
})();

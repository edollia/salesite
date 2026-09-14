/* =====================================================================
   BEAST STOCK-UP motion engine (v3).
   Runs after script.js. Never touches inventory, prices, or the cart.

   Rules this file keeps:
   - native scroll, transforms and opacity only, no layout-affecting animation
   - nothing moves that isn't standing on something: the hero bottles levitate,
     and each one drags a floor shadow that shrinks as it rises, so the lift
     reads as weight. Nothing after the fold floats at all.
   - no infinite animation outside the hero, and the hero's pauses when the
     hero is off screen or the tab is hidden
   - if GSAP fails to load, or the visitor prefers reduced motion, html.motion
     is never added and the page renders static with nothing hidden.
   ===================================================================== */
(function () {
  "use strict";

  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const isDesktop = () => window.matchMedia("(min-width: 760px)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const motion = hasGsap && !reduced;
  const config = window.SITE_CONFIG || {};

  /* ---------- launch-detail slots: filled only from SITE_CONFIG, never invented ---------- */
  (function fillSlots() {
    /* The contact line is EMPTY UNTIL IT IS REAL. It used to be a dashed
       placeholder plate reading "CONTACT CHANNEL · ANNOUNCED SOON" over a
       sentence about confirming a time — two lines of furniture standing in for
       one fact nobody has yet. An empty slot is not a design; it is a hole. The
       whole line is hidden until SITE_CONFIG carries something, and appears the
       moment it does. Nothing here is ever invented. */
    const slot = document.querySelector("[data-contact-slot]");
    const contact = document.querySelector("[data-contact-value]");
    const pickup = document.querySelector("[data-pickup-value]");
    const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : "");
    if (slot) {
      /* contactChannel is an OBJECT now — { kind, value, label } — because the
         checkout has to build an sms: URI out of it, not just print it. A bare
         string is still accepted so an older config does not silently blank the
         line. Nothing here is ever invented: no config, no line. */
      const raw = config.contactChannel;
      /* A US number is STORED in E.164, because that is what an sms: URI needs,
         and PRINTED as (323) 301-9200, because that is what a person reads. An
         earlier version joined the label and the raw value and produced
         "Send your request to Text +13233019200." */
      const pretty = (value) => {
        const m = String(value).match(/^\+1(\d{3})(\d{3})(\d{4})$/);
        return m ? `(${m[1]}) ${m[2]}-${m[3]}` : String(value);
      };
      /* NAMES THE CHANNEL, NEVER THE NUMBER — owner, 2026-09-13. The plate used
         to print "Text your list to (323) 301-9200." and they asked for the
         number to appear only at checkout. `pretty()` above is still used by
         nothing else on this plate and is kept because the checkout and the QA
         suite both read the same formatting rule; if it ever becomes genuinely
         unreferenced, delete it rather than leaving it as furniture. */
      let line = "";
      /* KEEP THIS SHORT. The three rules plates are forced to ONE height, so a
         contact line that wraps to two lines makes all three 24px taller and
         opens a dead gap under the CASH ONLY stamp — measured at 92px at
         1024x800, which is over the 90px "blank leftover" limit and failed the
         suite. The first version of this sentence did exactly that. Anything
         here must fit one line in the plate at 1024. */
      let line2 = "";
      if (typeof raw === "string" && text(raw)) line2 = "Your list goes out from the pickup list.";
      else if (raw && typeof raw === "object" && text(raw.value)) {
        line2 = String(raw.kind) === "sms"
          ? "Your list goes out as a text."
          : "Your list goes out from the pickup list.";
      }
      line = line2;
      const channel = line;
      const when = [text(config.pickupArea), text(config.pickupSchedule)].filter(Boolean).join(" · ");
      if (contact) contact.textContent = line;
      if (pickup) pickup.textContent = when;
      slot.hidden = !(channel || when);
    }

    /* The six towns were typed into index.html and flyer.html by hand while
       SITE_CONFIG.serviceCities sat unread. They agreed today; nothing kept them
       agreeing tomorrow. The chips are written from the config now, the way the
       delivery threshold already is. */
    const towns = Array.isArray(config.serviceCities) ? config.serviceCities.filter(Boolean) : [];
    const townList = document.querySelector("[data-towns]");
    if (townList && towns.length) {
      townList.replaceChildren(...towns.map((town) => {
        const li = document.createElement("li");
        li.textContent = String(town).toUpperCase();
        return li;
      }));
    }

    /* The delivery threshold used to be written here as well as in script.js.
       There is no threshold any more — freeMinimumItems is null — and every
       delivery number left on the page is a PRIZE minimum, which only the cart
       knows about. script.js is the single owner: it writes
       [data-delivery-left], [data-delivery-target] and [data-delivery-status]
       from the prize in hand. Two writers for one number is how the old
       belowMinimumMessage drifted. */
    /* The footer used to read "31 products · 224 packages · while supplies
       last." The count is already the loudest number in the shop head; saying
       it again at the bottom of the page is the third time a visitor is told
       it. The footer keeps the half that is a promise, not a statistic. */
  }());

  /* ---------- shelf headline decoration ---------- */
  function decorateShelves(scope = document) {
    scope.querySelectorAll(".shelf-price h3:not(.chrome)").forEach((h2) => {
      h2.dataset.text = h2.textContent;
      h2.classList.add("chrome", "chrome-shelf");
    });
  }
  decorateShelves();

  /* ---------- drag-to-scroll on product rows (mouse only) ---------- */
  /* Drag-to-scroll on the product rows (mouse and pen only; touch pans natively).

     Two things this has to get right:
     - Every search keystroke re-renders the shelves, so each grid is a brand new
       element. Every listener here is therefore element-scoped and dies with its
       grid; binding them on window leaked a handler per grid per keystroke.
     - Chromium fires pointercancel as soon as it decides a scroll has begun,
       which killed the gesture after one frame and left the row stuck in its
       dragging state with clicks suppressed. setPointerCapture keeps the
       sequence on the element, and pointercancel / lostpointercapture are
       handled anyway so the row can never stay stuck. */
  function markScrollable(grid) {
    // a grab cursor on a row that cannot scroll is a lie
    grid.classList.toggle("is-scrollable", grid.scrollWidth - grid.clientWidth > 4);
  }
  window.addEventListener("resize", () => {
    document.querySelectorAll(".product-grid").forEach(markScrollable);
  });

  const DRAG_THRESHOLD = 8;
  /* True from the moment a press lands on a row until the press ends. Read by
     the card tilt, which must not animate a card that is being dragged past,
     and by the shop's "touched" hold, which must not light every card's arrows
     as the row sweeps under the pointer. */
  let gridPressing = false;

  /* The native image drag. Every product photo is an <img>, and in a browser an
     <img> is draggable by default: press one, move, and the browser starts its
     own image-transfer gesture instead of scrolling the row — a ghost of
     the bottle follows the pointer, the row stops tracking, and the gesture
     ends wherever the OS decides. `-webkit-user-drag:none` in the stylesheet is
     a NON-STANDARD property that only Chromium and WebKit honour, and it was
     the only thing holding this back.

     Two standard defences now, because this one cannot be proved absent from a
     headless browser: the synthetic pointer Playwright drives does not run the
     platform's image-transfer pipeline at all, so no scripted test can reproduce
     it and no scripted test can clear it either. The owner reported it with a
     real mouse. That is the better instrument. */
  function disarmImageDrag(scope) {
    scope.querySelectorAll("img").forEach((img) => { img.draggable = false; });
  }
  /* script.js refuses every dragstart on the page in capture phase, which is
     the real fix. This stays as the second belt for the same reason the podium
     solver sits above the motion gate: the two files fail independently, and
     the defect this stops is one the owner has now reported twice. */
  document.addEventListener("dragstart", (event) => { event.preventDefault(); }, true);
  disarmImageDrag(document);

  function bindDrag(grid) {
    if (grid.dataset.dragBound || !finePointer) return;
    grid.dataset.dragBound = "1";
    markScrollable(grid);
    disarmImageDrag(grid);
    let candidate = null, dragging = false, moved = 0;
    const endDrag = () => {
      if (candidate) {
        try { if (grid.hasPointerCapture(candidate.id)) grid.releasePointerCapture(candidate.id); } catch { /* already gone */ }
      }
      candidate = null;
      dragging = false;
      gridPressing = false;
      grid.classList.remove("is-dragging");
    };
    grid.addEventListener("pointerdown", (event) => {
      // clear the previous gesture first, so a finished drag can never suppress
      // the next press of an Add button
      moved = 0;
      candidate = null;
      gridPressing = false;
      if (event.button !== 0 || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
      if (event.target.closest("button, a, input")) return;     // a press on a control is a press
      if (grid.scrollWidth - grid.clientWidth < 4) return;
      candidate = { id: event.pointerId, x: event.clientX, left: grid.scrollLeft };
      gridPressing = true;
    });
    grid.addEventListener("pointermove", (event) => {
      if (!candidate || candidate.id !== event.pointerId) return;
      const dx = event.clientX - candidate.x;
      // nothing happens until the pointer has really travelled, so a click is
      // never mistaken for a drag
      if (!dragging && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        grid.classList.add("is-dragging");
        try { grid.setPointerCapture(candidate.id); } catch { /* capture unavailable */ }
        /* RE-ANCHOR on the frame the drag actually engages, against the LIVE
           scrollLeft. Two bugs in one line:
           - the row used to jump the 8 px threshold the moment it engaged,
             because the anchor was the press position and the first applied
             delta was already 8 px. The content now starts moving from where
             the hand is, not 8 px away from it.
           - the press position was paired with the scrollLeft READ AT PRESS
             TIME. Grab a row that is still coasting from a trackpad flick and
             that number is already stale by the time the hand moves, so every
             frame yanks the row back toward where it was when the button went
             down and fights the momentum the whole way. */
        candidate.x = event.clientX;
        candidate.left = grid.scrollLeft;
        moved = DRAG_THRESHOLD + 1;        // this was still a drag, not a click
        return;
      }
      // also cancels Chromium's native image drag, which otherwise fires
      // pointercancel one frame in and leaves the row stuck
      event.preventDefault();
      moved = Math.max(moved, Math.abs(dx));
      grid.scrollLeft = candidate.left - dx;
    });
    grid.addEventListener("pointerup", endDrag);
    grid.addEventListener("pointercancel", endDrag);
    grid.addEventListener("lostpointercapture", endDrag);
    grid.addEventListener("click", (event) => {
      if (moved > DRAG_THRESHOLD) { event.preventDefault(); event.stopPropagation(); }
    }, true);
  }

  const shelvesRoot = document.querySelector("[data-product-sections]");

  const hero = document.querySelector("[data-hero]");

  /* ================== THE PODIUM STAGE ==================
     The background plate paints a chrome podium. Where that podium lands on
     screen depends entirely on how object-fit:cover crops the plate at this
     exact viewport, so it is MEASURED, never guessed — which is what made every
     window width its own hand-tuned band of percentages before, and why
     dragging a window edge used to slide the bottles off the disc.

     The ellipse of each plate's top surface was read off the artwork once, in
     normalised image coordinates:
       portal-desktop.webp 1672x941 — surface x 605..1605, y 655..752
                                      centre (1105, 703.5) semi-axes 500 x 48.5
       portal-mobile.webp   941x1672 — surface x  45..905, y 1243..1355
                                      centre (475, 1299)   semi-axes 430 x 56
     Everything else — each bottle's x, width, height, how high it stands and
     what it paints in front of — is derived from that ellipse at runtime. The
     line-up therefore stands ON the disc and follows its curve upward toward
     the rim at every viewport, orientation and mid-drag intermediate size. */
  const PODIUM = {
    "portal-desktop": { cx: 1105 / 1672, cy: 703.5 / 941, a: 500 / 1672, b: 48.5 / 941 },
    "portal-mobile": { cx: 475 / 941, cy: 1299 / 1672, a: 430 / 941, b: 56 / 1672 }
  };
  const STAGE_SPREAD = .84;   // bottles keep clear of the very rim of the disc
  const STAGE_DEPTH = .66;    // how far forward of the disc's centre line they stand
  const STAGE_NEST = .06;     // neighbours may overlap by this much of a bottle width
  const STAGE_GAP_MAX = .16;  // ...and may stand this far apart before the line looks scattered
  const STAGE_MAXH = .355;    // no bottle taller than this share of the hero
  const STAGE_CLEAR = 14;     // px the line-up keeps clear of any copy it meets
  /* What the bottles are not allowed to touch. Measuring the real ink rather
     than the copy COLUMN matters: .hero-copy is a 620 px box whose widest child
     is a 460 px sentence, so avoiding the box would shove the whole line-up
     80 px right at 1440 for a collision that does not exist. */
  /* What the bottles may not touch. These can push the line-up sideways OR
     shrink it, whichever costs less. */
  const STAGE_OBSTACLES = [".collab-pill", ".hero-sub", ".hero-cta", ".hero-price"];
  /* And what they may not COVER. Owner, 2026-09-12: "the P from STOCK-UP is
     covered too much by the bottles." Measured before the fix: the last letter
     was 62% covered at 1440x900 and 92% at 1728x1100 — not an edge case, the
     default desktop view.

     These are separate from STAGE_OBSTACLES for two reasons, and the previous
     version of this file was right about both:
       - the SELECTOR is the inline span, not the heading. .hero-title is a
         620 px box around a 460 px word; avoiding the box shoved the line-up
         96 px right for a collision that was not happening. The inline span's
         rect IS the text advance, which is the ink.
       - they are PUSH-ONLY. A wall that can also force a `shrink` would cut
         the whole line-up to clear type that sits above it, and in the centred
         layout — where the wordmark straddles the podium — that is every
         viewport. A wall that is not to the LEFT of the podium centre is
         ignored entirely, because "move right" is the only remedy that means
         anything against a word the scene stands beside. */
  const STAGE_TEXT_WALLS = [".hero-beast .chrome", ".hero-stockup .brush"];
  const STAGE_TEXT_CLEAR = 10;
  const STAGE_BACK = .11;     // a bottle at the rim is this much smaller than one at the front
  const REFLECT_SQUASH = .26; // must match --reflect-squash in beast.css

  /* Three stages, in the order the owner asked for: $5, then $7, then $8.
     `rel` is a real-world height, relative between products and SHARED across
     the three sets — one world scale — so the 150 oz Purex on stage three is
     visibly bigger than the 27 oz Snuggle on stage one instead of every set
     being independently stretched to the same width. `ar` is a fallback aspect
     ratio; the real one is read off the decoded image the moment it lands. */
  const HERO_STAGES = [
    { deal: "2-for-5", top: "2 FOR", big: "$5",
      label: "Any two medium bottles for five dollars, mix or match",
      short: "two for five dollars",
      items: [
        { id: "tide-simply-all-in-one-24-loads", rel: 1.00, ar: .664 },
        { id: "arm-hammer-odor-blasters-21-loads", rel: 1.05, ar: .684 },
        { id: "all-free-clear-original-30oz", rel: 1.03, ar: .589 },
        { id: "snuggle-blue-sparkle-40-loads", rel: 1.00, ar: .570 }
      ] },
    { deal: "paper-2-for-7", top: "2 FOR", big: "$7",
      label: "Any two paper packages or softeners for seven dollars, mix or match",
      short: "two for seven dollars",
      /* Owner, 2026-09-12: "for the 2x7 the paper should be a bit bigger, the
         bottles smaller." They are also right physically — a twelve-roll pack
         and a six-roll paper-towel pack both stand about as tall as a 44 fl oz
         softener, and the old numbers had them a fifth shorter. */
      items: [
        { id: "unbranded-toilet-paper-12-rolls", rel: 1.02, ar: 1.100 },
        { id: "downy-cool-cotton-44oz", rel: 1.05, ar: .421 },
        { id: "gain-odor-defense-44oz", rel: 1.03, ar: .485 },
        { id: "unbranded-paper-towels-6-rolls", rel: .98, ar: 1.131 }
      ] },
    /* No "1 FOR". Owner, 2026-09-12: "no '1 for 8', just $8." The top line is
       empty and buildStageContent draws no line for it, so the price sits on
       its own rather than over a spacer where a word used to be. */
    { deal: "8-each", top: "", big: "$8",
      label: "Big sizes, eight dollars each",
      short: "eight dollars each",
      /* Owner, same day: "for the 8, the Tide Downy container appears too
         small — it's a big container." A 35 oz tub of 25 XL pods is a chunky
         object, not a small one; .92 made it the runt of a line-up of jugs. */
      items: [
        { id: "purex-fresh-mountain-breeze-115-loads", rel: 1.34, ar: .847 },
        { id: "tide-simply-all-in-one-85-loads", rel: 1.22, ar: .873 },
        { id: "suavitel-field-flowers-105-loads", rel: 1.20, ar: .591 },
        { id: "tide-power-pods-downy-25ct", rel: 1.10, ar: .900 }
      ] }
  ];
  const stageItem = new Map();
  HERO_STAGES.forEach((stage) => stage.items.forEach((item) => stageItem.set(item.id, item)));

  document.querySelectorAll(".hero-stage img, .hero-plate img").forEach((img) => { img.draggable = false; });
  const plateImg = document.querySelector(".hero-plate img");
  const stageBox = document.querySelector("[data-stage]");
  const priceDeck = document.querySelector("[data-price-deck]");

  function podiumMetrics() {
    if (!hero || !plateImg) return null;
    const W = hero.clientWidth, H = hero.clientHeight;
    const nw = plateImg.naturalWidth, nh = plateImg.naturalHeight;
    if (!W || !H || !nw || !nh) return null;
    const key = /portal-desktop/.test(plateImg.currentSrc || plateImg.src) ? "portal-desktop" : "portal-mobile";
    const p = PODIUM[key];
    /* object-fit:cover, resolved exactly the way the renderer does it, so the
       maths cannot drift from the stylesheet. object-position is read from the
       computed style rather than duplicated here for the same reason. */
    const scale = Math.max(W / nw, H / nh);
    const rw = nw * scale, rh = nh * scale;
    const raw = String(getComputedStyle(plateImg).objectPosition || "50% 50%").split(/\s+/);
    const offset = (token, slack) => {
      if (!token) return slack * .5;
      if (token.endsWith("%")) return slack * parseFloat(token) / 100;
      const px = parseFloat(token);
      return Number.isFinite(px) ? px : slack * .5;
    };
    return {
      W, H,
      cx: offset(raw[0], W - rw) + p.cx * rw,
      cy: offset(raw[1], H - rh) + p.cy * rh,
      a: p.a * rw,
      b: p.b * rh
    };
  }

  /* One world scale for all three sets, then each set is laid out across the
     visible part of the disc. Nothing here reads a media query.

     Collisions with the hero copy are resolved by MEASUREMENT, in a few passes:
     place the line-up, look for a box that has run into the pill, the sentence,
     the buttons or the price block, then either slide the whole line right or
     bring the whole line down, and look again. That replaced five hand-written
     bands of `.hero-stage{left:40%}` / `{left:47%}` / `{left:0}` / `{width:56%}`,
     each of which was correct at the width it was written for and wrong on
     either side of it. */
  /* The obstacle boxes as they were BEFORE the hero intro started moving them.
     This is used for exactly as long as the intro is running and never again:
     the moment it finishes, every solve measures fresh. Keying it on the hero's
     size was not enough — the price block is a DECK that gets wider when stages
     two and three are built into it, so a "same size hero" could still have a
     different price box, and the 2-for-$5 bottles ended up over the price at
     four desktop shapes. `introRunning` is the honest condition. */
  let obstacleCache = null;
  let introRunning = false;

  function layoutStage() {
    const pod = podiumMetrics();
    if (!pod || !stageBox) return;
    hero.style.setProperty("--pod-cx", pod.cx.toFixed(2) + "px");
    hero.style.setProperty("--pod-cy", pod.cy.toFixed(2) + "px");
    hero.style.setProperty("--pod-a", pod.a.toFixed(2) + "px");
    hero.style.setProperty("--pod-b", pod.b.toFixed(2) + "px");

    const sets = [...stageBox.querySelectorAll(".hero-set")];
    if (!sets.length) return;
    const margin = Math.max(12, pod.W * .022);
    const hi = Math.min(pod.cx + pod.a * STAGE_SPREAD, pod.W - margin);
    /* The floor is keyed to the SMALLER side of the hero, not its height. On a
       tall narrow window, height * .11 is a bigger number than the width can
       ever pay for, so widening the window from 624 px to 648 px cut the
       line-up from four bottles to two — fewer products on a bigger screen,
       which is the wrong direction and the resize sweep now fails on it. */
    const floor = Math.max(64, Math.min(pod.W, pod.H) * .10);

    const readSet = (set) => [...set.querySelectorAll(".hero-bottle")].map((node) => {
      const data = stageItem.get(node.dataset.bottleId) || {};
      const img = node.querySelector("img[data-hero-product]");
      const ar = (img && img.naturalWidth > 0 && img.naturalHeight > 0)
        ? img.naturalWidth / img.naturalHeight
        : (data.ar || .65);
      return { node, rel: data.rel || 1, ar };
    });
    const all = sets.map(readSet);

    const heroBox = hero.getBoundingClientRect();
    const boxOf = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return null;
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { l: r.left - heroBox.left, r: r.right - heroBox.left, t: r.top - heroBox.top, b: r.bottom - heroBox.top };
    };
    /* THE OBSTACLES ARE MEASURED ONCE, IN THEIR FINAL PLACE.
       The hero intro flies the copy in from y:22 and scales the price block up
       from .88, and the solver was re-measuring them mid-flight — so the
       bottles were placed against a price block 12% smaller than the one that
       ends up there, landed, and were then MOVED by the re-solve at the end of
       the intro. That is the jump the owner reported on 2026-09-12: "the
       bottles and the 2 for 5 jumps, then it goes into the floating effect."

       Under `html.motion` the CSS initial states are opacity only — no
       transforms — so at module init, before the timeline is played, every one
       of these boxes is already in its FINAL geometry. Measured there and
       cached, the first solve is the same as the last and nothing moves.
       The cache is keyed on the hero's own size, so a real resize re-measures. */
    /* THE TEXT WALLS ARE CACHED TOO, and leaving them out was the rest of the
       jump. The obstacles were frozen for the intro's duration but
       STAGE_TEXT_WALLS were re-measured on every solve — and the intro slides
       the slogan in with `x:-50, rotate:-6`, so `boxOf` returned the TRANSFORMED
       box for as long as it ran. The line-up was pushed off a wall that was
       still moving, and when the intro ended and the cache was thrown away the
       whole row re-solved against the settled wall and stepped sideways in one
       frame: 15.27 px at 1024, 6.14 at 1728, 5.31 at 1440.

       Proof it was the walls and not the obstacles: across the jump frame all
       four obstacle boxes are byte-identical before and after. Measured
       2026-09-12, after two earlier candidate causes had been fixed and the jump
       had not moved at all — which is the reason to measure rather than reason. */
    const freshWalls = STAGE_TEXT_WALLS.map(boxOf).filter(Boolean);
    const obstacleKey = `${Math.round(heroBox.width)}x${Math.round(heroBox.height)}`;
    const fresh = STAGE_OBSTACLES.map(boxOf).filter(Boolean);
    let obstacles = fresh;
    let textWalls = freshWalls;
    if (introRunning && obstacleCache && obstacleCache.key === obstacleKey) {
      obstacles = obstacleCache.boxes;
      textWalls = obstacleCache.walls;
    } else {
      obstacleCache = { key: obstacleKey, boxes: fresh, walls: freshWalls };
    }

    /* Scale is per STAGE, not shared across all three. `rel` keeps the real
       size relationships inside a stage — the 150 oz Purex really is bigger
       than the pods tub next to it — but every stage fills the same podium.
       One shared scale was tried and rejected: the $8 line-up is the widest of
       the three, so it set the scale for all of them and shrank the opening
       stage by a quarter to preserve a comparison nobody can make, because
       only one stage is ever on screen. */
    const relsOf = (row, count) => visibleOf(row, count).map((b) => b.rel);
    const rowUnit = (row, count, span) => Math.min(
      span / Math.max(.001, visibleOf(row, count).reduce((sum, b) => sum + b.rel * b.ar, 0)
        * (1 - STAGE_NEST * (count - 1) / count)),
      pod.H * STAGE_MAXH / Math.max(.001, Math.max(...relsOf(row, count))));
    /* HOW MANY bottles is a question about both the horizontal room and what
       the collision passes have had to give up. It was briefly width-only,
       because coupling it to the scale used to make widening a tall window cut
       the line-up from four bottles to two — but that was the SLIDE remedy
       eating the span, and the slide is now refused when it would starve the
       line-up. With that fixed, the coupling is safe and necessary: without it
       the ceiling shrank four bottles to 47x30 px and clustered them in the
       middle of a 538 px disc rather than showing two readable ones. */
    const shortestHeight = (count, span, scale) => Math.min(...all.map((row) =>
      rowUnit(row, count, span) * scale * Math.min(...relsOf(row, count))));

    /* Where each bottle goes, as numbers, before anything is written to the DOM.
       Everything downstream reads this, including the collision passes. */
    const plan = (count, scale, lo) => {
      const span = Math.max(120, hi - lo);
      return all.map((row) => {
        const shown = visibleOf(row, count);
        const unit = rowUnit(row, count, span) * scale;
        const widths = shown.map((b) => unit * b.rel * b.ar);
        const total = widths.reduce((sum, w) => sum + w, 0);
        const slots = Math.max(1, shown.length - 1);
        /* The upper cap is relative to the SPAN as well as the unit: when the
           ceiling has shrunk the bottles hard, a gap capped only at .16 of a
           small unit left four little bottles huddled in the middle of a wide
           disc instead of standing along it. */
        const gap = Math.max(-STAGE_NEST * unit,
          Math.min(Math.max(STAGE_GAP_MAX * unit, span * .05), (span - total) / slots));
        let x = lo + (span - (total + gap * slots)) / 2;
        return row.map((b) => {
          const index = shown.indexOf(b);
          if (index < 0) return { b, hidden: true };
          const w = widths[index];
          const centre = x + w / 2;
          x += w + gap;
          const u = Math.max(-1, Math.min(1, (centre - pod.cx) / Math.max(1, pod.a)));
          const k = Math.sqrt(Math.max(0, 1 - u * u));       // 1 at the front, 0 at the rim
          /* Perspective, not decoration: the disc is shallow, so the true arc of
             the front lip is only about ten pixels across the whole line-up and
             on its own it does not read. The size falloff is what makes the eye
             see depth, and it is keyed to the horizontal distance from the
             disc's centre, where the falloff is actually linear. */
          const shrink = 1 - STAGE_BACK * Math.abs(u);
          const height = unit * b.rel * shrink;
          const width = w * shrink;
          const base = pod.cy + pod.b * STAGE_DEPTH * k;
          return { b, hidden: false, centre, width, height, base, k,
                   l: centre - width / 2, r: centre + width / 2, t: base - height };
        });
      });
    };

    /* The deepest thing the line-up has run into, and the two ways out of it. */
    const clash = (layout) => {
      let push = 0, shrink = 0;
      for (const row of layout) {
        for (const spot of row) {
          if (spot.hidden) continue;
          /* The wordmark: slide clear of it or leave it alone. Never shrink,
             never come down — the line-up is allowed to stand beside display
             type, it is just not allowed to paint over the last letter of it. */
          for (const w of textWalls) {
            if (spot.r <= w.l || spot.l >= w.r || spot.base <= w.t || spot.t >= w.b) continue;
            if (w.r >= pod.cx) continue;
            push = Math.max(push, w.r + STAGE_TEXT_CLEAR - spot.l);
            /* AND A WAY DOWN, added 2026-09-13. Push-only made the wall's
               arrival a CLIFF, and the resize sweep found it the moment the
               hero sentence stopped masking it: at 900 px tall, dragging the
               window across 1036 px moved the left bottle 77 px. The loop is
               the reason — a taller bottle reaches the slogan, the slogan
               shoves the row right, the row's span shrinks, the bottle gets
               shorter, and it no longer reaches the slogan. Nothing converges,
               and four pixels of window pick a side.

               A shrink has no cliff in it: right at the threshold the overlap is
               a pixel, so the shrink is a pixel, and the pass below takes
               whichever remedy is cheaper as a fraction of what it costs. The
               push stays and still wins wherever sliding is cheap.

               The note above says walls are push-only because a shrink would
               shrink the line-up to clear type that sits over the podium. That
               is still true and is still handled — by the `w.r >= pod.cx` line
               directly above, which throws the centred layout's straddling
               wordmark out before either remedy is considered. Push-only was
               belt as well as braces, and the belt was the thing with the
               cliff in it. */
            shrink = Math.max(shrink, (w.b + STAGE_TEXT_CLEAR - spot.t) / Math.max(1, spot.height));
          }
          for (const o of obstacles) {
            if (spot.r <= o.l || spot.l >= o.r || spot.base <= o.t || spot.t >= o.b) continue;
            /* Sliding right only makes sense against copy that is genuinely on
               ONE side. In the centred layout the price block straddles the
               middle of the podium, so "move right" shoved the whole line-up
               off the disc and shrank the span until the solver started
               losing bottles — the line-up lost two products as the window
               got WIDER. There, coming down is the only sane remedy. */
            if (o.r < pod.cx && o.r < spot.r) push = Math.max(push, o.r + STAGE_CLEAR - spot.l);
            shrink = Math.max(shrink, (o.b + STAGE_CLEAR - spot.t) / Math.max(1, spot.height));
          }
        }
      }
      return { push, shrink };
    };

    let count = Math.min(...all.map((row) => row.length));
    let lo = Math.max(pod.cx - pod.a * STAGE_SPREAD, margin);
    let scale = 1;
    // a bottle too short to read is worse than one bottle fewer
    const fitCount = () => {
      while (count > 2 && shortestHeight(count, hi - lo, scale) < floor) count -= 1;
    };
    fitCount();
    let layout = plan(count, scale, lo);
    window.__stagePasses = [];
    for (let pass = 0; pass < 5; pass += 1) {
      const { push, shrink } = clash(layout);
      if (window.__stageDebug) window.__stagePasses.push({ pass, push: +push.toFixed(1), shrink: +shrink.toFixed(3), lo: +lo.toFixed(1), scale: +scale.toFixed(3) });
      if (!push && shrink <= 0) break;
      /* Take the cheaper way out, measured as a fraction of what it costs. A
         softener overlapping the price block by four pixels used to trigger a
         146 px sideways shove of all three line-ups, because "slide right" was
         tried first unconditionally: a 1.5% shrink was the right answer and an
         18% loss of the podium was the one it took. */
      /* Enough span left to be a line-up at all. This used to be a much
         tighter test — "enough room for the CURRENT four bottles at full size" —
         and it put a cliff in the middle of a smooth resize: at 1048 px the
         slide was refused and the whole line-up shrank to 60%, at 1052 px it
         was allowed and they snapped back to full size, a 53% jump for four
         pixels of window. Starving the line-up is handled where it belongs, by
         the count falling, and the centred layout refuses the slide outright. */
      const room = lo + push < hi - 200;
      if (push > 0 && room && push / Math.max(1, hi - lo) <= shrink) lo += push;
      else if (shrink > 0) scale *= Math.max(.6, 1 - shrink);
      else if (push > 0 && room) lo += push;
      else break;
      fitCount();
      layout = plan(count, scale, lo);
    }

    if (window.__stageDebug) window.__stageLast = { lo, scale, count, obstacles, hi, passes: window.__stagePasses };
    layout.forEach((row) => row.forEach((spot) => {
      const node = spot.b.node;
      node.hidden = !!spot.hidden || node.dataset.broken === "1";
      if (spot.hidden) return;
      node.style.setProperty("--x", spot.centre.toFixed(2) + "px");
      node.style.setProperty("--y", spot.base.toFixed(2) + "px");
      node.style.setProperty("--w", spot.width.toFixed(2) + "px");
      node.style.setProperty("--h", spot.height.toFixed(2) + "px");
      node.style.setProperty("--z", String(4 + Math.round(spot.k * 40)));
    }));
  }
  function visibleOf(row, count) {
    // lose the outermost first, then the outermost of what is left
    let list = row.slice();
    while (list.length > count) list = list.length % 2 ? list.slice(0, -1) : list.slice(1);
    return list;
  }

  /* Re-solve when the box changes for any reason at all: a window drag, a
     rotation, a URL bar collapsing on a phone, or the plate finally decoding
     (naturalWidth is 0 until then, and the first solve has to be redone). */
  /* A hero bottle that 404s printed its alt text across the middle of the
     scene. Product cards have had a deliberate fallback for months; the hero
     had none. Here the honest fallback is to take the bottle out of the
     line-up — the solver re-spaces the ones that are left. */
  function hideBrokenBottle(img) {
    const shell = img.closest(".hero-bottle");
    if (!shell) return;
    shell.dataset.broken = "1";
    shell.hidden = true;
    scheduleStageLayout();
  }
  document.querySelector("[data-stage]")?.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement) hideBrokenBottle(event.target);
  }, true);

  /* ---------- the hero slogan shares BEAST's measure ----------
     The owner, 2026-09-12: "of a deal reads too separate no?" It was, and the
     cause was geometry rather than taste. Measured across seven shapes before
     this existed: the slogan sat 11.5 px inside BEAST on the left and 57 px
     PAST it on the right at 1440 -- straight into the drum -- was 4% narrower
     at 1728, and 23% narrower on a phone. Three different lockups depending on
     how wide the window happened to be. Two lines read as one phrase when they
     share a measure; they read as a name and a tagline when they do not.

     offsetWidth is the right instrument here and getBoundingClientRect() is
     not: .chrome-xl carries skewX(-7deg) and .brush carries rotate(-3deg), so
     both rects are the transformed AABB and neither describes the type. Layout
     width ignores transforms.

     THIS RUNS ABOVE THE MOTION GATE, for the same reason the podium solver
     does (trap 21): a reduced-motion visitor and anyone whose vendor bundle
     failed still gets the hero, and the lockup is the first thing in it. The
     fit is CLAMPED so a mid-swap measurement of zero, or a font that never
     arrives, cannot blow the lockup up -- it just stays at the CSS size. */
  const sloganBox = document.querySelector("[data-hero-stock]");
  const sloganInk = sloganBox?.querySelector(".brush");
  const beastInk = document.querySelector("[data-hero-beast] .chrome");
  function fitSlogan() {
    if (!sloganBox || !sloganInk || !beastInk) return;
    /* Measure the slogan at its unfitted size every time. Measuring the FITTED
       width and scaling that again compounds: the lockup would creep a little
       wider on every resize tick and never come back. No paint happens between
       these two lines -- they are one task -- so the reset is not a flash. */
    sloganBox.style.setProperty("--slogan-fit", "1");
    const natural = sloganInk.offsetWidth;
    const target = beastInk.offsetWidth;
    if (!natural || !target) return;
    const fit = Math.min(1.45, Math.max(.55, target / natural));
    sloganBox.style.setProperty("--slogan-fit", fit.toFixed(4));
  }
  fitSlogan();
  /* Permanent Marker decides this measurement and it is not there on the first
     frame. Without this the lockup fits to the fallback face and stays there. */
  document.fonts?.ready?.then(() => { fitSlogan(); scheduleStageLayout(); });

  let stageFrame = 0;
  let stageRetries = 0;
  function scheduleStageLayout() {
    if (stageFrame) return;
    stageFrame = requestAnimationFrame(() => {
      stageFrame = 0;
      // a plate that has not decoded yet measures as nothing; come back for it
      if (!podiumMetrics() && stageRetries < 40) { stageRetries += 1; scheduleStageLayout(); return; }
      stageRetries = 0;
      /* The lockup is an obstacle the stage solver measures, so it has to be
         its final size BEFORE the bottles are placed against it -- fit first,
         then lay out, in that order, inside the same frame. */
      fitSlogan();
      layoutStage();
    });
  }
  layoutStage();
  stageBox?.querySelectorAll("img[data-hero-product]").forEach((img) => {
    if (!img.complete) img.addEventListener("load", scheduleStageLayout, { once: true });
  });
  if (hero && typeof ResizeObserver === "function") new ResizeObserver(scheduleStageLayout).observe(hero);
  /* A ResizeObserver on .hero is NOT enough. The hero's height is clamped
     (min-height/max-height), so dragging a 1280-wide window from 1250 px tall
     to 1300 px left the hero box byte-identical and the observer silent — while
     the <picture> swapped to the portrait plate underneath it. The podium
     variables stayed on the landscape numbers, 384 px out, and the whole
     line-up floated across the middle of the drum with a paper pack printing
     through "$7". A one-pixel width nudge fixed it, which is what isolated it.
     The window resize and the two media queries that actually change the hero
     are listened to directly. */
  window.addEventListener("resize", scheduleStageLayout);
  window.addEventListener("orientationchange", scheduleStageLayout);
  ["(min-aspect-ratio: 1/1)", "(min-width: 760px)"].forEach((query) => {
    const mq = window.matchMedia(query);
    if (mq.addEventListener) mq.addEventListener("change", scheduleStageLayout);
    else if (mq.addListener) mq.addListener(scheduleStageLayout);
  });
  /* And the plate can be mid-swap when we measure: currentSrc changes, the new
     file has not decoded, naturalWidth is 0, podiumMetrics() bails and writes
     nothing — with a `once` listener there was nothing left to retry with, so
     the podium stayed frozen on the old plate's numbers for good. */
  plateImg?.addEventListener("load", scheduleStageLayout);
  plateImg?.addEventListener("error", scheduleStageLayout);

  /* Scroll-out for the hero: copy and price lift and fade; the scene, the floor
     and the bottles stay put. Bound after the intro so start values are honest. */
  function bindHeroScroll() {
    if (!hero) return;
    gsap.fromTo("[data-hero-copy]", { y: 0, opacity: 1 }, { y: -90, opacity: 0, ease: "none", immediateRender: false, scrollTrigger: { trigger: hero, start: "top top", end: "65% top", scrub: true } });
    gsap.fromTo("[data-hero-price]", { y: 0, opacity: 1 }, { y: -120, opacity: 0, ease: "none", immediateRender: false,
      scrollTrigger: { trigger: hero, start: "top top", end: "60% top", scrub: true,
        /* a faded-out control is still a control: the dial kept its tab stop and
           still swapped the stage from a page scrolled 700 px past it */
        onUpdate: (self) => { const box = document.querySelector("[data-hero-price]");
          if (box) box.style.visibility = self.progress > .96 ? "hidden" : ""; } } });
  }



  /* ================== THE WHEEL ==================
     Eleven segments and seven distinct outcomes — five of them TRY AGAIN — which is what a wheel looks
     like. The WINNER IS DRAWN FIRST from the weight table and the rotation is
     then solved to land the needle on that segment — never the reverse. That is
     what makes the odds real, auditable and testable; a wheel that spins to a
     random angle and reads off whatever it hits has whatever odds its geometry
     happens to give it.

     Prizes are the owner's own list. They are STATED, never subtracted: the
     cash total in the pickup list is always the plain total of what was picked,
     and the wheel line rides along in the copied request text for the seller to
     honour in person. Nothing here takes money, and nothing is sent anywhere.

     One spin per device (localStorage). script.js owns the prize itself, so a
     prize won today still shows on a later visit even if GSAP never loads.

     THIS BLOCK RUNS ON EVERY PATH, above the motion gate. It used to sit below
     it, so a reduced-motion visitor — or anyone whose vendor bundle failed —
     got a full-width band saying SPIN THE WHEEL with a pink SPIN chip that did
     nothing at all, silently, with no console error. The wheel is SVG and its
     result comes from a weight table; only the 5.2-second spin needs motion,
     and that degrades to a CSS transition, or to landing instantly for someone
     who has asked for less movement. */
  /* The segments come from SITE_CONFIG.wheelPrizes — a discount is a business
     fact and the motion layer may not invent one. beast.js draws the wheel and
     spins it; script.js owns what a prize is worth and whether this list can
     claim it. If the config carries no prizes, no wheel is built at all. */
  /* ================== THE WHEEL ==================
     Everything visible here is derived from SITE_CONFIG.wheelPrizes. beast.js
     invents no prize, no odd and no minimum: if the table is empty the band and
     the dialog are removed rather than shown with nothing behind them. */
  const WHEEL_SEGMENTS = (window.SITE_CONFIG?.wheelPrizes || []).map((seg) => ({
    id: String(seg.id || ""),
    label: String(seg.label || "TRY AGAIN"),
    sub: String(seg.note || ""),
    terms: String(seg.terms || ""),
    art: String(seg.art || ""),
    brandArt: String(seg.brandArt || ""),
    tone: String(seg.tone || "miss"),
    weight: Math.max(0.01, Number(seg.weight) || 1),
    prize: !!(seg.min || seg.minItems || seg.delivery),
    top: !!seg.top
  }));
  /* localStorage AND A DATE, changed 2026-09-13 at the owner's instruction.

     It was sessionStorage, which is per TAB: an audit opened a third tab and
     reached DUTCH BROS with no devtools and no trickery, while the dialog said
     ONE SPIN A DAY. Seventy per cent of the face is TRY AGAIN, which leaves
     no trace, so farming it was free and invisible.

     The owner set the business rule: one spin a day. The key carries the local
     date, so the lock survives a new tab and clears itself at midnight without
     anything to sweep up. A spin is still refused outright while a PRIZE is
     held, so nobody can spin a won prize away.

     NONE OF THIS IS ENFORCEABLE ON A STATIC PAGE — clearing site data resets
     it, and it always will. The copy says what the code does and claims no
     more: the prize is stated, never subtracted, and settled in person. */
  const wheelKeyForToday = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `beast-wheel-spun-${now.getFullYear()}-${month}-${day}`;
  };
  const WHEEL_SPUN_KEY = wheelKeyForToday();

  /* Each wedge is a gradient, so its ink has to clear the WCAG floor at BOTH
     ends of it. White type on the old #0aa9d8 cyan measured 4.17:1 against the
     light end — under the 4.5 floor for 10 px text — while dark type would have
     failed against the dark end of the same wedge. The range is narrower now,
     and the two light tones (chrome, gold) take dark ink instead. */
  const WHEEL_TONES = {
    cyan: ["#0c87b0", "#044f6b"],
    pink: ["#c8126f", "#5e0938"],
    chrome: ["#e7f4fb", "#9db3c2"],
    violet: ["#5240b6", "#231a5c"],
    gold: ["#ffdf6b", "#c08b06"],
    miss: ["#0d2742", "#061627"]
  };

  (function buildWheel() {
    const band = document.querySelector("[data-spin-band]");
    const dialog = document.querySelector("[data-wheel-dialog]");
    const svg = document.querySelector("[data-wheel-svg]");
    const disc = document.querySelector("[data-wheel-disc]");
    const needle = document.querySelector("[data-wheel-needle]");
    const openers = [...document.querySelectorAll("[data-open-wheel]")];
    const spinButton = document.querySelector("[data-spin]");
    const result = document.querySelector("[data-wheel-result]");
    const oddsList = document.querySelector("[data-wheel-odds]");
    const bandTitle = document.querySelector("[data-spin-title]");
    const bandSub = document.querySelector("[data-spin-sub]");
    const eyebrow = document.querySelector("[data-wheel-eyebrow]");
    if (!band || !dialog || !svg || !disc || !spinButton) return;
    // no prizes in SITE_CONFIG means no wheel: the band would be an empty offer
    if (WHEEL_SEGMENTS.length < 2 || !WHEEL_SEGMENTS.some((seg) => seg.prize)) { band.remove(); dialog.remove(); return; }

    const NS = "http://www.w3.org/2000/svg";
    const N = WHEEL_SEGMENTS.length;
    /* The box has to CONTAIN the jackpot flags, not merely allow them to
       overflow: they hung outside a 260-unit box on overflow:visible and the
       dialog clipped "1 FREE ITEM" in half. Worst case is a flag centred at
       R + FLAG_GAP with half its width beyond that, so the box is sized from
       that number and the wheel is centred in it. */
    /* A flag carrying a WORD is wider than one carrying a brand mark, and the
       box has to be sized for the widest of the two or the word is clipped —
       "1 FREE ITEM" overflowed a 50-unit box on the first build. */
    const R = 118, FLAG_GAP = 24, FLAG_W = 50, FLAG_TEXT_W = 68, FLAG_H = 30;
    const REACH = R + FLAG_GAP + Math.max(FLAG_W, FLAG_TEXT_W) / 2 + 2;
    const BOX = Math.ceil(REACH * 2);
    const CX = BOX / 2, CY = BOX / 2;
    svg.setAttribute("viewBox", `0 0 ${BOX} ${BOX}`);
    const TOTAL = WHEEL_SEGMENTS.reduce((sum, seg) => sum + seg.weight, 0);
    const el = (tag, attrs) => {
      const node = document.createElementNS(NS, tag);
      for (const key in attrs) node.setAttribute(key, attrs[key]);
      return node;
    };
    const pointAt = (deg, radius) => {
      const rad = (deg - 90) * Math.PI / 180;
      return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
    };
    /* Every angle below comes out of the WEIGHT, not out of an even division.
       `a0`/`a1` are the segment's edges clockwise from twelve o'clock, so the
       wedge a shopper sees is the chance they are actually running. */
    let cursor = 0;
    WHEEL_SEGMENTS.forEach((seg) => {
      seg.a0 = cursor / TOTAL * 360;
      cursor += seg.weight;
      seg.a1 = cursor / TOTAL * 360;
      seg.span = seg.a1 - seg.a0;
      seg.mid = seg.a0 + seg.span / 2;
      seg.pct = seg.weight / TOTAL * 100;
    });

    const defs = el("defs", {});
    Object.entries(WHEEL_TONES).forEach(([name, [light, dark]]) => {
      const grad = el("linearGradient", { id: `wt-${name}`, x1: "0", y1: "0", x2: "0", y2: "1" });
      grad.append(el("stop", { offset: "0%", "stop-color": light }));
      grad.append(el("stop", { offset: "100%", "stop-color": dark }));
      defs.append(grad);
    });
    /* The face light. A flat ring of coloured wedges is a pie chart; this is
       what turns it into an object with a top-left highlight and a dark rim. */
    const shade = el("radialGradient", { id: "wheelShade", cx: "36%", cy: "30%", r: "80%" });
    [["0%", "rgba(255,255,255,.30)"], ["44%", "rgba(255,255,255,0)"], ["100%", "rgba(0,4,12,.52)"]]
      .forEach(([offset, color]) => shade.append(el("stop", { offset, "stop-color": color })));
    defs.append(shade);
    const rim = el("linearGradient", { id: "wheelRim", x1: "0", y1: "0", x2: ".3", y2: "1" });
    [["0%", "#ffffff"], ["18%", "#9fd8ef"], ["45%", "#2b4f68"], ["62%", "#e8f8ff"], ["100%", "#0b2138"]]
      .forEach(([offset, color]) => rim.append(el("stop", { offset, "stop-color": color })));
    defs.append(rim);
    svg.append(defs);

    const face = el("g", { class: "wheel-face" });
    const flags = el("g", { class: "wheel-flags" });
    svg.append(face, flags);

    /* Labels waiting to be fitted. Declared HERE, above the loop that fills it:
       a `const` further down is in the temporal dead zone while the wedges are
       being drawn, and the whole wheel threw. */
    const pendingFits = [];

    /* A wedge narrower than this cannot hold type inside it, so its name goes
       on a flag outside the rim instead. It is a drawing decision only: the
       wedge itself stays exactly as wide as its odds. */
    const SLIVER = 9;

    WHEEL_SEGMENTS.forEach((seg) => {
      const [x0, y0] = pointAt(seg.a0, R);
      const [x1, y1] = pointAt(seg.a1, R);
      const large = seg.span > 180 ? 1 : 0;
      face.append(el("path", {
        class: `wheel-slice tone-${seg.tone}${seg.top ? " is-top" : ""}${seg.prize ? " is-prize" : ""}`,
        fill: `url(#wt-${seg.tone})`,
        d: `M${CX} ${CY} L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
      }));
      // the hairline between wedges, so two dark TRY AGAINs never merge into one
      const [sx, sy] = pointAt(seg.a0, R);
      face.append(el("path", { class: "wheel-spoke", d: `M${CX} ${CY} L${sx.toFixed(2)} ${sy.toFixed(2)}` }));

      if (seg.span < SLIVER) { buildFlag(seg); return; }

      const artR = seg.span >= 22 ? R * .50 : 0;
      const textR = artR ? R * .80 : R * .68;
      const [tx, ty] = pointAt(seg.mid, textR);
      /* Labels read ALONG the spoke, and the bottom half is flipped so no
         prize is ever printed upside down. */
      const spin = seg.mid > 180 ? seg.mid + 90 : seg.mid - 90;
      const label = el("text", {
        class: `wheel-label tone-${seg.tone}${seg.prize ? " is-prize" : ""}`,
        x: tx.toFixed(2), y: ty.toFixed(2),
        "text-anchor": "middle", "dominant-baseline": "middle",
        transform: `rotate(${spin.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)})`
      });
      const words = seg.label.split(" ");
      words.forEach((word, line) => {
        const span = el("tspan", { x: tx.toFixed(2), dy: line === 0 ? `${-(words.length - 1) * 0.46}em` : "1.02em" });
        span.textContent = word;
        label.append(span);
      });
      face.append(label);
      /* The fit cannot run yet. The wheel is built at page load, inside a
         <dialog> that is still closed and therefore display:none, and getBBox()
         on an unrendered element reports zeroes — so the first version of this
         measured nothing, bailed out silently, and shipped the overflow it was
         written to stop. They are fitted the first time the dialog is actually
         on screen. */
      pendingFits.push([seg, label, textR]);
      if (artR) placeArt(seg, artR, face);
    });

    /* MAKE THE LABEL FIT ITS OWN WEDGE.
       The label reads along the spoke, so a word's LENGTH runs radially and the
       stacked words run TANGENTIALLY — across the wedge. A five-degree wedge is
       about 18 units wide where the type sits, and "FREE DELIVERY" stacked two
       deep is about 21, so the words crossed the spoke into the neighbouring
       segment: the owner's report on 2026-09-12 that "many titles are glitching
       through or under badly". Both extents are measured off the real bounding
       box and the type is scaled until it fits, down to a floor of 6 px — below
       that the label is cut rather than shipped illegible.

       getBBox() is used rather than getBoundingClientRect() because it reports
       the box in the SVG's own units, unrotated, which is the frame the wedge
       is measured in. */
    let labelsFitted = false;
    function fitLabels() {
      if (labelsFitted || !pendingFits.length) return;
      // only once it is genuinely measurable
      try { if (!svg.getBBox().width) return; } catch { return; }
      labelsFitted = true;
      pendingFits.forEach(([seg, label, radius]) => fitLabel(seg, label, radius));
    }

    function fitLabel(seg, label, radius) {
      /* The binding constraint is at the INNER end of the text, not its middle.
         The label reads along the spoke, so its own width is a RADIAL extent and
         its height is a TANGENTIAL one — and a wedge is narrowest nearest the
         hub. Measuring the room at the mid radius said "FREE DELIVERY" fitted a
         5% wedge with 5% to spare; at the inner end of the same label there was
         two thirds of that room and the words crossed the spoke into the next
         segment. That is the owner's "titles glitching through or under badly".

         Two passes, because shrinking the type changes the box it is measured
         from. getBBox() rather than getBoundingClientRect(): the former reports
         the unrotated box in the SVG's own units, which is the frame the wedge
         is measured in. */
      for (let pass = 0; pass < 2; pass += 1) {
        let box;
        try { box = label.getBBox(); } catch { return; }
        if (!box || !box.height) return;
        const inner = Math.max(14, radius - box.width / 2);
        const arc = 2 * Math.PI * inner * (seg.span / 360) * 0.86;  // tangential room where it is tightest
        const spoke = (R - 30) * 0.94;                              // radial room, hub to rim
        const over = Math.max(box.height / arc, box.width / spoke);
        if (over <= 1) return;
        const base = parseFloat(getComputedStyle(label).fontSize) || 9.4;
        const next = base / over;
        if (next < 5.6) { label.remove(); return; }                 // illegible is worse than absent
        label.style.fontSize = `${next.toFixed(2)}px`;
      }
    }

    /* A brand mark is the real file at its real colours on a light chip — a
       trademark is never recoloured and never printed straight onto a coloured
       wedge where it would go unreadable. A line icon takes the wedge's ink
       colour through the inline sprite. */
    function placeArt(seg, radius, host, scale = 1) {
      const [ax, ay] = pointAt(seg.mid, radius);
      const spin = seg.mid > 180 ? seg.mid + 180 : seg.mid;
      const g = el("g", { transform: `rotate(${spin.toFixed(2)} ${ax.toFixed(2)} ${ay.toFixed(2)})` });
      if (seg.brandArt) {
        const brand = window.PRIZE_ART?.brand?.[seg.brandArt];
        if (!brand) return;
        const w = 42 * scale, h = w * (brand.h / brand.w);
        g.append(el("rect", { class: "wheel-chip", x: (ax - w / 2 - 4).toFixed(2), y: (ay - h / 2 - 4).toFixed(2),
          width: (w + 8).toFixed(2), height: (h + 8).toFixed(2), rx: 4 }));
        g.append(el("image", { href: brand.src, x: (ax - w / 2).toFixed(2), y: (ay - h / 2).toFixed(2),
          width: w.toFixed(2), height: h.toFixed(2), preserveAspectRatio: "xMidYMid meet" }));
      } else if (seg.art) {
        const size = 26 * scale;
        const use = el("use", { class: `wheel-art tone-${seg.tone}`, href: `#prize-${seg.art}`,
          x: (ax - size / 2).toFixed(2), y: (ay - size / 2).toFixed(2), width: size, height: size });
        g.append(use);
      } else return;
      host.append(g);
    }

    /* A 1% prize is 3.6 degrees wide. It is drawn 3.6 degrees wide, and its
       name goes on a flag outside the rim with a hairline back to the wedge, so
       the wheel can show a jackpot without ever overstating the chance of it. */
    function buildFlag(seg) {
      const [ix, iy] = pointAt(seg.mid, R);
      const [ox, oy] = pointAt(seg.mid, R + FLAG_GAP - FLAG_H / 2);
      flags.append(el("path", { class: `wheel-flag-stem tone-${seg.tone}`, d: `M${ix.toFixed(2)} ${iy.toFixed(2)} L${ox.toFixed(2)} ${oy.toFixed(2)}` }));
      const [fx, fy] = pointAt(seg.mid, R + FLAG_GAP);
      const w = seg.brandArt ? FLAG_W : FLAG_TEXT_W, h = FLAG_H;
      const g = el("g", { class: `wheel-flag tone-${seg.tone}` });
      g.append(el("rect", { class: "wheel-flag-box", x: (fx - w / 2).toFixed(2), y: (fy - h / 2).toFixed(2), width: w, height: h, rx: 6 }));
      if (seg.brandArt) {
        const brand = window.PRIZE_ART?.brand?.[seg.brandArt];
        if (brand) {
          const bw = 42, bh = bw * (brand.h / brand.w);
          g.append(el("image", { href: brand.src, x: (fx - bw / 2).toFixed(2), y: (fy - bh / 2).toFixed(2),
            width: bw, height: bh, preserveAspectRatio: "xMidYMid meet" }));
        }
      } else if (seg.art) {
        g.append(el("use", { class: `wheel-art tone-${seg.tone}`, href: `#prize-${seg.art}`,
          x: (fx - 8).toFixed(2), y: (fy - 13).toFixed(2), width: 16, height: 16 }));
        const t = el("text", { class: "wheel-flag-text", x: fx.toFixed(2), y: (fy + 9.5).toFixed(2), "text-anchor": "middle" });
        t.textContent = seg.label;
        g.append(t);
      }
      flags.append(g);
    }

    face.append(el("circle", { class: "wheel-shade", cx: CX, cy: CY, r: R, fill: "url(#wheelShade)" }));
    face.append(el("circle", { class: "wheel-rim", cx: CX, cy: CY, r: R, stroke: "url(#wheelRim)" }));
    // the lamps around the rim: the one thing that makes a wheel read as a wheel
    const LAMPS = 24;
    for (let i = 0; i < LAMPS; i += 1) {
      const [lx, ly] = pointAt(i * (360 / LAMPS), R - 7.5);
      const lamp = el("circle", { class: "wheel-lamp", cx: lx.toFixed(2), cy: ly.toFixed(2), r: 2.6 });
      lamp.style.setProperty("--lamp", String(i % 4));
      face.append(lamp);
    }

    /* The outcomes existed only as <text> inside an aria-hidden SVG, so a blind
       visitor spent their one spin without being told what was on the wheel.
       Same data, in a list a screen reader can read, plus the odds. */
    const readable = document.querySelector("[data-wheel-list]");
    if (readable) {
      readable.replaceChildren(...WHEEL_SEGMENTS.map((seg) => {
        const item = document.createElement("li");
        item.textContent = seg.sub ? `${seg.label} — ${seg.sub}` : seg.label;
        return item;
      }));
    }
    /* THE ODDS, merged one row per OUTCOME — the five TRY AGAIN segments are the
       same outcome and nobody wants four rows of 14%. They are NOT rendered on
       the storefront: the owner asked on 2026-09-12 that the numbers stay
       private. They are returned to wheel-lab.html, which is the internal bench
       and is noindex. The wheel itself is still drawn from the real weights, so
       withholding the numbers does not overstate anything — a 1% prize is a
       3.6-degree sliver either way. */
    const mergedOdds = () => {
      const merged = [];
      WHEEL_SEGMENTS.forEach((seg) => {
        const same = merged.find((row) => row.label === seg.label);
        if (same) { same.pct += seg.pct; return; }
        merged.push({ label: seg.label, sub: seg.sub, tone: seg.tone, pct: seg.pct,
                      prize: seg.prize, art: seg.art, brandArt: seg.brandArt });
      });
      return merged.sort((a, b) => b.pct - a.pct);
    };
    /* THE ODDS ARE PRIVATE ON THE STOREFRONT AND REQUIRED ON THE BENCH, and this
       line did not know the difference. The owner made the percentages private
       on 2026-09-12 — "for me only to know, shouldn't be known to public" — so
       this strips the <details> off the wheel dialog. But the storefront has no
       such element to strip: the only `[data-wheel-odds]` in the project is in
       wheel-lab.html, which is the page the odds were MOVED TO. beast.js runs
       before wheel-lab.js, so this deleted the bench's table out from under it
       and the one place the owner can read their own odds has been empty ever
       since, silently, with no console error. Found by an audit 2026-09-12.
       `window.__beastLab` is set by wheel-lab.html's own inline <head> script. */
    if (oddsList && !window.__beastLab) oddsList.closest("details")?.remove();

    /* Yesterday's keys are swept on the way past: the lock is one row, but a
       browser left open for a year should not accumulate 365 of them. */
    const spunThisSession = () => { try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith("beast-wheel-spun-") && key !== WHEEL_SPUN_KEY) localStorage.removeItem(key);
      }
      return localStorage.getItem(WHEEL_SPUN_KEY) === "1";
    } catch { return false; } };
    const markSpun = () => { try { localStorage.setItem(WHEEL_SPUN_KEY, "1"); } catch { /* private mode */ } };
    const heldPrize = () => window.StockUp?.getPrize?.() || null;
    // a spin is refused by EITHER rule: one a session, and never over a prize
    const canSpin = () => !spunThisSession() && !heldPrize();

    function pickSegment() {
      let roll = Math.random() * TOTAL;
      for (let i = 0; i < N; i += 1) {
        roll -= WHEEL_SEGMENTS[i].weight;
        if (roll <= 0) return i;
      }
      return N - 1;
    }

    function showBandPrize() {
      const prize = heldPrize();
      band.classList.toggle("has-prize", !!prize);
      if (prize) {
        bandTitle.textContent = `YOU WON ${prize.label}`;
        bandSub.textContent = prize.note || "Honored in person.";
      } else if (spunThisSession()) {
        bandTitle.textContent = "NO LUCK THIS TIME";
        bandSub.textContent = "That was the spin for today.";
      }
      const chip = band.querySelector("[data-spin-go]");
      if (!canSpin() && !spinning) {
        spinButton.classList.add("is-done");
        spinButton.querySelector("span").textContent = prize ? "SEE MY LIST" : "CLOSE";
        if (chip) chip.textContent = prize ? "WON" : "DONE";
        /* A DAY, not A VISIT, and HONORED, not HONOURED. The lock became a dated
           localStorage key on 2026-09-13 and index.html was updated to match — but
           this line overwrote the correct markup one frame after load, so the
           dialog reverted to the retired rule at exactly the moment the rule
           bit. The British spelling was the only one on a Temecula storefront. */
        if (eyebrow) eyebrow.textContent = prize ? "ALREADY WON · HONORED IN PERSON" : "ONE SPIN A DAY · HONORED IN PERSON";
        if (prize && result) {
          result.textContent = `${prize.label}${prize.note ? ` — ${prize.note}` : ""}. It is on your pickup list.`;
          result.classList.add("is-win");
        }
      }
    }

    /* The needle ticks. Which segment is under twelve o'clock is a pure
       function of the disc's current rotation, so the kick fires on the frame
       the boundary actually crosses rather than on a timer that drifts out of
       step with the easing. */
    let lastUnder = -1;
    function segmentUnderNeedle(rotation) {
      const at = ((-rotation % 360) + 360) % 360;
      for (let i = 0; i < N; i += 1) if (at >= WHEEL_SEGMENTS[i].a0 && at < WHEEL_SEGMENTS[i].a1) return i;
      return 0;
    }
    function tickNeedle(rotation) {
      const under = segmentUnderNeedle(rotation);
      if (under === lastUnder) return;
      lastUnder = under;
      if (!needle || reduced) return;
      gsap.killTweensOf(needle);
      gsap.fromTo(needle, { rotate: -13 }, { rotate: 0, duration: .26, ease: "elastic.out(1,.34)" });
    }

    let spinning = false;
    let turns = 0;
    function spin(forceId) {
      if (spinning || !canSpin() || spinButton.getAttribute("aria-disabled") === "true") return;
      spinning = true;
      /* aria-disabled, not disabled: a disabled button loses focus instantly,
         so pressing SPIN left the keyboard on <body> for the whole spin and
         left it there. It stays focusable and the handler returns early. */
      spinButton.setAttribute("aria-disabled", "true");
      dialog.classList.add("is-spinning");
      result.textContent = "";
      result.classList.remove("is-win");
      const forced = forceId ? WHEEL_SEGMENTS.findIndex((seg) => seg.id === forceId) : -1;
      const index = forced >= 0 ? forced : pickSegment();
      const segment = WHEEL_SEGMENTS[index];
      /* Land the CENTRE of the chosen segment under the needle at twelve
         o'clock, plus jitter that is a fraction of THAT segment's own span —
         a fixed jitter of 0.17 of an even step would have thrown a 3.6-degree
         sliver clean off the needle and landed the spin on its neighbour. */
      const jitter = (Math.random() * 2 - 1) * segment.span * .30;
      turns += 6 + Math.floor(Math.random() * 2);
      const target = turns * 360 - segment.mid + jitter;
      const land = () => {
          spinning = false;
          dialog.classList.remove("is-spinning");
          markSpun();
          if (segment.prize) {
            /* Only the id crosses over. script.js owns the label, the minimum
               and what the prize is worth to the list in front of the shopper;
               passing free text let a forged localStorage entry print a second
               "Estimated cash total" line inside the copied request. */
            window.StockUp?.setPrize?.({ id: segment.id });
            result.textContent = segment.sub
              ? `${segment.label} — ${segment.sub}. It is on your pickup list.`
              : `${segment.label}. It is on your pickup list.`;
            result.classList.add("is-win");
            showTicket(segment.id);
          } else {
            result.textContent = "No prize this time.";
          }
          spinButton.classList.add("is-done");
          spinButton.removeAttribute("aria-disabled");
          spinButton.querySelector("span").textContent = segment.prize ? "SEE MY LIST" : "CLOSE";
          showBandPrize();
          /* Escaping the dialog mid-spin used to award the prize in silence:
             the result lands in a role="status" inside a display:none dialog. */
          if (dialog.open && !segment.prize) spinButton.focus();
          else if (!dialog.open) window.StockUp?.announce?.(result.textContent);
      };
      if (reduced) {                       // asked for less movement: no spin
        disc.style.transform = `rotate(${target}deg)`;
        land();
      } else if (hasGsap) {
        lastUnder = -1;
        gsap.to(disc, { rotation: target, duration: 5.2, ease: "power4.out",
          onUpdate() { tickNeedle(Number(gsap.getProperty(disc, "rotation")) || 0); },
          onComplete: land });
      } else {                             // vendor bundle failed; CSS can do this
        disc.style.transition = "transform 5.2s cubic-bezier(.16,1,.3,1)";
        disc.style.transform = `rotate(${target}deg)`;
        setTimeout(land, 5300);
      }
    }

    /* ---------- the ticket ----------
       Owner, 2026-09-12: "every winning shows the popup — mega fancy, ultra
       shiny, tilt, golden MrBeast ticket with what was won." The prize, the
       art and the terms are markup; the foil, the tilt and the glint are the
       only things that need motion, and none of them carry information. */
    const ticketDialog = document.querySelector("[data-ticket-dialog]");
    const ticket = document.querySelector("[data-ticket]");
    let tiltBound = false;
    function showTicket(id) {
      const seg = WHEEL_SEGMENTS.find((item) => item.id === id);
      if (!ticketDialog || !ticket || !seg || !seg.prize) return;
      ticket.dataset.tone = seg.tone || "gold";
      ticketDialog.querySelector("[data-ticket-label]").textContent = seg.label;
      ticketDialog.querySelector("[data-ticket-terms]").textContent = seg.terms;
      ticketDialog.querySelector("[data-ticket-note]").textContent = seg.sub || "NO MINIMUM";
      const art = ticketDialog.querySelector("[data-ticket-art]");
      if (art) {
        art.replaceChildren();
        if (seg.brandArt) {
          const brand = window.PRIZE_ART?.brand?.[seg.brandArt];
          if (brand) {
            const img = document.createElement("img");
            img.className = "ticket-brand";
            img.src = brand.src; img.width = brand.w; img.height = brand.h; img.alt = "";
            art.append(img);
          }
        } else if (seg.art && window.PRIZE_ART?.icon) {
          art.append(window.PRIZE_ART.icon(seg.art, "ticket-icon"));
        }
      }
      root.classList.add("dialog-open");
      ticketDialog.showModal();
      ticketDialog.querySelector("[data-ticket-list]")?.focus();
      bindTilt3d();
      if (hasGsap && !reduced) {
        gsap.killTweensOf(ticket);
        gsap.fromTo(ticket,
          { yPercent: 26, scale: .72, opacity: 0, rotateZ: -7 },
          { yPercent: 0, scale: 1, opacity: 1, rotateZ: 0, duration: .82, ease: "back.out(1.5)" });
        gsap.fromTo(ticketDialog.querySelector(".ticket-rays"),
          { opacity: 0, scale: .5, rotate: 0 },
          { opacity: 1, scale: 1, rotate: 26, duration: 1.1, ease: "power3.out" });
        gsap.fromTo(ticket.querySelector(".ticket-glint"),
          { xPercent: -160 }, { xPercent: 160, duration: 1.15, ease: "power2.inOut", delay: .45, repeat: 1, repeatDelay: 1.4 });
      }
    }

    /* The tilt. A pointer on a desktop, the device's own orientation on a
       phone — the owner asked for "tilt device stuff" and a phone has no
       pointer to follow. iOS needs an explicit permission grant for
       deviceorientation and will not give it without a user gesture, so this
       never asks: it listens, and if nothing ever arrives the card simply does
       not tilt. Reduced motion switches the whole thing off. */
    function bindTilt3d() {
      if (tiltBound || reduced || !ticket) return;
      tiltBound = true;
      const stage = ticketDialog.querySelector("[data-ticket-stage]");
      const setTilt = (rx, ry) => {
        const clamp = (v) => Math.max(-14, Math.min(14, v));
        ticket.style.setProperty("--rx", `${clamp(rx).toFixed(2)}deg`);
        ticket.style.setProperty("--ry", `${clamp(ry).toFixed(2)}deg`);
        // the foil sweep follows the tilt, which is what sells it as foil
        ticket.style.setProperty("--foil", `${(50 + clamp(ry) * 2.6).toFixed(1)}%`);
      };
      stage?.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch") return;
        const box = ticket.getBoundingClientRect();
        setTilt(-((event.clientY - box.top) / box.height - .5) * 22,
                ((event.clientX - box.left) / box.width - .5) * 26);
      }, { passive: true });
      stage?.addEventListener("pointerleave", () => setTilt(0, 0), { passive: true });
      window.addEventListener("deviceorientation", (event) => {
        if (!ticketDialog.open) return;
        if (event.beta === null && event.gamma === null) return;
        setTilt(-((Number(event.beta) || 0) - 40) * .4, (Number(event.gamma) || 0) * .5);
      }, { passive: true });
    }

    ticketDialog?.addEventListener("close", () => {
      root.classList.toggle("dialog-open", dialog.open);
      if (dialog.open) spinButton.focus();
    });
    ticketDialog?.querySelector("[data-close-ticket]")?.addEventListener("click", () => ticketDialog.close());
    ticketDialog?.querySelector("[data-ticket-list]")?.addEventListener("click", () => {
      ticketDialog.close();
      closeWheel();
      document.querySelector("[data-open-cart]")?.click();
    });

    let lastWheelFocus = null;
    const openWheel = (event) => {
      lastWheelFocus = event?.currentTarget || document.activeElement;
      root.classList.add("dialog-open");
      dialog.showModal();
      fitLabels();
    };
    const closeWheel = () => { if (dialog.open) dialog.close(); };
    openers.forEach((node) => node.addEventListener("click", openWheel));
    dialog.querySelector("[data-close-wheel]")?.addEventListener("click", closeWheel);
    dialog.addEventListener("close", () => {
      root.classList.toggle("dialog-open", !!ticketDialog?.open);
      lastWheelFocus?.focus?.();
    });
    /* Chromium reports the <dialog> element itself as the target of a press on
       its own modal backdrop, so containment is not the test — geometry is.
       The claw already learned this the hard way. */
    const backdropCloses = (node, close) => node?.addEventListener("click", (event) => {
      if (event.target !== node) return;
      const box = node.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right
        && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) close();
    });
    backdropCloses(dialog, closeWheel);
    backdropCloses(ticketDialog, () => ticketDialog.close());

    /* The sheen is an infinite animation, so it obeys the same rule the hero
       loops do: not while it is off screen, not while the tab is hidden. */
    let bandInView = true;
    const bandLive = () => band.classList.toggle("is-still", !(bandInView && !document.hidden));
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver((entries) => { bandInView = entries[0].isIntersecting; bandLive(); },
        { rootMargin: "80px" }).observe(band);
    }
    document.addEventListener("visibilitychange", bandLive);
    bandLive();

    spinButton.addEventListener("click", () => {
      if (!spinButton.classList.contains("is-done")) { spin(); return; }
      closeWheel();
      if (heldPrize()) document.querySelector("[data-open-cart]")?.click();
    });
    showBandPrize();
    band.classList.add("is-ready");

    /* The test surface, and what wheel-lab.html drives. `preview` shows a
       ticket without touching the cart or the spin lock; `force` runs a real
       spin at a named segment. Neither invents a prize: both look the id up in
       the same table the wheel was drawn from. */
    window.BeastWheel = Object.freeze({
      segments: WHEEL_SEGMENTS.map((seg) => ({ id: seg.id, label: seg.label, pct: seg.pct, prize: seg.prize, tone: seg.tone })),
      // the bench prints these; the storefront does not
      odds: mergedOdds,
      preview: (id) => showTicket(id),
      /* BENCH TOOLS. `force` lands the wheel on any segment you name and `reset`
         clears the spin lock — they exist for wheel-lab.html, and they were
         shipping to the storefront where anyone with a console could spin
         themselves a FREE CAR. The prize is stated and never subtracted, and the
         seller honours it in person, so this was never a way to take money — but
         a page that sells things should not carry a "win anything" button.
         Gated 2026-09-12 on the same flag the odds table uses. */
      force: (id) => { if (!window.__beastLab) return; try { localStorage.removeItem(WHEEL_SPUN_KEY); } catch { /* private mode */ }
        window.StockUp?.setPrize?.(null);
        spinButton.classList.remove("is-done");
        spinButton.querySelector("span").textContent = "SPIN";
        spin(id); },
      reset: () => { if (!window.__beastLab) return;
        try { localStorage.removeItem(WHEEL_SPUN_KEY); } catch { /* private mode */ }
        window.StockUp?.setPrize?.(null);
        spinning = false;
        spinButton.classList.remove("is-done");
        spinButton.removeAttribute("aria-disabled");
        spinButton.querySelector("span").textContent = "SPIN";
        if (result) { result.textContent = ""; result.classList.remove("is-win"); }
        showBandPrize(); },
      open: openWheel
    });
  }());

  if (!motion) {
    root.classList.add("reduced");
    document.querySelector("[data-boot]")?.remove();
    /* THE PODIUM STILL HAS TO BE SOLVED. This return used to sit ABOVE
       layoutStage(), so a reduced-motion visit or a failed GSAP load fell back
       to the CSS defaults in .hero-bottle — left:50% top:80% 120x240 — and all
       four bottles stacked on the same spot beside the podium, which read as a
       hero with one product in it. The solver is pure geometry and has no
       dependency on GSAP; it is above this branch now and runs on both paths. */
    layoutStage();
    document.querySelectorAll(".product-grid").forEach(bindDrag);
    if (shelvesRoot && "MutationObserver" in window) {
      new MutationObserver(() => { decorateShelves(); document.querySelectorAll(".product-grid").forEach(bindDrag); }).observe(shelvesRoot, { childList: true });
    }
    return;
  }

  root.classList.add("motion");

  /* If the <head> failsafe already revealed the page, `motion`'s hidden states
   would blank a hero the visitor is looking at for as long as the asset wait
   takes — measured at ~150 ms even after the entrance was made to seek rather
   than play. `late-boot` neutralises those hidden states from the same frame. */

  if (window.__bootReleased) root.classList.add("late-boot");
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: "power3.out", duration: 1 });
  /* wheel-lab.html is the wheel and the ticket with no hero and no shop around
     them, so two dozen hero tweens legitimately find nothing and GSAP says so
     for each one. A bench whose console is full of warnings is a bench nobody
     reads the console of. Only the bench sets this; the storefront keeps every
     warning, because there a missing target is a real defect. */
  if (window.__beastLab) gsap.config({ nullTargetWarn: false });
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- split text ---------- */
  function splitText(node) {
    if (node.classList.contains("is-split")) return [];
    // one <span> per letter reads out as "T. H. E. W. H. O. L. E." unless the
    // heading carries its own name and the letters are hidden from the tree
    node.setAttribute("aria-label", [...node.childNodes]
      .map((child) => (child.nodeName === "BR" ? " " : child.textContent))
      .join("").replace(/\s+/g, " ").trim());
    const chars = [];
    const walk = (parent) => {
      [...parent.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((piece) => {
            if (!piece) return;
            if (/^\s+$/.test(piece)) { frag.append(document.createTextNode(" ")); return; }
            const word = document.createElement("span");
            word.className = "w";
            [...piece].forEach((letter) => {
              const span = document.createElement("span");
              span.className = "ch";
              span.textContent = letter;
              word.append(span);
              chars.push(span);
            });
            frag.append(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
          walk(child);
        }
      });
    };
    walk(node);
    node.querySelectorAll(".w").forEach((word) => word.setAttribute("aria-hidden", "true"));
    node.classList.add("is-split");
    return chars;
  }

  /* ---------- one-shot chrome shine ---------- */
  function shine(nodes) {
    gsap.utils.toArray(nodes).forEach((node) => {
      node.classList.remove("is-shining");
      void node.offsetWidth;
      node.classList.add("is-shining");
      node.addEventListener("animationend", () => node.classList.remove("is-shining"), { once: true });
    });
  }

  /* ---------- boot + hero intro ---------- */
  const boot = document.querySelector("[data-boot]");
  const bootBar = document.querySelector("[data-boot-bar]");
  const bootedBefore = (() => { try { return sessionStorage.getItem("beast-booted") === "1"; } catch { return false; } })();
  /* Unless the <head> failsafe already gave up on the splash — see its comment.
     Re-locking the page after it has been released is worse than a slow boot. */
  if (!window.__bootReleased) document.body.classList.add("is-booting");
  /* STAND THE <head> FAILSAFE DOWN THE MOMENT THIS FILE IS ALIVE — here, not
     inside releaseBoot(). releaseBoot() is NOT on the happy path: the splash is
     removed by finishBoot's timeline onComplete and `is-booting` by the intro's
     own callback, so the clearTimeout inside it never ran and the head timer
     fired at head+9s on EVERY load. Harmless once the boot is finished; on a
     slow load it is not harmless at all, because `html.motion` is already on and
     the hero copy, the price and the bottles are at opacity 0 until the intro
     plays them in — so the failsafe took the splash off an EMPTY SCENE and held
     it blank for the best part of a second. Measured with beast.js delayed 8.6s:
     failsafe at 9018 ms, copy opacity 0, price opacity 0, blank hero for 940 ms.
     Found by an audit 2026-09-12.
     Nothing is lost by clearing it: this file carries its own 8-second deadline
     plus `error` and `unhandledrejection` handlers, which is the cover the head
     timer was standing in for. */
  clearTimeout(window.__bootDeadline);
  window.__bootDeadline = null;

  /* A full-screen overlay that only ever comes down from JavaScript is one
     uncaught error away from hiding the whole site. Three ways out: a hard
     deadline, a script error, and a rejected promise. */
  let bootReleased = false;
  function releaseBoot() {
    if (bootReleased) return;
    bootReleased = true;
    clearTimeout(bootDeadline);
    /* The failsafe in <head> exists for the case where THIS FILE never runs.
       It has, so stand it down — otherwise its 9-second timer would fire in the
       middle of a slow first visit and yank an overlay this file is managing. */
    clearTimeout(window.__bootDeadline);
    document.body.classList.remove("is-booting");
    document.querySelector("[data-boot]")?.remove();
  }
  const bootDeadline = setTimeout(releaseBoot, 8000);
  window.addEventListener("error", releaseBoot);
  window.addEventListener("unhandledrejection", releaseBoot);

  function waitForHeroAssets(onProgress) {
    const images = [...document.querySelectorAll(".hero-plate img, [data-hero-product]")];
    let done = 0;
    const total = images.length + 1;
    const tick = () => { done += 1; onProgress(done / total); };
    const waits = images.map((img) => (img.complete && img.naturalWidth > 0)
      ? Promise.resolve(tick())
      : new Promise((resolve) => { const finish = () => { tick(); resolve(); }; img.addEventListener("load", finish, { once: true }); img.addEventListener("error", finish, { once: true }); }));
    const fonts = (document.fonts?.ready || Promise.resolve()).then(tick);
    return Promise.race([Promise.all([...waits, fonts]), new Promise((resolve) => setTimeout(resolve, 4000))]);
  }

  /* The plate settles from 1.05, not 1.12, and only on the first view of a
     session. A big zoom on every load reads as the page resizing itself. */
  const plateFrom = bootedBefore ? { scale: 1, opacity: .45 } : { scale: 1.05, opacity: .4 };
  const heroIntro = gsap.timeline({ paused: true, defaults: { ease: "expo.out" }, onComplete: heroSettled });
  heroIntro
    .fromTo("[data-flash]", { opacity: 0 }, { opacity: .45, duration: .1, ease: "power1.in" }, 0)
    .to("[data-flash]", { opacity: 0, duration: 1, ease: "power2.out" }, .1)
    .fromTo(".hero-plate", plateFrom, { scale: 1, opacity: 1, duration: 1.5 }, 0)
    .set(".hero-copy-in", { opacity: 1 }, .1)
    .fromTo("[data-hero-beast]", { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2 }, .15)
    .add(() => shine("[data-hero-beast] .chrome"), .5)
    .fromTo("[data-hero-stock]", { x: -50, opacity: 0, rotate: -6 }, { x: 0, opacity: 1, rotate: 0, duration: 1 }, .38)
    .fromTo("[data-hero-line]", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .08, immediateRender: false }, .6)
    .fromTo("[data-hero-price]", { opacity: 0, scale: .88 }, { opacity: 1, scale: 1, duration: 1.2 }, .5)
    .add(() => shine("[data-hero-price] .chrome"), .95)
    .fromTo("[data-hero-glow]", { opacity: 0 }, { opacity: 1, duration: 1.2 }, .8)
    .fromTo("[data-hero-bottle]", { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, stagger: .1 }, .7)
    .add(() => { bootReleased = true; clearTimeout(bootDeadline); document.body.classList.remove("is-booting"); ScrollTrigger.refresh(); }, 1.3);

  function finishBoot() {
    try { sessionStorage.setItem("beast-booted", "1"); } catch { /* private mode */ }
    if (!boot) {
      introRunning = true;
      /* If the <head> failsafe already took the splash down, the visitor is
         LOOKING AT THE PAGE — and `html.motion` has just re-hidden the copy, the
         price and the bottles for the entrance to play them back in. Animating
         now blanks a hero that is already on screen: measured 152 ms fully blank
         and 502 ms with the copy and price gone, with beast.js 9.5-10.5 s late.
         Seek to the end instead. The entrance is a first impression, and there
         is no first impression left to make. */
      if (window.__bootReleased) heroIntro.progress(1);
      else heroIntro.play();
      return;
    }
    gsap.timeline({ onComplete: () => boot.remove() })
      .to(".boot-in", { y: -24, opacity: 0, duration: .4, ease: "power2.in" })
      .to(boot, { clipPath: "inset(0 0 100% 0)", duration: .8, ease: "expo.inOut" }, "-=.1")
      .add(() => { introRunning = true; heroIntro.play(); }, "-=.5");
  }

  if (boot) {
    gsap.set(boot, { clipPath: "inset(0 0 0% 0)" });
    gsap.fromTo(".boot-in", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .5 });
    const start = performance.now();
    let progress = 0;
    /* The bar follows REAL asset progress and only falls back to a filler when
       the network is faster than the eye. The minimum hold came down from 650 ms
       to 380 ms on 2026-09-11: it is there so the wipe does not stutter, not to
       make the visitor watch a progress bar, and on a warm cache the whole
       screen was a second of nothing. */
    const filler = gsap.to({ v: 0 }, { v: 1, duration: bootedBefore ? .3 : .8, ease: "power2.out", onUpdate() { gsap.set(bootBar, { width: `${Math.max(progress, this.targets()[0].v * .8) * 100}%` }); } });
    waitForHeroAssets((p) => { progress = p; }).then(() => {
      const minimum = bootedBefore ? 160 : 380;
      const wait = Math.max(0, minimum - (performance.now() - start));
      setTimeout(() => { filler.kill(); gsap.to(bootBar, { width: "100%", duration: .25, onComplete: finishBoot }); }, wait);
    });
  } else {
    heroIntro.play();
  }

  /* ---------- the three-stage cycle ----------
     Stage one is in the HTML. Stages two and three, and the dial that drives
     them, are built here after the hero has settled, so a visit with no
     JavaScript, no GSAP or reduced motion gets a complete and honest first
     screen, and the cold load carries four bottle images rather than twelve.
     WCAG 2.2.2: auto-advancing content needs a control. The dial is it — a
     press selects a stage and pauses; pressing the live one starts it again. */
  const STAGE_HOLD = 3;        // the owner asked for three seconds
  let stageIndex = 0;
  let stagePaused = false;
  let stageSwapping = false;
  let stageReady = false;
  let stageHoldCall = null;
  let stageFillTween = null;
  let stageDial = null;
  let heroVisible = true;

  const stageSets = () => (stageBox ? [...stageBox.querySelectorAll(".hero-set")] : []);
  const priceCards = () => (priceDeck ? [...priceDeck.querySelectorAll(".hero-price-card")] : []);

  function buildStageContent() {
    if (!stageBox || !priceDeck) return false;
    const byId = new Map((window.PRODUCTS || []).map((item) => [item.id, item]));
    let built = 0;
    HERO_STAGES.forEach((stage, index) => {
      const chromeLine = (text, huge) => {
        const line = document.createElement("span");
        line.className = "hero-price-line";
        const face = document.createElement("span");
        face.className = huge ? "chrome chrome-price chrome-huge" : "chrome chrome-price";
        face.dataset.text = text;
        face.setAttribute("aria-hidden", "true");
        face.textContent = text;
        line.append(face);
        return line;
      };
      if (index > 0) {
        const card = document.createElement("span");
        card.className = "hero-price-card";
        card.dataset.priceCard = stage.deal;
        card.setAttribute("role", "img");
        card.setAttribute("aria-label", stage.label);
        if (stage.top) card.append(chromeLine(stage.top, false));
        card.append(chromeLine(stage.big, true));
        if (!stage.top) card.classList.add("is-single");
        priceDeck.append(card);

        const set = document.createElement("div");
        set.className = "hero-set";
        set.dataset.heroSet = stage.deal;
        stage.items.forEach((item) => {
          const product = byId.get(item.id);
          if (!product) return;
          const shell = document.createElement("span");
          shell.className = "hero-bottle";
          shell.dataset.bottleId = item.id;
          const inner = document.createElement("span");
          inner.className = "hero-bottle-in";
          inner.dataset.heroBottle = "";
          const cast = document.createElement("i");
          cast.className = "hero-cast";
          cast.setAttribute("aria-hidden", "true");
          const reflect = document.createElement("img");
          reflect.className = "hero-reflect";
          reflect.src = product.image;
          reflect.alt = "";
          /* Stages two and three are built long AFTER the page-wide disarm has
             run, so these two would have been the only draggable images left on
             the site — eight of them, in the hero, which is exactly where a
             visitor grabs. Found by the session-6 proof, not by looking. */
          reflect.draggable = false;
          reflect.setAttribute("aria-hidden", "true");
          const shot = document.createElement("img");
          shot.dataset.heroProduct = "";
          shot.src = product.image;
          shot.alt = product.alt || "";
          shot.draggable = false;
          shot.decoding = "async";
          shell.append(inner);
          inner.append(cast, reflect, shot);
          set.append(shell);
          built += 1;
        });
        if (!set.children.length) { card.remove(); return; }
        stageBox.append(set);
      }
    });
    return built > 0 && stageSets().length === HERO_STAGES.length;
  }

  function buildStageDial() {
    const holder = document.createElement("span");
    holder.className = "hero-dial";
    holder.setAttribute("role", "group");
    holder.setAttribute("aria-label", "Price stage — press to choose one and pause");
    HERO_STAGES.forEach((stage, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.stageDot = String(index);
      /* aria-current marks the stage that is SHOWING; aria-pressed is the
         paused state and belongs only to the live button, which is the toggle.
         Both used to be aria-pressed, so a screen reader said "pressed"
         whether the cycle was running or stopped. */
      button.setAttribute("aria-current", index === stageIndex ? "true" : "false");
      button.setAttribute("aria-label", `Show ${stage.short}`);
      const fill = document.createElement("i");
      button.append(fill);
      button.addEventListener("click", () => {
        if (index === stageIndex) { stagePaused = !stagePaused; syncStageCycle(); }
        else { stagePaused = true; goToStage(index, true); }
        labelStageDial();
      });
      holder.append(button);
    });
    return holder;
  }

  function labelStageDial() {
    if (!stageDial) return;
    [...stageDial.children].forEach((button, index) => {
      const stage = HERO_STAGES[index];
      const live = index === stageIndex;
      button.setAttribute("aria-current", live ? "true" : "false");
      if (live) button.setAttribute("aria-pressed", stagePaused ? "true" : "false");
      else button.removeAttribute("aria-pressed");
      button.setAttribute("aria-label", live
        ? (stagePaused ? `Price stages paused on ${stage.short} — start them again` : `Pause on ${stage.short}`)
        : `Show ${stage.short}`);
    });
  }

  function stageFill(seconds) {
    stageFillTween?.kill();
    const bar = stageDial?.children[stageIndex]?.firstElementChild;
    if (!bar) return;
    /* The dial is three DOTS now, not three bars, so the live one grows from
       nothing rather than filling left to right. scaleX on a 6 px circle read
       as a squashing lozenge. */
    [...stageDial.children].forEach((button) => gsap.set(button.firstElementChild, { scale: 0 }));
    if (seconds <= 0) { gsap.set(bar, { scale: 1 }); return; }
    stageFillTween = gsap.fromTo(bar, { scale: 0 }, { scale: 1, duration: seconds, ease: "none" });
  }

  function queueStageAdvance() {
    stageHoldCall?.kill();
    if (!stageReady || stagePaused || !heroVisible || document.hidden) return;
    stageFill(STAGE_HOLD);
    stageHoldCall = gsap.delayedCall(STAGE_HOLD, () => goToStage((stageIndex + 1) % HERO_STAGES.length, false));
  }

  function syncStageCycle() {
    if (!stageReady) return;
    const live = !stagePaused && heroVisible && !document.hidden;
    if (live) { if (!stageSwapping && !stageHoldCall?.isActive()) queueStageAdvance(); else stageFillTween?.play(); }
    else { stageHoldCall?.kill(); stageFillTween?.pause(); }
    labelStageDial();
  }

  /* The swap. Everything is transform and opacity; nothing here changes layout,
     which is why the deck and the sets are stacked in one grid cell and one
     absolute box. The podium takes the light, the old line-up sinks into it and
     the new one rises out of it. */
  let stagePending = null;
  function goToStage(index, manual) {
    const sets = stageSets(), cards = priceCards();
    if (!stageReady || !sets[index] || !cards[index]) return;
    // a press mid-swap used to be lost on the floor; it queues now
    if (stageSwapping) { stagePending = { index, manual }; return; }
    if (index === stageIndex) return;
    stageHoldCall?.kill();
    stageFillTween?.kill();
    stageSwapping = true;
    const outSet = sets[stageIndex], inSet = sets[index];
    const outCard = cards[stageIndex], inCard = cards[index];
    const outBottles = [...outSet.querySelectorAll("[data-hero-bottle]")];
    const inBottles = [...inSet.querySelectorAll("[data-hero-bottle]")];
    const sweep = stageBox.querySelector("[data-hero-sweep]");
    floatTl?.pause();
    gsap.timeline({
      onComplete() {
        stageSwapping = false;
        gsap.set(outCard, { clearProps: "opacity,transform" });
        rebuildLevitation();
        if (stagePending) {
          const next = stagePending;
          stagePending = null;
          goToStage(next.index, next.manual);
          return;
        }
        if (!manual) queueStageAdvance(); else stageFill(0);
        syncStageCycle();
      }
    })
      .set(sweep, { opacity: 0, scaleX: .28, scaleY: .5, transformOrigin: "50% 50%" }, 0)
      .to(sweep, { opacity: 1, scaleX: 1.06, scaleY: 1.15, duration: .24, ease: "power2.out" }, 0)
      .to(sweep, { opacity: 0, duration: .46, ease: "power2.in" }, .26)
      .to(outBottles, { y: 30, scale: .93, opacity: 0, duration: .3, ease: "power2.in", stagger: { each: .045, from: "edges" } }, 0)
      .to(outCard, { opacity: 0, scale: .82, duration: .26, ease: "power2.in" }, 0)
      .add(() => {
        outSet.classList.remove("is-live");
        inSet.classList.add("is-live");
        outCard.classList.remove("is-live");
        inCard.classList.add("is-live");
        stageIndex = index;
        labelStageDial();
      }, .3)
      .fromTo(inBottles, { y: 52, scale: .95, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .66, ease: "expo.out", stagger: { each: .055, from: "center" } }, .32)
      .fromTo(inCard, { opacity: 0, scale: .86 }, { opacity: 1, scale: 1, duration: .52, ease: "expo.out" }, .34)
      .add(() => shine(inCard.querySelectorAll(".chrome")), .56);
  }

  function startStageCycle() {
    if (stageReady || !motion || !stageBox || !priceDeck) return;
    if (!buildStageContent()) return;
    obstacleCache = null;
    layoutStage();
    stageBox.querySelectorAll(".hero-set:not(.is-live) img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", scheduleStageLayout, { once: true });
    });
    stageDial = buildStageDial();
    document.querySelector("[data-hero-price]")?.append(stageDial);
    const shots = [...stageBox.querySelectorAll(".hero-set:not(.is-live) img[data-hero-product]")];
    Promise.all(shots.map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))
      .then(() => {
        stageReady = true;
        stageDial.classList.add("is-ready");
        layoutStage();
        syncStageCycle();
      });
  }

  /* ---------- levitation ----------
     All four bottles rise together with small offsets, ~9 px, ~5.5 s a cycle.
     Each floor shadow shrinks and lightens on the way up, so the eye reads a
     lifted object rather than a drifting sticker. */
  let floatTl = null;
  function buildLevitation() {
    /* only the live stage: three sets of four would be twelve bottles, eight of
       them behind visibility:hidden, all of them tweening every frame */
    const bottles = gsap.utils.toArray(".hero-set.is-live [data-hero-bottle]");
    if (!bottles.length) return null;
    const tl = gsap.timeline({ paused: true, repeat: -1, yoyo: true, defaults: { ease: "sine.inOut", duration: 2.4 } });
    bottles.forEach((bottle, index) => {
      const img = bottle.querySelector("img[data-hero-product]");
      const cast = bottle.querySelector(".hero-cast");
      const reflect = bottle.querySelector(".hero-reflect");
      const at = index * .18;
      if (img) tl.to(img, { y: -9 }, at);
      if (cast) tl.to(cast, { scaleX: .86, scaleY: .72, opacity: .5 }, at);
      // a mirror image moves the opposite way by the same amount
      // the mirror is foreshortened, so its half of the move is too
      if (reflect) tl.to(reflect, { y: 9 * REFLECT_SQUASH, opacity: .12 }, at);
    });
    return tl;
  }

  /* ---------- periodic chrome shine ----------
     One pass across the lockup, then the price, every ~8 s while the hero is
     on screen. Never a running animation. */
  let shineCall = null;
  function queueShine(delay = 8) {
    shineCall?.kill();
    shineCall = gsap.delayedCall(delay, () => {
      if (!document.hidden) {
        shine("[data-hero-beast] .chrome");
        gsap.delayedCall(.5, () => shine(".hero-price-card.is-live .chrome"));
      }
      queueShine(8);
    });
  }

  /* Rebuilt after every stage change, because the bottles it lifts are gone. */
  function rebuildLevitation() {
    floatTl?.kill();
    floatTl = buildLevitation();
    heroSync();
  }
  let heroSync = () => {};
  /* Resolved the moment the hero entrance finishes. A harness can await this
     instead of sleeping and hoping — which is how the first render of this
     session caught the line-up mid fly-in and read as a hero with one bottle
     in it. Resolves on the reduced-motion path too (see below), so a waiter
     can never hang on a page that simply never animates. */
  let heroSettledResolve = () => {};
  const heroSettledPromise = new Promise((resolve) => { heroSettledResolve = resolve; });

  function heroSettled() {
    introRunning = false;
    obstacleCache = null;
    bindHeroScroll();
    /* The copy the stage solver has to avoid is animated INTO place, so its
       boxes are only final now. Solving before this measured a sentence still
       22 px low and a price block still at scale .88. */
    layoutStage();
    floatTl = buildLevitation();
    const sync = () => {
      const live = heroVisible && !document.hidden;
      /* will-change on eight full-height images is eight composited layers held
         for the life of the page — including while the levitation is paused and
         the hero is thousands of pixels off screen. It follows the loop now. */
      document.querySelectorAll("[data-hero-bottle] img").forEach((node) => { node.style.willChange = "auto"; });
      if (live) {
        document.querySelectorAll(".hero-set.is-live [data-hero-bottle] img")
          .forEach((node) => { node.style.willChange = "transform"; });
      }
      if (live) { floatTl?.play(); queueShine(8); }
      else { floatTl?.pause(); shineCall?.kill(); }
      syncStageCycle();
    };
    heroSync = sync;
    if (hero) {
      // seed from the trigger's real state: a page opened at an anchor, or
      // restored mid-scroll, would otherwise run both loops off screen forever
      const heroTrigger = ScrollTrigger.create({
        trigger: hero, start: "top bottom", end: "bottom top",
        onToggle: (self) => { heroVisible = self.isActive; sync(); },
        onRefresh: (self) => { heroVisible = self.isActive; sync(); }
      });
      heroVisible = heroTrigger.isActive;
    }
    document.addEventListener("visibilitychange", sync);
    sync();
    /* The other two stages are built once the first screen has finished doing
       its job — never during the intro, and never on the critical path. */
    const build = () => { startStageCycle(); sync(); heroSettledResolve(true); };
    if (typeof requestIdleCallback === "function") requestIdleCallback(build, { timeout: 1800 });
    else setTimeout(build, 600);
  }

  /* ---------- bubbles: sprite-cached, desktop only, paused offscreen ---------- */
  const canvas = hero?.querySelector("[data-bubbles]");
  if (canvas && canvas.getContext && isDesktop()) {
    const ctx = canvas.getContext("2d");
    const sprites = new Map();
    let width = 0, height = 0, bubbles = [], running = false, raf = 0, last = 0;
    const sprite = (r, hue) => {
      const key = `${r}-${hue}`;
      if (sprites.has(key)) return sprites.get(key);
      const size = r * 2 + 4;
      const off = document.createElement("canvas");
      off.width = size; off.height = size;
      const c = off.getContext("2d");
      const cx = size / 2, cy = size / 2;
      const g = c.createRadialGradient(cx - r * .35, cy - r * .35, r * .1, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,.22)");
      g.addColorStop(.6, hue === "pink" ? "rgba(255,36,157,.05)" : "rgba(0,213,255,.05)");
      g.addColorStop(.85, hue === "pink" ? "rgba(255,120,200,.3)" : "rgba(141,235,255,.3)");
      g.addColorStop(1, "rgba(255,255,255,.7)");
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
      c.beginPath(); c.arc(cx - r * .38, cy - r * .4, Math.max(1, r * .16), 0, Math.PI * 2); c.fillStyle = "rgba(255,255,255,.8)"; c.fill();
      sprites.set(key, off);
      return off;
    };
    const spawn = (anywhere) => {
      const r = 4 + Math.round(Math.random() * 18);
      return { x: Math.random() * width, y: anywhere ? Math.random() * height : height + 40, r, v: .2 + Math.random() * .5, drift: Math.random() * Math.PI * 2, wobble: .4 + Math.random() * 1, alpha: .35 + Math.random() * .45, img: sprite(r, Math.random() < .3 ? "pink" : "cyan") };
    };
    const resize = () => {
      width = hero.clientWidth; height = hero.clientHeight;
      canvas.width = width; canvas.height = height;
      bubbles = Array.from({ length: Math.min(28, Math.round(width / 50)) }, () => spawn(true));
    };
    const draw = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(draw);
      if (now - last < 33) return;
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (const b of bubbles) {
        b.y -= b.v * 2; b.drift += .012 * b.wobble; b.x += Math.sin(b.drift) * .5;
        if (b.y < -b.r * 2) Object.assign(b, spawn(false));
        ctx.globalAlpha = b.alpha;
        ctx.drawImage(b.img, b.x - b.r - 2, b.y - b.r - 2);
      }
      ctx.globalAlpha = 1;
    };
    let inView = true;
    const play = () => { if (!running) { running = true; raf = requestAnimationFrame(draw); } };
    const pause = () => { running = false; cancelAnimationFrame(raf); };
    // returning to the tab used to restart this unconditionally, so it kept
    // painting a full-viewport canvas with the hero far off screen
    const syncBubbles = () => (inView && !document.hidden ? play() : pause());
    resize(); play();
    window.addEventListener("resize", resize);
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncBubbles(); }, { threshold: 0 }).observe(hero);
    document.addEventListener("visibilitychange", syncBubbles);
  }


  /* ---------- nav ----------
     The bar no longer hides on scroll direction: it dragged the sticky price
     bar 80 px with it every time the scroll reversed, which is what "the site
     is constantly shifting up and down" looked like. */
  const nav = document.querySelector("[data-nav]");
  if (nav) {
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate(self) { nav.classList.toggle("is-solid", self.scroll() > 40); }
    });
    gsap.to("[data-progress]", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: .2 } });
    document.querySelectorAll("[data-nav-link]").forEach((link) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      ScrollTrigger.create({ trigger: target, start: "top 50%", end: "bottom 50%", onToggle: (self) => link.classList.toggle("is-active", self.isActive) });
    });
  }

  /* ---------- reveals ---------- */
  function bindReveals(scope = document) {
    const nodes = [...scope.querySelectorAll("[data-reveal]:not([data-reveal-bound])")];
    nodes.forEach((node) => { node.dataset.revealBound = "1"; });
    if (nodes.length) {
      ScrollTrigger.batch(nodes, { start: "top 90%", once: true, onEnter: (batch) => gsap.fromTo(batch, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .08, overwrite: true }) });
    }
    scope.querySelectorAll("[data-split]:not(.is-split)").forEach((heading) => {
      const chars = splitText(heading);
      heading.classList.add("is-animating");
      gsap.set(heading, { opacity: 1 });
      gsap.set(chars, { yPercent: 110 });
      /* is-animating puts overflow:hidden on the word boxes so the letters can
         slide up out of nothing. onComplete alone did not always run — two of
         the three headings kept the class for the life of the page, and the
         negative letter-spacing then clipped a pixel off the last glyph of
         "PRICE". A timer clears it whether the tween finishes or not. */
      const release = () => heading.classList.remove("is-animating");
      ScrollTrigger.create({
        trigger: heading, start: "top 88%", once: true,
        onEnter: () => {
          gsap.to(chars, { yPercent: 0, duration: .9, ease: "expo.out", stagger: .018, onComplete: release });
          gsap.delayedCall(1.8, release);
        }
      });
    });
  }
  bindReveals();

  /* ---------- the price swap ----------
     Each row in PRICE NOTES carries the store price AND the shelf price in the
     markup. This is the only thing that moves: the store price slides left and
     dims, the gold tag slides in from the right, and a glint crosses it. Both
     figures remain on screen and remain readable afterwards, which is the same
     rule the savings rip follows — the animation is the transition into the
     comparison, never the thing that carries it.

     The rows live inside a <details> that is closed on load, so they measure
     zero and ScrollTrigger would fire every one of them at once the moment it
     opens. The toggle refreshes instead, and the batch is bound lazily. */
  (function bindPriceSwaps() {
    const receipt = document.querySelector("[data-price-sources]");
    if (!receipt) return;
    const bind = () => {
      const rows = [...receipt.querySelectorAll("[data-price-swap]:not([data-swap-bound])")];
      if (!rows.length) return;
      rows.forEach((row) => { row.dataset.swapBound = "1"; });
      ScrollTrigger.batch(rows, {
        start: "top 96%", once: true,
        onEnter: (batch) => batch.forEach((row, i) => gsap.delayedCall(i * .07, () => row.classList.add("is-swapped")))
      });
    };
    receipt.addEventListener("toggle", () => { bind(); ScrollTrigger.refresh(); }, true);
    bind();
    /* script.js re-renders the whole receipt when a display setting changes */
    if ("MutationObserver" in window) new MutationObserver(bind).observe(receipt, { childList: true });
  }());

  /* The price rail's reveal is gone: it lives in the fixed header now and is
     shown by the dock class script.js owns, not by a ScrollTrigger. A trigger
     on an element that sits at the top of the viewport from the first frame is
     a trigger that fires at load, once:true, while the rail is still stowed —
     and then never again. See beast.css's note on .stages. */

  /* ---------- shelves (dynamic from script.js) ---------- */
  let shelfTriggers = [];
  let tiltTweens = [];
  function bindShelves() {
    shelfTriggers.forEach((trigger) => trigger.kill());
    shelfTriggers = [];
    tiltTweens.forEach((tween) => tween.kill());
    tiltTweens = [];
    decorateShelves(shelvesRoot);
    shelvesRoot.querySelectorAll(".product-grid").forEach(bindDrag);
    shelvesRoot.querySelectorAll(".deal-shelf:not([hidden])").forEach((shelf) => {
      const h2 = shelf.querySelector(".shelf-price h3");
      /* The shelf eyebrow was deleted from script.js, and a shelf with no
         pairing rule has no .shelf-info either — both were still being tweened,
         so a full-page scroll logged "GSAP target null not found" four times. */
      const info = shelf.querySelector(".shelf-info");
      const cards = [...shelf.querySelectorAll(".product-card")];
      gsap.set([h2, info].filter(Boolean), { opacity: 0 });
      shelfTriggers.push(ScrollTrigger.create({
        trigger: shelf, start: "top 80%", once: true,
        onEnter: () => {
          gsap.fromTo(h2, { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "expo.out", onComplete: () => shine(h2) });
          if (info) gsap.fromTo(info, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .8, delay: .15 });
          gsap.fromTo(cards, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: .08, ease: "expo.out", clearProps: "transform" });
        }
      }));
      /* WHICH STAGE YOU ARE ON MOVED TO script.js, 2026-09-13. It was a
         ScrollTrigger, which meant a reduced-motion visitor — and any visitor
         whose GSAP failed — had never once seen the live stage underlined,
         because beast.js returns at the motion gate long before this line. It
         is an IntersectionObserver in script.js now, beside the `.is-empty`
         logic that already owned half of this bar's state. Trap 21, again. */
      if (finePointer) cards.forEach(bindTilt);
    });
    ScrollTrigger.refresh();
  }
  function bindTilt(card) {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = "1";
    const rx = gsap.quickTo(card, "rotateX", { duration: .5, ease: "power3" });
    const ry = gsap.quickTo(card, "rotateY", { duration: .5, ease: "power3" });
    tiltTweens.push(rx.tween, ry.tween);
    card.style.transformPerspective = "1200px";
    card.addEventListener("pointermove", (event) => {
      /* Not while the row is being dragged. Pointer capture hides most of this
         — once the grid captures, the cards stop receiving pointermove — but
         the first eight pixels of every gesture happen BEFORE capture, so each
         press kicked a half-second 3-D tween on the card under the hand at the
         exact moment the row started moving under it. */
      if (gridPressing) return;
      const rect = card.getBoundingClientRect();
      rx(-((event.clientY - rect.top) / rect.height - .5) * 4);
      ry(((event.clientX - rect.left) / rect.width - .5) * 5);
    });
    // capture means pointerleave can be the last thing a card hears
    card.addEventListener("pointercancel", () => { rx(0); ry(0); });
    card.addEventListener("pointerleave", () => { rx(0); ry(0); });
  }
  if (shelvesRoot) {
    bindShelves();
    let pending = 0;
    new MutationObserver(() => { cancelAnimationFrame(pending); pending = requestAnimationFrame(bindShelves); }).observe(shelvesRoot, { childList: true });
  }

  /* ---------- add to list: the bottle travels to the pickup list ----------
     The clone starts on the painted pixels, not the image element's box, so it
     leaves exactly where the bottle is standing. --fit is a scale about the
     bottom edge, so the painted rect is mapped through it. */
  function paintedRect(image) {
    const rect = image.getBoundingClientRect();
    const nw = image.naturalWidth || rect.width;
    const nh = image.naturalHeight || rect.height;
    const layoutW = image.offsetWidth || rect.width;
    const layoutH = image.offsetHeight || rect.height;
    if (!nw || !nh || !layoutW || !layoutH) return rect;
    const fit = rect.height / layoutH || 1;
    const contain = Math.min(layoutW / nw, layoutH / nh);
    const paintedW = nw * contain;
    const paintedH = nh * contain;
    return {
      left: rect.left + ((layoutW - paintedW) / 2) * fit,
      top: rect.bottom - (layoutH - (layoutH - paintedH) / 2) * fit,
      width: paintedW * fit,
      height: paintedH * fit
    };
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    if (!button || button.disabled) return;
    const card = button.closest(".product-card");
    const image = card?.querySelector(".product-image-wrap.is-current img") || card?.querySelector("img");
    const onScreen = (node) => !node.hidden && node.getBoundingClientRect().width > 0;
    const targets = [...document.querySelectorAll("[data-open-cart]")].filter(onScreen);
    const target = targets.find((node) => node.classList.contains("mobile-pickup-bar"))
      || targets.find((node) => node.classList.contains("nav-list"))
      || targets[0];
    if (!image || !target) return;
    const from = paintedRect(image);
    const to = target.getBoundingClientRect();
    const clone = image.cloneNode(true);
    clone.className = "fly";
    clone.removeAttribute("loading");
    Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, transform: "none" });
    document.body.append(clone);
    const endX = to.left + to.width / 2 - from.left - from.width / 2;
    const endY = to.top + to.height / 2 - from.top - from.height / 2;
    const lift = Math.min(150, Math.abs(endY) * .45 + 60);
    gsap.timeline({ onComplete: () => clone.remove() })
      .to(clone, { x: endX * .45, y: endY - lift, scale: .62, duration: .38, ease: "power2.out" })
      .to(clone, { x: endX, y: endY, scale: .05, opacity: .85, duration: .37, ease: "power2.in" })
      .fromTo(target, { scale: 1 }, { scale: 1.16, duration: .14, yoyo: true, repeat: 1, ease: "power1.inOut" }, "-=.04");
  });

  /* ---------- rules plates: they rise, the towns land ----------
     The gauge that counted to twenty is gone with the rule it counted toward,
     and so is the tween that drove it. Nothing is left animating a number the
     site no longer states. */
  const plates = document.querySelector("[data-plates]");
  if (plates) {
    gsap.fromTo("[data-plates] .plate", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: .12, ease: "expo.out", scrollTrigger: { trigger: plates, start: "top 82%", once: true } });
    gsap.fromTo("[data-towns] li", { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .06, scrollTrigger: { trigger: "[data-towns]", start: "top 92%", once: true } });
  }

  /* The footer watermark used to parallax ~80px. It was the only scroll-driven
     movement after the fold, which is exactly what the brief rules out. */

  /* ---------- click: a claw rip tears out of the press point ----------
     Asked for twice, and rebuilt four times. The verdict on the last one was
     "subtle, fainted, smaller and like real claws — these look like chicken
     toes, it's embarrassing", and it was right: three fat lenses splayed out of
     one point is a bird's foot. A real rake is four NEAR-PARALLEL hairlines,
     travelling the same way, bowed the same way, of different lengths, tapering
     to nothing at both ends, with a ragged outline rather than a smooth one.
     Generated by scripts/build-claw.py with jitter, so no two edges match.
     The whole rake still spins to a random angle on every click, which is what
     stops it reading as a stamped-on decal. Works on touch. Inside an open
     <dialog> it is appended to the dialog, because a native dialog paints in
     the top layer and anything appended to <body> would burst behind it. */
  const CLAW_GASHES = [
    { d: "M37.50 29.50 L37.41 31.07 L37.39 32.63 L37.31 34.20 L37.25 35.77 L37.30 37.33 L37.23 38.90 L37.26 40.47 L37.21 42.03 L37.26 43.60 L37.19 45.17 L37.25 46.73 L37.10 48.30 L37.09 49.87 L37.06 51.43 L37.28 53.00 L37.11 54.57 L37.10 56.13 L37.15 57.70 L37.23 59.27 L37.21 60.83 L37.25 62.40 L37.15 63.97 L37.26 65.53 L37.26 67.10 L37.23 68.67 L37.33 70.23 L37.36 71.80 L37.34 73.37 L37.41 74.93 L37.50 76.50 L37.50 76.50 L37.79 74.93 L38.06 73.37 L38.28 71.80 L38.54 70.23 L38.78 68.67 L38.96 67.10 L39.08 65.53 L39.32 63.97 L39.45 62.40 L39.54 60.83 L39.63 59.27 L39.73 57.70 L39.84 56.13 L39.83 54.57 L39.70 53.00 L39.85 51.43 L39.79 49.87 L39.82 48.30 L39.71 46.73 L39.64 45.17 L39.43 43.60 L39.29 42.03 L39.19 40.47 L38.94 38.90 L38.67 37.33 L38.55 35.77 L38.29 34.20 L38.06 32.63 L37.78 31.07 L37.50 29.50 Z", r: -4.8 },
    { d: "M45.40 14.50 L45.29 16.80 L45.22 19.10 L45.16 21.40 L45.12 23.70 L45.13 26.00 L45.08 28.30 L44.98 30.60 L45.00 32.90 L45.05 35.20 L44.93 37.50 L45.02 39.80 L44.84 42.10 L44.99 44.40 L44.83 46.70 L44.84 49.00 L44.81 51.30 L44.90 53.60 L44.90 55.90 L44.88 58.20 L44.88 60.50 L44.98 62.80 L44.95 65.10 L44.98 67.40 L45.11 69.70 L45.02 72.00 L45.15 74.30 L45.16 76.60 L45.24 78.90 L45.30 81.20 L45.40 83.50 L45.40 83.50 L45.76 81.20 L46.07 78.90 L46.34 76.60 L46.64 74.30 L46.93 72.00 L47.14 69.70 L47.40 67.40 L47.64 65.10 L47.79 62.80 L48.02 60.50 L48.08 58.20 L48.02 55.90 L48.27 53.60 L48.20 51.30 L48.35 49.00 L48.13 46.70 L48.21 44.40 L48.06 42.10 L48.11 39.80 L47.80 37.50 L47.84 35.20 L47.66 32.90 L47.38 30.60 L47.24 28.30 L46.96 26.00 L46.62 23.70 L46.38 21.40 L46.12 19.10 L45.77 16.80 L45.40 14.50 Z", r: -1.5 },
    { d: "M53.40 18.00 L53.29 20.13 L53.18 22.27 L53.12 24.40 L53.09 26.53 L53.14 28.67 L52.96 30.80 L53.09 32.93 L53.02 35.07 L52.98 37.20 L53.01 39.33 L53.05 41.47 L52.96 43.60 L52.87 45.73 L52.89 47.87 L53.02 50.00 L52.89 52.13 L52.85 54.27 L52.86 56.40 L52.87 58.53 L53.04 60.67 L53.01 62.80 L53.00 64.93 L53.10 67.07 L53.04 69.20 L53.08 71.33 L53.12 73.47 L53.12 75.60 L53.21 77.73 L53.30 79.87 L53.40 82.00 L53.40 82.00 L53.75 79.87 L54.04 77.73 L54.30 75.60 L54.60 73.47 L54.88 71.33 L55.02 69.20 L55.18 67.07 L55.48 64.93 L55.58 62.80 L55.82 60.67 L55.76 58.53 L56.02 56.40 L56.09 54.27 L56.12 52.13 L56.03 50.00 L56.18 47.87 L56.12 45.73 L56.05 43.60 L55.78 41.47 L55.79 39.33 L55.52 37.20 L55.38 35.07 L55.34 32.93 L55.11 30.80 L54.84 28.67 L54.54 26.53 L54.32 24.40 L54.02 22.27 L53.76 20.13 L53.40 18.00 Z", r: 1.7 },
    { d: "M61.20 33.50 L61.13 34.87 L61.03 36.23 L60.98 37.60 L61.04 38.97 L61.01 40.33 L60.91 41.70 L60.88 43.07 L60.92 44.43 L60.96 45.80 L60.81 47.17 L60.92 48.53 L60.85 49.90 L60.98 51.27 L60.74 52.63 L60.78 54.00 L60.91 55.37 L60.91 56.73 L60.75 58.10 L60.92 59.47 L60.89 60.83 L60.96 62.20 L60.83 63.57 L60.88 64.93 L60.90 66.30 L61.00 67.67 L61.02 69.03 L61.00 70.40 L61.05 71.77 L61.12 73.13 L61.20 74.50 L61.20 74.50 L61.49 73.13 L61.73 71.77 L61.91 70.40 L62.15 69.03 L62.38 67.67 L62.54 66.30 L62.66 64.93 L62.81 63.57 L63.01 62.20 L63.01 60.83 L63.18 59.47 L63.16 58.10 L63.20 56.73 L63.35 55.37 L63.40 54.00 L63.31 52.63 L63.18 51.27 L63.16 49.90 L63.23 48.53 L62.99 47.17 L62.92 45.80 L62.79 44.43 L62.74 43.07 L62.52 41.70 L62.35 40.33 L62.09 38.97 L61.91 37.60 L61.69 36.23 L61.48 34.87 L61.20 33.50 Z", r: 4.6 },
  ];
  const clawMarkup = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">`
    + CLAW_GASHES.map((g) => `<g class="claw-slash" style="--cr:${g.r}deg"><path class="claw-tear" d="${g.d}"/><path class="claw-edge" d="${g.d}"/></g>`).join("")
    + `</svg>`;

  function tearClaw(host, x, y) {
    const claw = document.createElement("i");
    claw.className = "claw";
    claw.setAttribute("aria-hidden", "true");
    claw.style.left = `${x}px`;
    claw.style.top = `${y}px`;
    claw.innerHTML = clawMarkup;
    host.append(claw);
    const svg = claw.firstElementChild;
    const gashes = claw.querySelectorAll(".claw-slash");
    const edges = claw.querySelectorAll(".claw-edge");
    const tl = gsap.timeline({ onComplete: () => claw.remove() });
    // a whole-circle random angle plus a little scale jitter: no two rakes alike
    tl.set(svg, { rotate: gsap.utils.random(0, 360), scale: gsap.utils.random(.88, 1.08) })
      // each gash opens from where the claw went in toward where it came out
      .fromTo(gashes, { scaleY: 0 }, { scaleY: 1, duration: .1, ease: "power2.out", stagger: .018 }, 0)
      // the split catches light for a beat and then it is just a dark scratch
      .fromTo(edges, { opacity: .85 }, { opacity: 0, duration: .22, ease: "power2.in" }, .07)
      .to(svg, { opacity: 0, duration: .16, ease: "power1.in" }, .2);
    return tl;
  }

  window.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary) return;
    if (event.target.closest?.("input, textarea, select")) return;
    const openDialog = document.querySelector("dialog[open]");
    /* Geometry, not containment. Chromium reports the <dialog> ELEMENT as the
       target of a press on its modal backdrop, so `openDialog.contains(target)`
       was true for a click three inches outside the dialog and the rip fired on
       the very press that dismissed it. */
    let host = document.body;
    if (openDialog) {
      const box = openDialog.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right
        && event.clientY >= box.top && event.clientY <= box.bottom;
      host = inside ? openDialog : null;
    }
    if (!host) return;                       // a press outside an open dialog is a dismiss, not a hit
    tearClaw(host, event.clientX, event.clientY);
    /* The rip has to land on something or it is just a decal. Anything already
       interactive takes a short rim flash, so the click visibly HITS. Scoped to
       buttons, links and cards so nothing else on the page is ever touched. */
    const struck = event.target.closest?.("button, a[href], .product-card, .plate, .stages a");
    /* .is-clawed adds position:relative so its ::before can sit over the element.
       On a FIXED element that collapses it out of place — the full-screen drawer
       scrim stopped being under the pointer between pointerdown and pointerup, so
       click-to-close silently stopped working. Only in-flow elements get flashed. */
    if (struck && ["static", "relative"].includes(getComputedStyle(struck).position)) {
      struck.classList.remove("is-clawed");
      void struck.offsetWidth;
      struck.classList.add("is-clawed");
      setTimeout(() => struck.classList.remove("is-clawed"), 420);
    }
  }, { passive: true });

  /* ---------- the savings line rips ----------
     Same claw language as the click effect, deliberately — the owner asked for
     one rip, not two unrelated ideas. This animates a band that ALREADY reads
     correctly: "You save $X" over "Same items in a store $Y + tax". The rip is
     the transition into a new number, never the thing that carries it, so a
     screenshot, a reduced-motion visit and a JS-free visit all stay honest. */
  const ripBand = document.querySelector("[data-savings-rip]");
  const ripHost = ripBand?.querySelector("[data-rip-claw]");
  if (ripBand && ripHost) {
    let ripping = null;
    document.addEventListener("stockup:savings-changed", () => {
      const drawer = document.querySelector("[data-cart-drawer]");
      if (!drawer?.classList.contains("is-open")) return;   // do not animate a closed drawer
      ripping?.kill();
      ripHost.innerHTML = clawMarkup;
      const svg = ripHost.firstElementChild;
      const slashes = ripHost.querySelectorAll(".claw-slash");
      const head = ripBand.querySelector(".rip-headline b");
      const store = ripBand.querySelector(".rip-store");
      ripping = gsap.timeline({ onComplete: () => { ripHost.innerHTML = ""; } })
        // a rake across a line of type is diagonal and it travels; a vertical
        // claw parked in the middle of the band just sat there
        .fromTo(svg, { xPercent: -105, yPercent: 14, rotate: -32, opacity: 0, scale: .82 },
                     { xPercent: 105, yPercent: -14, rotate: -20, opacity: 1, scale: 1.04, duration: .38, ease: "power2.inOut" }, 0)
        .to(svg, { opacity: 0, duration: .14, ease: "power2.in" }, .26)
        .fromTo(slashes, { scaleY: .1 }, { scaleY: 1, duration: .14, stagger: .026, ease: "power2.out" }, 0)
        .fromTo(head, { scale: .72, opacity: .25 }, { scale: 1, opacity: 1, duration: .42, ease: "back.out(2.4)" }, .14)
        .fromTo(store, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: .3 }, .24);
    });
  }

  /* ---------- the cursor ----------
     There is no custom cursor. Owner, 2026-09-12: "remove the blue dot cursor."
     The native pointer is back on every surface, so nothing has to be kept in
     sync with it — no dialog hand-back, no is-away on window blur, no hot-spot
     lag. The claw rip below is what marks a press now, and it needs no cursor
     of its own. `dialog-open` is still set on <html> by the dialogs themselves
     because the drawer and the wheel use it for scroll locking. */

  window.addEventListener("load", () => ScrollTrigger.refresh());
  document.fonts?.ready?.then(() => ScrollTrigger.refresh());
  /* The motion layer's test surface. `window.__stageDebug` used to be the only
     hook here and nothing read it — the weakness list said to wire it or delete it.
     This is the wiring: a screenshot of a scene that cycles every three seconds
     is a coin toss without a way to pin it, which is how session 5's hero
     renders kept catching the intro mid-flight. `settled` resolves once the
     hero has finished its entrance, so a harness can wait on the page instead
     of guessing at a timeout. */
  window.BeastMotion = Object.freeze({
    refresh: () => ScrollTrigger.refresh(),
    settled: () => heroSettledPromise,
    /* Awaits readiness. `settled` resolves when the hero ENTRANCE finishes,
       which is before stages two and three have been built and decoded — so a
       harness that awaited settled() and then asked for stage 2 got stage 1 and
       quietly asserted against the wrong scene. It waits now. */
    stage: async (index) => {
      for (let i = 0; i < 120 && !stageReady; i += 1) await new Promise((r) => setTimeout(r, 50));
      stagePaused = true;
      syncStageCycle();
      goToStage(Number(index) || 0, true);
      await new Promise((r) => setTimeout(r, 900));
      return stageIndex;
    },
    pauseStages: () => { stagePaused = true; syncStageCycle(); },
    stageIndex: () => stageIndex,
    debug: () => ({ stage: stageIndex, paused: stagePaused, ready: stageReady, last: window.__stageLast || null })
  });
}());

(function () {
  "use strict";

  const products = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const deals = window.DEAL_DEFINITIONS || {};
  const storageKey = "stock-up-cart-v2";
  const productById = new Map(products.map((item) => [item.id, item]));
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const dealOrder = ["2-for-5", "8-each", "paper-2-for-7", "pricing-pending"];
  const pricedDealOrder = dealOrder.filter((id) => deals[id]?.bundlePrice !== null);
  /* 2 s a card, 7 s of quiet after a visitor touches one. Owner, 2026-09-12:
     "reduce the time to 2 seconds per item"; "as soon as they interact with
     each then it will stop for 7 sec minimum ... if unattended for 7 sec it
     goes back to the loop". The floor of 1200 ms is a readability floor, not
     a preference: below it the name, the price and the Add target change
     faster than they can be read. */
  const variantIntervalMs = Math.max(1200, Number(window.SITE_CONFIG?.catalogVariantIntervalMs) || 2000);
  const variantHoldMs = Math.max(2000, Number(window.SITE_CONFIG?.catalogVariantHoldMs) || 7000);
  /* The headline is the shelf's whole name. There is no eyebrow and no
     explanatory note: an eyebrow naming what is on a shelf goes stale the day
     the stock changes, and every note here used to restate the price printed
     108 px above it. Only the pairing rule survives, on the two shelves that
     actually pair, and it is three words. */
  const dealCopy = {
    "2-for-5": { id: "deal-2-for-5", headline: "2 FOR $5", note: "Mix or match." },
    "8-each": { id: "deal-8-each", headline: "$8 EACH", note: "" },
    "paper-2-for-7": { id: "deal-paper-2-for-7", headline: "2 FOR $7", note: "Mix or match." },
    "pricing-pending": { id: "deal-pricing-pending", headline: "PRICING PENDING", note: "Not on a list until a price is set." }
  };

  const state = {
    cart: loadCart(),
    query: "",
    lastDrawerFocus: null,
    lastDialogFocus: null,
    variantTimer: null,
    deliveryFree: null,
    deliveryJustAnnounced: false,
    prize: null,
    lastSavingsKey: null,
    displaySettings: window.StockUpSettings?.get?.() || { showAvailability: false, showComparisons: true, autoRotateProducts: true }
  };

  const dom = {
    shelves: document.querySelector("[data-product-sections]"),
    search: document.querySelector("[data-search]"),
    resultCount: document.querySelector("[data-results-count]"),
    emptyResults: document.querySelector("[data-empty-results]"),
    shelfError: document.querySelector("[data-shelf-error]"),
    drawer: document.querySelector("[data-cart-drawer]"),
    scrim: document.querySelector("[data-scrim]"),
    cartItems: document.querySelector("[data-cart-items]"),
    cartEmpty: document.querySelector("[data-cart-empty]"),
    cartFooter: document.querySelector("[data-cart-footer]"),
    pairStatus: document.querySelector("[data-pair-status]"),
    checkout: document.querySelector("[data-checkout]"),
    dialog: document.querySelector("[data-checkout-dialog]"),
    orderForm: document.querySelector("[data-order-form]"),
    orderSuccess: document.querySelector("[data-order-success]"),
    orderSummary: document.querySelector("[data-order-summary]"),
    toast: document.querySelector("[data-toast]"),
    mobileBar: document.querySelector(".mobile-pickup-bar"),
    cartFab: document.querySelector(".cart-fab"),
    priceSources: document.querySelector("[data-price-sources]")
  };

  function loadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return new Map();
      const safe = new Map();
      for (const [id, quantity] of Object.entries(parsed)) {
        const product = productById.get(id);
        if (product?.inStock && product.pricingStatus === "active" && Number.isInteger(quantity) && quantity > 0) {
          safe.set(id, Math.min(quantity, product.inventoryQuantity));
        }
      }
      return safe;
    } catch {
      try { localStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
      return new Map();
    }
  }

  function saveCart() {
    try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(state.cart))); } catch { /* Keep the live list usable. */ }
  }

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[&+]/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function matches(product, query) {
    if (!query) return true;
    /* dealGroup is an internal id, not a shopper-facing word. It used to be in
       here harmlessly; once the softeners joined the "paper-2-for-7" shelf,
       typing "paper" returned four bottles of fabric softener. Category still
       carries "Paper goods", so real paper searches still work. */
    const haystack = normalize([
      product.brand, product.name, product.size, product.variant, product.category,
      ...(product.searchTags || [])
    ].join(" "));
    return normalize(query).split(/\s+/).every((term) => haystack.includes(term));
  }

  function imageWithFallback(product, decorative = false) {
    const wrap = document.createElement("div");
    wrap.className = "product-image-wrap";
    const image = document.createElement("img");
    image.src = product.image;
    /* Born undraggable. An <img> is draggable by default, so pressing one and
       moving starts the browser's own image-transfer gesture instead of
       scrolling the row: a translucent ghost of the bottle follows the pointer,
       the row stops tracking, and the gesture ends wherever the OS decides.
       That is the "grabbing side to side glitches badly" the owner reported
       twice, and the screenshots they sent on 2026-09-12 show the ghost.
       It is set HERE, where the element is created, rather than only in the
       motion layer: the cards exist whether or not beast.js ever loads. */
    image.draggable = false;
    image.width = 800;
    image.height = 800;
    image.loading = "lazy";
    image.decoding = "async";
    image.fetchPriority = "low";   // the hero plate and the fonts come first
    image.alt = decorative ? "" : product.alt;
    const fallback = document.createElement("span");
    fallback.className = "image-fallback";
    fallback.hidden = true;
    fallback.textContent = fullName(product);
    image.addEventListener("error", () => {
      image.hidden = true;
      fallback.hidden = false;
      wrap.classList.add("has-image-error");
    });
    wrap.append(image, fallback);
    return wrap;
  }

  /* A labelled fact, never a savings claim. The wording keeps the provenance
     distinction (exact product / similar size / working value) in fewer words. */
  /* "Gain" + "Gain Plus Happy Hibiscus" must not read "Gain Gain Plus...", and
     an unresolved brand must not read "Unbranded / unknown Toilet Paper". */
  /* Five products differ from a card-mate ONLY by `variant` — the three Tide evo
     tiles, and Tide Simply All in One in two scents. fullName() omits variant, so
     one card exposed three identical dot labels, three identical cart lines and
     three identical request lines: the seller could not tell which scents to pull.
     fullName() is the cart contract and stays as it is; this is the naming used
     anywhere a human has to tell two products apart. */
  const ambiguousNames = new Set();
  (function findAmbiguousNames() {
    const seen = new Map();
    for (const item of products) {
      const key = normalize(fullName(item));
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    for (const [key, count] of seen) if (count > 1) ambiguousNames.add(key);
  }());

  function labelName(product) {
    const base = fullName(product);
    // only where it is actually needed: appending a variant to a name that is
    // already unique just makes every line longer
    if (!ambiguousNames.has(normalize(base))) return base;
    const variant = typeof product.variant === "string" ? product.variant.split("·")[0].trim() : "";
    if (!variant) return base;
    return normalize(base).includes(normalize(variant)) ? base : `${base} — ${variant}`;
  }

  function fullName(product) {
    const brand = normalize(product.brand).startsWith("unbranded") ? "" : product.brand;
    if (!brand) return product.name;
    const normBrand = normalize(brand);
    const normName = normalize(product.name);
    return normName === normBrand || normName.startsWith(`${normBrand} `)
      ? product.name
      : `${brand} ${product.name}`;
  }

  /* "each" is not decoration. comparePrice is the store price of ONE bottle or
     ONE package, and half the shelf is priced in pairs — so "About $4.97 + tax"
     printed beside "2 for $5" read as though two of ours cost about what one of
     theirs does, which is the opposite of true. The unit has to be on the
     number that is per-unit, or the comparison is worse than useless. */
  function sourceLabel(product) {
    /* ONE name for one fact. This branch used to return "No store price listed"
       while its only caller guards on `hasCompare` and prints "No comparison
       price listed" itself -- so the string was unreachable, and it was a second
       name for a state the ledger, the audit document and the visitor already
       call something else. Returning the same words means the two cannot drift
       apart if a future caller stops guarding. */
    if (!Number.isFinite(product.comparePrice)) return "No comparison price listed";
    if (product.sourceStatus === "verified") return `Store price ${money.format(product.comparePrice)} each + tax`;
    if (product.sourceStatus === "category_reference") return `Similar size ${money.format(product.comparePrice)} each + tax`;
    // a working value has no documented source, so it must read as an estimate
    return `About ${money.format(product.comparePrice)} each + tax`;
  }

  /* Cards show the short price. */
  function cardPrice(product) {
    const deal = deals[product.dealGroup];
    return deal.cardLabel || deal.label;
  }

  /* The pickup list shows the FULL rule, because that is the one place a
     shopper is quoted an actual figure and has to be able to see where it came
     from. Until 2026-09-11 this used cardPrice() too, so a single medium bottle
     showed "2 for $5" beside a charge of $3.00 and nothing on any surface
     explained the three dollars — the "· 1 for $3" half of the rule rendered
     nowhere but inside <noscript>. The guard for it asserted the DATA FIELD
     rather than the rendered line, so it passed the whole time. */
  function fullRule(product) {
    const deal = deals[product.dealGroup];
    return deal.label || deal.cardLabel;
  }

  /* Owner, 2026-09-12: "i hate the 'add to my list', it's too long and too
     little". One word. The + is drawn by CSS as a chip on the right, so it is
     part of the button's shape rather than four more characters of label, and
     the accessible name below still says what is being added. */
  /* THE BUTTON SAYS WHEN THERE IS NO MORE OF IT. Owner, 2026-09-13: "for calm
     44oz if i add 1 ok, if i add 2 ok it shows, but if i try to add 3 and
     there's no 3 in stock the add button should become 'no more in stock'. fix
     it properly, my solution is just an idea, you know best."

     Before this, hitting the cap fired a toast and left the button reading
     "ADDED 2" — which is a control that looks addable, refusing silently,
     three seconds after the toast has gone.

     Four decisions worth writing down:
     - IT IS NOT `disabled`. A disabled button loses focus and stops being
       announced, and this project already shipped that defect once (the SPIN
       button disabled itself while holding focus for 5.2s). Pressing it again
       re-fires the toast, which is the right answer for someone who did not
       see it the first time.
     - IT NAMES THE COUNT — "ALL 4 ADDED" — rather than "NO MORE IN STOCK".
       "ALL n ADDED" continues the "ADDED n" the button already says on the way
       up, so the state reads as the end of a sequence rather than an error; the
       shopper has not done anything wrong. It is also short enough to fit: the
       label box is 188px at 375px wide and 20px display type, which "NO MORE IN
       STOCK" is not.
     - IT IS PER PRODUCT, NOT PER CARD. A card rotates through up to eight
       products every 2s, so the state has to be recomputed from the variant the
       button currently carries or it will say "ALL 4 ADDED" about the wrong
       bottle — the same failure class as the mis-add defect measured at 2/22,
       5/40 and 10/32.
     - IT SURVIVES A RELOAD AND A SECOND TAB, because it is derived from the
       cart at render time rather than set once when the press happened. */
  function heldOf(id) { return state.cart.get(id) || 0; }
  function isMaxed(product) {
    return product.inStock && product.pricingStatus === "active"
      && heldOf(product.id) >= product.inventoryQuantity;
  }
  function addButtonLabel(product) {
    if (!product.inStock) return "OUT OF STOCK";
    if (product.pricingStatus === "pending") return "PRICE TO BE SET";
    if (isMaxed(product)) return `ALL ${heldOf(product.id)} ADDED`;
    return "ADD";
  }
  /* One place that knows what this button looks like in every state, so the
     card renderer, the variant swap and every cart change cannot disagree. */
  function refreshAddButton(button, product) {
    if (!button || !product) return;
    const maxed = isMaxed(product);
    button.dataset.add = product.id;
    button.disabled = !product.inStock || product.pricingStatus === "pending";
    button.classList.toggle("is-maxed", maxed);
    button.textContent = addButtonLabel(product);
    button.setAttribute("aria-label", maxed
      ? `${labelName(product)}, ${product.size} — all ${heldOf(product.id)} in stock are on your list`
      : `${addButtonLabel(product)} — ${labelName(product)}, ${product.size}`);
    button.title = !product.inStock
      ? "This item is not currently available to add."
      : product.pricingStatus === "pending"
        ? "In stock; it can go on a list once a price is set."
        : maxed
          ? `That is all ${fullName(product)} I have.`
          : `Add ${fullName(product)} to the pickup list.`;
  }

  function applyDisplaySettings(next = window.StockUpSettings?.get?.() || state.displaySettings) {
    state.displaySettings = next;
    document.documentElement.classList.toggle("hide-comparisons", next.showComparisons === false);
    document.querySelectorAll("[data-variant-stock]").forEach((node) => {
      node.hidden = next.showAvailability !== true;
    });
    // hiding the section without its nav link leaves a dead item in a
    // three-item menu that scrolls nowhere
    document.querySelectorAll('.nav-links a[href="#sources"]').forEach((link) => {
      link.hidden = next.showComparisons === false;
    });
    if (next.autoRotateProducts === false) stopBrandRotation();
    else startBrandRotation();
  }

  /* ONE PRODUCT LINE, ONE CARD — the key is brand + category, and both fields
     are already on every product.

     Owner, 2026-09-13, looking at their own phone: "simply all in one green
     sticker shud be a part of the [rest of the] other med bottles not its own,
     same with tide pods, all under one, and gain pods, bc seems like some are
     on its own and that's not ok."

     They had two cards side by side on the $5 shelf BOTH titled "Simply All in
     One" — one 32 fl oz, one 31. Cause: five Tide Simply bottles share one
     brand key, MAX_CARD_VARIANTS was 4, and the spill put the fifth on a card
     of its own. The split is "the first four in file order", so which product
     gets orphaned is an accident of where it was typed.

     Brand ALONE is too coarse — it puts the evo tiles behind the pod tubs —
     which is why an explicit `cardGroup` field was added. But a hand-kept list
     fails by omission, and it had already failed twice: the four pod tubs from
     the 09-12 and 09-13 restocks never got `tide-pods`, so they rendered as a
     SECOND Tide pods card; and `gain-hibiscus` was only ever applied to the
     32-count tub, so the field that exists to MERGE products was isolating one
     from its own 25-count twin. `category` cannot be forgotten — every record
     carries it, and it is a business statement the manifest already makes
     rather than a family guessed from the product name.

     Two exceptions:
     - paper goods: toilet paper and paper towels are different things and get
       a card each;
     - a group longer than MAX_CARD_VARIANTS spills into a second card. That is
       a SAFETY VALVE, not a layout rule — beast-qa.py asserts it never fires. */
  const MAX_CARD_VARIANTS = 8;
  function groupByBrand(items) {
    const groups = new Map();
    items.forEach((product) => {
      const key = product.cardGroup ? `group:${product.cardGroup}`
        : product.category === "Paper goods" ? `id:${product.id}`
        : `${normalize(product.brand)}|${normalize(product.category)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(product);
    });
    const cards = [];
    for (const group of groups.values()) {
      for (let at = 0; at < group.length; at += MAX_CARD_VARIANTS) {
        cards.push(group.slice(at, at + MAX_CARD_VARIANTS));
      }
    }
    return cards;
  }

  /* The card prints the brand on its own line and the name under it, so a name
     that already opens with the brand reads "GAIN / Gain Plus Happy Hibiscus".
     fullName() solves the same problem for prose; this is its other half. */
  function cardTitle(product) {
    const brand = normalize(product.brand);
    if (!brand || brand.startsWith("unbranded")) return product.name;
    const name = normalize(product.name);
    return name.startsWith(`${brand} `) ? product.name.slice(product.brand.length).trim() : product.name;
  }

  function displayBrand(productsInCard) {
    return productsInCard.every((product) => normalize(product.brand).startsWith("unbranded"))
      ? "Paper Goods"
      : productsInCard[0].brand;
  }

  function activateBrandVariant(article, nextIndex, animate = true) {
    const ids = String(article.dataset.variantIds || "").split(",").filter(Boolean);
    if (!ids.length) return;
    const index = ((nextIndex % ids.length) + ids.length) % ids.length;
    const product = productById.get(ids[index]);
    if (!product) return;

    /* Which way the pack moved. The change used to throw every incoming image
       18 px in from the same side whichever direction the visitor pressed, and
       flashed the whole copy block down to 25% opacity — that is the "jumpy"
       the owner reported. Now the drift is 6 px and it follows the press, so
       the movement itself says there is another one over there. */
    const was = Number(article.dataset.variantIndex || 0);
    const forward = index === (was + 1) % ids.length || (index > was && index - was < ids.length / 2);
    article.classList.toggle("is-rewind", !forward);
    article.dataset.variantIndex = String(index);
    article.dataset.productId = product.id;
    article.classList.toggle("is-sold-out", !product.inStock);
    article.classList.toggle("is-price-pending", product.pricingStatus === "pending");
    article.querySelectorAll("[data-variant-image]").forEach((node) => {
      const current = node.dataset.variantImage === product.id;
      node.classList.toggle("is-current", current);
      node.setAttribute("aria-hidden", current ? "false" : "true");
    });
    /* ONLY THE LINES THAT CHANGED MOVE — which nothing was checking. The pop
       class went on the whole copy block, so the Tide evo card (three scents
       that share a brand, a name and a size and differ only in the packshot)
       ran a fade on two lines of identical text every two seconds, and so did
       every other card whose price was the same on both variants — which was
       all of them, because the price came off the shelf. `freshen` writes the
       text and animates only when the string is new. */
    const freshen = (node, next) => {
      if (!node) return;
      const changed = node.textContent !== next;
      node.textContent = next;
      // cleared first, always: a node that keeps the class after its animation
      // has finished is a state flag that lies, and the next rule keyed on it
      // would apply to a card that has been still for minutes
      node.classList.remove("is-fresh");
      if (!animate || !changed) return;
      void node.offsetWidth;
      node.classList.add("is-fresh");
    };
    const nameNode = article.querySelector("[data-variant-name]");
    freshen(nameNode, cardTitle(product));
    nameNode.setAttribute("aria-label", labelName(product));
    freshen(article.querySelector("[data-variant-size]"), product.size || "");
    const stock = article.querySelector("[data-variant-stock]");
    if (stock) {
      stock.textContent = product.inStock ? `${product.inventoryQuantity} AVAILABLE` : "SOLD OUT";
      stock.hidden = state.displaySettings.showAvailability !== true;
    }
    const button = article.querySelector("[data-add]");
    button.classList.remove("is-added");
    /* `refreshAddButton` sets the label, the title AND the aria-label, including
       the "that is all I have" wording at the stock cap. The block that used to
       follow it here re-wrote both of those one statement later from the
       pre-cap template, so a button reading "ALL 2 ADDED" carried the tooltip
       "Add Downy Calm to the pickup list." — and because this runs on every
       rotation tick, it came back every two seconds. Do not restore it. */
    refreshAddButton(button, product);
    /* THE ARROWS ARE NAMED AFTER WHAT THE CARD IS SHOWING, and the card rotates
       every two seconds. Their labels were written once at render and then never
       touched, so after a single rotation both arrows announced the product that
       happened to be showing when the shelf was built — the one thing on the
       card that a screen-reader user cannot see has changed. Everything else
       here is refreshed; these were missed. */
    const arrowName = `${displayBrand([product])} ${product.name}, ${product.size}`.trim();
    const prevArrow = article.querySelector("[data-variant-prev]");
    const nextArrow = article.querySelector("[data-variant-next]");
    if (prevArrow) prevArrow.setAttribute("aria-label", `Previous ${arrowName} option`);
    if (nextArrow) nextArrow.setAttribute("aria-label", `Next ${arrowName} option`);

    article.querySelectorAll("[data-variant-dot]").forEach((dot) => {
      const variant = productById.get(ids[Number(dot.dataset.variantDot)]);
      // WCAG 2.2.2: this is the control that STOPS the rotation, so its name
      // has to say so rather than leaving the mechanism undiscoverable
      if (variant) dot.setAttribute("aria-label", `Show ${labelName(variant)}, ${variant.size}, and stop this card changing`);
      const current = Number(dot.dataset.variantDot) === index;
      dot.classList.toggle("is-current", current);
      dot.setAttribute("aria-current", current ? "true" : "false");
    });
  }

  function renderBrandCard(productsInCard, index) {
    const product = productsInCard[0];
    const article = document.createElement("article");
    article.className = "product-card product-brand-card";
    article.dataset.productId = product.id;
    article.dataset.variantIds = productsInCard.map((item) => item.id).join(",");
    article.dataset.variantIndex = "0";
    article.dataset.variantCount = String(productsInCard.length);
    if (!product.inStock) article.classList.add("is-sold-out");
    if (product.pricingStatus === "pending") article.classList.add("is-price-pending");

    const visual = document.createElement("div");
    visual.className = "product-visual";
    productsInCard.forEach((item, variantIndex) => {
      const image = imageWithFallback(item);
      image.classList.add("product-variant-image");
      image.dataset.variantImage = item.id;
      image.classList.toggle("is-current", variantIndex === 0);
      image.setAttribute("aria-hidden", variantIndex === 0 ? "false" : "true");
      visual.append(image);
    });
    const copy = document.createElement("div");
    copy.className = "product-card-copy";
    const brand = document.createElement("p");
    brand.className = "product-brand";
    brand.textContent = displayBrand(productsInCard);
    // h4: the shelf headline above it is the h3, so a heading-navigation user
    // could not tell where one shelf ended and the next began
    const title = document.createElement("h4");
    title.dataset.variantName = "";
    title.textContent = cardTitle(product);
    title.setAttribute("aria-label", labelName(product));
    const stock = document.createElement("p");
    stock.className = "stock-note";
    stock.dataset.variantStock = "";
    stock.textContent = product.inStock ? `${product.inventoryQuantity} AVAILABLE` : "SOLD OUT";
    stock.hidden = state.displaySettings.showAvailability !== true;
    /* 2026-09-10: the arrows and the dots used to own a 34 px row of their own
       inside the copy block, on every multi-variant card — "they take
       unnecessary space and they should be repositioned cleverly". The arrows
       now sit on the left and right edges of the product visual, over the
       podium, and the dots ride the brand line, which was empty to the right of
       a six-letter brand. The whole row is reclaimed and the card is shorter. */
    let dots = null;
    let arrows = null;
    if (productsInCard.length > 1) {
      dots = document.createElement("span");
      dots.className = "variant-dots";
      productsInCard.forEach((item, variantIndex) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.dataset.variantDot = String(variantIndex);
        dot.classList.toggle("is-current", variantIndex === 0);
        dot.setAttribute("aria-current", variantIndex === 0 ? "true" : "false");
        dot.setAttribute("aria-label", `Show ${labelName(item)}, ${item.size}, and stop this card changing`);
        dots.append(dot);
      });
      arrows = document.createDocumentFragment();
      const previous = document.createElement("button");
      previous.type = "button";
      previous.className = "variant-arrow variant-arrow-prev";
      previous.dataset.variantPrev = "";
      /* The SIZE is part of the name, because two shelves can carry the same
         brand and the same product name — the Tide card on the 2-for-$5 shelf
         and the one on the $8 shelf produced four identical accessible names
         between them. It used to be the shelf price; the card stopped printing
         that on 2026-09-13, and a control must not be named after something
         that is not on the card. Size separates the same two cards: 32 fl oz
         against 107. */
      const cardName = `${displayBrand(productsInCard)} ${product.name}, ${product.size}`.trim();
      previous.setAttribute("aria-label", `Previous ${cardName} option`);
      previous.textContent = "←";
      const next = document.createElement("button");
      next.type = "button";
      next.className = "variant-arrow variant-arrow-next";
      next.dataset.variantNext = "";
      next.setAttribute("aria-label", `Next ${cardName} option`);
      next.textContent = "→";
      arrows.append(previous, next);
      visual.append(arrows);
      const brandRow = document.createElement("span");
      brandRow.className = "product-brand-text";
      brandRow.textContent = brand.textContent;
      brand.textContent = "";
      brand.classList.add("has-dots");
      brand.append(brandRow, dots);
    }
    /* THE SIZE, IN THE SLOT THE PRICE HAD. cardPrice() printed "2 for $5"
       under an <h3> saying "2 FOR $5" at 84 px two hundred pixels above, while
       the sticky stage bar said it a third time with the live stage lit — three
       copies of one number on screen at once, the string printed 18 times down
       the page, against an owner rule that reads "say it once". Meanwhile `size`
       was in products.js for all 38 products and in the ADD button's
       aria-label, so a screen-reader user was told the size and a sighted one
       never was.

       The comment that used to sit here defended the price because "a search
       result can be seen a long way from its shelf headline". That is not how
       this page searches: renderShelves() filters INSIDE each shelf section and
       hides a section that empties, so every card a query leaves on screen is
       still under its own headline. The card prints no store comparison either
       — that belongs in PRICE NOTES and the pickup list, where it is a ledger
       rather than a sales claim.

       A pending price still says so, on the button: it reads PRICE TO BE SET
       and is disabled. */
    const size = document.createElement("p");
    size.className = "product-size";
    size.dataset.variantSize = "";
    size.textContent = product.size || "";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "add-button";
    refreshAddButton(button, product);
    copy.append(brand, title, size, stock);
    copy.append(button);
    article.append(visual, copy);
    return article;
  }

  function stopBrandRotation() {
    if (state.variantTimer) window.clearInterval(state.variantTimer);
    state.variantTimer = null;
  }

  /* THE HOLD. Owner, 2026-09-12: "as soon as they interact with each one it
     will stop for 7 sec minimum and obey arrows etc; if unattended for 7 sec it
     goes back to the loop", and "the arrows should stay on until 7 sec of no
     interaction, then they go away". One timer does both jobs, so the arrows
     are visible for exactly as long as the card is standing still — the
     affordance and the pause are the same state, and they cannot disagree.

     WCAG 2.2.2 still has to be satisfied: this is auto-updating information, so
     a visitor must have a way to STOP it, not merely delay it. Three exist and
     all are reachable without leaving the page:
       - a DOT is "show me this one" and stops that card for good (its
         accessible name says so);
       - keyboard focus inside a card freezes it while the focus is there;
       - prefers-reduced-motion and the display setting stop every card.
     The arrows and hovering only hold, which is what the owner asked for. */
  const holdTimers = new WeakMap();
  function cardHeld(card) {
    return Number(card.dataset.holdUntil || 0) > Date.now();
  }
  function touchCard(card) {
    if (!card || !card.classList.contains("product-brand-card")) return;
    if (card.dataset.variantCount === "1" || card.dataset.rotationStopped === "1") {
      // a single-variant card has no arrows to show and nothing to hold
      if (card.dataset.variantCount !== "1") card.classList.add("is-touched");
      return;
    }
    card.classList.add("is-touched");
    card.dataset.holdUntil = String(Date.now() + variantHoldMs);
    window.clearTimeout(holdTimers.get(card));
    holdTimers.set(card, window.setTimeout(() => {
      // a later touch pushed the deadline out; that touch owns the class now
      if (cardHeld(card)) return;
      card.classList.remove("is-touched");
      delete card.dataset.holdUntil;
    }, variantHoldMs + 40));
  }

  /* A dot press is a decision, not a browse. It stops this card permanently —
     the visitor said which one they want to look at. */
  function stopCardRotation(card) {
    if (!card) return;
    card.dataset.rotationStopped = "1";
    delete card.dataset.holdUntil;
    window.clearTimeout(holdTimers.get(card));
  }

  function startBrandRotation() {
    stopBrandRotation();
    /* A TOUCH SCREEN HAS NO HOVER, so the copy-block freeze below — which IS the
       mis-add guard — can never fire on a phone. Session 7 called this "the worst
       thing found tonight" and fixed it: a shopper reads "Plus OxiClean Stain
       Fighters", travels to the button, the card turns over on the way, and they
       add "Plus OxiClean Odor Blasters" — which flows into the pickup list AND
       into the text the seller reads. That fix was built on four `:hover`
       selectors, and `grep hover:none` over this project returns one hit, inside
       a comment. So the defect has been live for every phone visitor since.
       The PRESS is atomic (pointerdown sets the hold before click adds); it is
       the READ-THEN-REACH interval that is unguarded, and at a realistic 600-800ms
       thumb travel against a 2000ms tick that is a 30-40% chance per press, worst
       on the 6-variant Tide PODS card where adjacent variants differ only by scent.
       There is no gesture a thumb can make that means "I am reading this one", so
       the only safe behaviour is not to change it underneath them. The arrows and
       dots stay, and beast.css makes them permanent on touch so nothing becomes
       undiscoverable. */
    if (state.displaySettings.autoRotateProducts === false || document.hidden
        || window.matchMedia("(prefers-reduced-motion: reduce)").matches
        || window.matchMedia("(hover: none)").matches) return;
    state.variantTimer = window.setInterval(() => {
      document.querySelectorAll(".product-brand-card[data-variant-count]:not([data-variant-count='1'])").forEach((card) => {
        if (card.dataset.rotationStopped === "1") return;
        if (cardHeld(card)) return;
        /* Never swap what a pointer is ABOUT TO PRESS, and never swap under the
           keyboard focus. This used to be `card.matches(":hover")`, which froze
           a card for merely being pointed at — the owner asked for that to stop,
           because a cursor resting anywhere over a shelf froze the card under it
           and the visitor most likely to be looking never saw there was more
           behind it.

           BUT THE CONTROLS ALONE WERE NOT ENOUGH, and an audit measured the cost
           on 2026-09-12: a shopper reads the name on the tablet, travels to ADD
           — about 320 ms at human speed — and the card rotates on the way. Three
           runs came back 2/22, 5/40 and 10/32 mismatches, and the mis-added
           product goes straight into the pickup list AND into the text the
           seller receives. Read "Plus OxiClean Stain Fighters", added "Plus
           OxiClean Odor Blasters".

           So the COPY BLOCK freezes too. That is the tablet carrying the name,
           the price and the button — the place a person is standing when they
           are deciding. The product image and the bay keep cycling, so the
           owner's objection does not come back: browsing a shelf still shows
           you what is behind each card. What stops is only the part you are
           reading before you press. */
        if (card.contains(document.activeElement)) return;
        if (card.querySelector(".product-card-copy:hover, .add-button:hover, .variant-arrow:hover, [data-variant-dot]:hover")) return;
        activateBrandVariant(card, Number(card.dataset.variantIndex || 0) + 1);
      });
    }, variantIntervalMs);
  }

  /* ---------- THE ONE BAR: docking, and which stage you are on ----------
     THIS IS NAVIGATION, NOT MOTION, AND THAT IS WHY IT LIVES HERE. beast.js
     does not run past its motion gate for a reduced-motion visitor and never
     gets that far at all if GSAP fails to load — and the merged bar has to dock
     and has to say where you are in both cases. Putting the live-stage
     underline in the motion layer is why a reduced-motion visitor had never
     seen it (trap 21). script.js is also the only file that knows the shelves
     exist: the rail is stowed in CSS until this runs, because three links to
     three sections that were never rendered is a page offering what it cannot
     deliver (trap 25).
     No GSAP, no rAF, no scroll listener. Two observers.
     The dock sentinel is positioned in CSS off var(--nav-h), so nothing here
     reads a pixel value and nothing needs recomputing when --nav-h changes at
     760px or at 480px of height (traps 40 and 15c). */
  let dockObserver = null;
  let stageObserver = null;

  function bindStageBar() {
    const root = document.documentElement;
    try {
      const dock = document.querySelector("[data-shop-dock]");
      if (dock && "IntersectionObserver" in window) {
        if (dockObserver) dockObserver.disconnect();
        dockObserver = new IntersectionObserver(([entry]) => {
          /* TWO thresholds, 56px of sentinel apart, deliberately: dock when it
             is fully gone above the top, undock only when it is fully back.
             iOS moves the visual viewport 60-80px when it collapses its URL
             bar, and a single-threshold dock parked at that scroll position
             would crossfade the whole bar on every URL-bar animation — a NEW
             rattle, of exactly the kind this merge is fixing. */
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) root.classList.add("shop-docked");
          else if (entry.intersectionRatio >= 0.99) root.classList.remove("shop-docked");
        }, { threshold: [0, 0.99] });
        dockObserver.observe(dock);
      } else {
        /* No sentinel or no observer: show the rail and leave it shown. A bar
           that never changes dress is complete and usable; a rail that never
           appears is a navigation control the visitor simply never gets. */
        root.classList.add("shop-docked");
      }
      if (stageObserver) stageObserver.disconnect();
      if ("IntersectionObserver" in window && dom.shelves) {
        /* A zero-height band across 45% of the viewport — the same line the
           ScrollTrigger this replaces used for `start:"top 45%"`. */
        stageObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            const link = document.querySelector(`[data-stage-link="${entry.target.dataset.deal}"]`);
            if (link) link.classList.toggle("is-active", entry.isIntersecting);
          });
        }, { rootMargin: "-45% 0px -55% 0px", threshold: 0 });
        dom.shelves.querySelectorAll(".deal-shelf:not([hidden])").forEach((shelf) => stageObserver.observe(shelf));
      }
    } catch (error) {
      /* Never leave the rail stowed because of a failure in the thing that was
         only ever meant to dress it. */
      root.classList.add("shop-docked");
    }
  }

  function renderShelves() {
    if (!dom.shelves) return;
    dom.shelves.querySelectorAll(".deal-shelf").forEach((node) => node.remove());
    let visibleCount = 0;
    for (const dealId of dealOrder) {
      const filtered = products.filter((item) => item.dealGroup === dealId && matches(item, state.query));
      const brandGroups = groupByBrand(filtered);
      visibleCount += filtered.length;
      const section = document.createElement("section");
      section.className = "deal-shelf";
      section.id = dealCopy[dealId].id;
      section.setAttribute("aria-label", dealCopy[dealId].headline);
      section.dataset.deal = dealId;
      section.hidden = filtered.length === 0;
      const heading = document.createElement("header");
      heading.className = "shelf-heading";
      const priceBlock = document.createElement("div");
      priceBlock.className = "shelf-price";
      const title = document.createElement("h3");
      title.textContent = dealCopy[dealId].headline;
      priceBlock.append(title);
      heading.append(priceBlock);
      /* The item count and the eyebrow are gone. A shelf that has nothing to add
         beyond its price prints nothing beside it — an empty box would leave a
         hole in the grid, so the whole column is skipped. */
      if (dealCopy[dealId].note) {
        const info = document.createElement("div");
        info.className = "shelf-info";
        const note = document.createElement("p");
        note.className = "shelf-note";
        note.textContent = dealCopy[dealId].note;
        info.append(note);
        heading.append(info);
      }
      const grid = document.createElement("div");
      grid.className = "product-grid";
      grid.dataset.cardCount = String(brandGroups.length);
      brandGroups.forEach((group, index) => grid.append(renderBrandCard(group, index)));
      section.append(heading, grid);
      dom.shelves.append(section);
    }
    if (dom.resultCount) dom.resultCount.textContent = String(visibleCount);
    /* Two different nothings. `products` is empty only when products.js did not
       run — the manifest is frozen and never ships empty — so an empty CATALOGUE
       is a failure to report, and an empty RESULT is a search to widen. Saying
       "NO MATCHES" for the first told a visitor the shop was empty while the
       hero, the wheel and the pickup list all worked. */
    const brokenShelf = products.length === 0;
    if (dom.emptyResults) dom.emptyResults.hidden = brokenShelf || visibleCount !== 0;
    if (dom.shelfError) dom.shelfError.hidden = !brokenShelf;
    // the price-stage bar must not offer a jump to a shelf the search emptied
    document.querySelectorAll("[data-stage-link]").forEach((link) => {
      const shelf = dom.shelves.querySelector(`.deal-shelf[data-deal="${link.dataset.stageLink}"]`);
      const empty = !shelf || shelf.hidden;
      link.classList.toggle("is-empty", empty);
      link.setAttribute("aria-disabled", empty ? "true" : "false");
      /* pointer-events:none does nothing for a keyboard: Enter on an emptied
         link jumped to a display:none section and left focus on <body>. */
      if (empty) {
        if (link.hasAttribute("href")) link.dataset.href = link.getAttribute("href");
        link.removeAttribute("href");
        link.tabIndex = -1;
      } else {
        if (link.dataset.href) link.setAttribute("href", link.dataset.href);
        link.removeAttribute("tabindex");
      }
    });
    bindStageBar();
    /* The stage count only says something while a search is narrowing things
       down. Unfiltered it printed "3 PRICE STAGES" directly under a kicker
       reading THREE PRICES and directly above a bar showing all three, and at
       zero results it printed "0 PRICE STAGES" while that bar still showed
       three of them. */
    const shown = [...dom.shelves.querySelectorAll(".deal-shelf")].filter((n) => !n.hidden).length;
    const narrowed = state.query.trim().length > 0 && shown > 0 && shown < pricedDealOrder.length;
    document.querySelectorAll("[data-stage-count]").forEach((node) => {
      node.textContent = narrowed ? ` · ${shown} PRICE ${shown === 1 ? "STAGE" : "STAGES"}` : "";
    });
    startBrandRotation();
  }

  function quantitiesByDeal() {
    const totals = Object.fromEntries(dealOrder.map((id) => [id, 0]));
    for (const [id, quantity] of state.cart) {
      const item = productById.get(id);
      if (item) totals[item.dealGroup] += quantity;
    }
    return totals;
  }

  function cartMath() {
    const byDeal = quantitiesByDeal();
    const warnings = [];
    let cashTotal = 0;
    let comparisonTotal = 0;
    let comparisonComplete = true;
    let comparisonCents = 0;
    let comparisonSourced = false;
    let itemCount = 0;
    let unavailable = false;

    for (const [id, quantity] of state.cart) {
      const item = productById.get(id);
      if (!item) continue;
      itemCount += quantity;
      /* In CENTS. Float addition is not associative, so the same cart built in
         a different order produced comparisonTotal 59.290000000000006 one way
         and 59.28999999999999 the other. The printed money never differed, but
         a public API value and a change-detection key that depend on Map order
         are a defect waiting for a rounding boundary. */
      if (Number.isFinite(item.comparePrice)) comparisonCents += Math.round(item.comparePrice * 100) * quantity;
      else comparisonComplete = false;
      // a saving built entirely from unsourced estimates has to say so
      if (Number.isFinite(item.comparePrice) && item.sourceStatus !== "working_value") comparisonSourced = true;
      if (!item.inStock) unavailable = true;
      if (item.pricingStatus !== "active") warnings.push(`${fullName(item)} is awaiting a price and cannot be requested yet.`);
    }

    for (const dealId of pricedDealOrder) {
      const definition = deals[dealId];
      const quantity = byDeal[dealId];
      const completeBundles = Math.floor(quantity / definition.bundleQuantity);
      const remainder = quantity % definition.bundleQuantity;
      cashTotal += completeBundles * definition.bundlePrice;
      if (remainder && Number.isFinite(definition.singlePrice)) {
        cashTotal += remainder * definition.singlePrice;
      } else if (remainder) {
        const needed = definition.bundleQuantity - remainder;
        /* The shelf has no name but its price now, which is also the only
           name a shopper ever saw — so the warning names the shelf that way. */
        const shelf = definition.cardLabel || definition.label;
        warnings.push(`${needed === 1 ? "One more" : `${needed} more`} on the ${shelf} shelf finishes the pair.`);
      }
    }
    if (unavailable) warnings.push("A saved item is now marked out of stock. Availability must be reconfirmed.");
    const valid = itemCount > 0 && warnings.length === 0;
    comparisonTotal = comparisonCents / 100;
    return {
      byDeal, warnings, valid, unavailable, itemCount, cashTotal, comparisonTotal, comparisonComplete,
      comparisonSourced,
      savings: valid && comparisonComplete ? Math.max(0, comparisonTotal - cashTotal) : null
    };
  }

  /* What one deal group costs on its own. */
  function dealCharge(dealId, quantity) {
    const deal = deals[dealId];
    const bundles = Math.floor(quantity / deal.bundleQuantity);
    const remainder = quantity % deal.bundleQuantity;
    const charged = bundles * deal.bundlePrice + (remainder && Number.isFinite(deal.singlePrice) ? remainder * deal.singlePrice : 0);
    return { charged, complete: !remainder || Number.isFinite(deal.singlePrice) };
  }

  /* A line inside a bundle only has a defined price of its own in two cases: the
     group is a whole number of bundles (every item is worth the bundle unit
     price), or this line is the only one in its group (it carries the whole
     charge, leftover included). Anything else would be an invented allocation,
     so the line shows a count and the summary carries the money. */
  function lineTotal(product, quantity, byDeal, linesInDeal) {
    if (product.bundleQuantity > 1) {
      const groupQuantity = byDeal?.[product.dealGroup] || 0;
      if (groupQuantity % product.bundleQuantity !== 0) {
        const own = dealCharge(product.dealGroup, groupQuantity);
        if (linesInDeal?.[product.dealGroup] === 1 && own.complete) return money.format(own.charged);
        return `${quantity} ${quantity === 1 ? "ITEM" : "ITEMS"}`;
      }
    }
    return money.format(product.effectiveUnitPrice * quantity);
  }

  /* This row is about delivery only. It used to be labelled "Pickup or
     delivery" while showing a fee, which read as a charge to everyone.
     Below the threshold it is one quiet line; at the threshold the stamp lands
     and takes over. The number always comes from SITE_CONFIG. */
  /* DELIVERY, from 2026-09-12.

     There is no free-delivery threshold any more. `freeMinimumItems` is null
     in SITE_CONFIG and delivery always carries the seller's small fee — the
     ONLY thing that waives it is the FREE DELIVERY prize, and that prize has
     its own item minimum. Every number below is read from the prize, so the
     three surfaces that print one (the meter, the stamp, the request text)
     cannot disagree with the wheel. Put a number back in `freeMinimumItems`
     and the old rule returns everywhere at once. */
  function deliveryEnabled() {
    return window.SITE_CONFIG?.delivery?.enabled !== false;
  }
  /* A threshold only exists if the config carries one. It is null today. */
  function deliveryThreshold() {
    const n = Number(window.SITE_CONFIG?.delivery?.freeMinimumItems);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function deliveryPrizeMinItems() {
    const prize = state.prize;
    return prize && prize.delivery ? Math.max(1, Number(prize.minItems) || 1) : null;
  }
  /* Free delivery is true only when it has actually been won AND the list is
     long enough for the prize the shopper won. */
  function deliveryIsFree(itemCount) {
    if (!deliveryEnabled()) return false;
    const threshold = deliveryThreshold();
    if (threshold !== null && itemCount >= threshold) return true;
    const needed = deliveryPrizeMinItems();
    return needed !== null && itemCount >= needed;
  }
  /* The WHOLE sentence, not a fragment in a template. The meter directly above
     it already counts the items that are left; this says what delivery costs
     and what pickup costs, once. */
  function deliveryMessage(itemCount) {
    if (!deliveryEnabled()) return "Pickup only — delivery is not running at the moment.";
    if (deliveryIsFree(itemCount)) return "Delivery is free on this list. Pickup is free too.";
    const threshold = deliveryThreshold();
    if (threshold !== null) return `Delivery is a small fee under ${threshold} items, not in this total. Pickup is always free.`;
    if (deliveryPrizeMinItems() !== null) return "Delivery is a small fee until then, not in this total. Pickup is always free.";
    return "Delivery is a small fee, not in this total. Pickup is always free.";
  }
  function renderDelivery(itemCount) {
    const enabled = deliveryEnabled();
    const free = deliveryIsFree(itemCount);
    /* The meter used to count every list toward 20. It now appears only when
       there is something real to count toward: a FREE DELIVERY prize in hand
       that this list is still short of. A progress bar under a list that can
       never reach the end of it is a promise the page cannot keep. */
    const target = deliveryThreshold() ?? deliveryPrizeMinItems();
    const showMeter = enabled && !free && target !== null;
    const left = target === null ? 0 : Math.max(0, target - itemCount);
    document.querySelectorAll("[data-delivery-meter]").forEach((meter) => { meter.hidden = !showMeter; });
    document.querySelectorAll("[data-delivery-left]").forEach((node) => { node.textContent = String(left); });
    document.querySelectorAll("[data-delivery-fill]").forEach((node) => {
      node.style.transform = `scaleX(${target === null ? 0 : Math.min(1, itemCount / target).toFixed(4)})`;
    });
    document.querySelectorAll("[data-delivery-stamp]").forEach((stamp) => {
      const was = !stamp.hidden;
      stamp.hidden = !free;
      if (free && !was) {
        stamp.classList.remove("is-landing");
        void stamp.offsetWidth;
        stamp.classList.add("is-landing");
      }
    });
    document.querySelectorAll("[data-delivery-stamp-min]").forEach((node) => {
      node.textContent = target === null ? "" : `${target}+ ITEMS ON ONE REQUEST`;
    });
    /* The stamp used to be role="status" inside the drawer, which is aria-hidden
       and inert while the drawer is closed — so it could never announce in the
       flow where it actually happens. The crossing is announced through the
       body-level toast instead; the stamp itself is now readable content, not a
       live region. */
    if (state.deliveryFree !== null && free !== state.deliveryFree && free) {
      showToast(target === null ? "Free delivery on this list." : `Free delivery — that is ${target} items on one request.`);
      /* ...and the add that CAUSED the crossing must not immediately overwrite
         it. renderDelivery runs inside updateQuantity, which runs inside
         addProduct, which then said "Added ..." over the top of it — so the one
         announcement that matters was set and destroyed on the same click,
         every time, and no visitor and no screen reader ever got it. */
      state.deliveryJustAnnounced = true;
    }
    state.deliveryFree = free;
  }

  function fulfillmentLine(fulfillment, itemCount) {
    /* Just "Pickup." since 2026-09-13, at the owner's instruction: "simpler so
       nothing unnecessary". The sentence it replaces — "confirm the place, the
       time, and what is still available" — was three instructions to a seller
       who already knows all three, in a message they receive dozens of times.
       THE DELIVERY LINES BELOW ARE NOT SHORTENED and must not be: delivery
       always carries a fee, that fee is deliberately NOT in the total above it,
       and this line is the only place in the whole message that says so. A
       shopper reading a total that excludes a charge is the one thing this
       document cannot get wrong. */
    if (fulfillment !== "Local delivery") return "Pickup.";
    if (!deliveryEnabled()) return "Local delivery is not running at the moment.";
    if (deliveryIsFree(itemCount)) return "Local delivery — free on this list";
    const needed = deliveryPrizeMinItems();
    if (needed !== null) return `Local delivery — the FREE DELIVERY prize needs ${needed} items; this list has ${itemCount}, so the small fee applies and is not in the total above`;
    return "Local delivery — small fee, not in the total above";
  }

  /* renderCart() replaces the whole list, so the button that was just pressed
     stops existing. Without this, every +, − and × threw keyboard focus to
     <body> — three tabs back into the list to press + twice — and a removal
     produced no status message at all, so a screen-reader user got silence and
     lost their place on the same keystroke. */
  function keepCartFocus(run) {
    const active = document.activeElement;
    const inDrawer = active && dom.drawer?.contains(active);
    const key = inDrawer ? active.getAttribute("data-cart-focus") : null;
    const index = inDrawer ? [...dom.drawer.querySelectorAll("[data-cart-focus]")].indexOf(active) : -1;
    run();
    if (!inDrawer) return;
    const all = [...dom.drawer.querySelectorAll("[data-cart-focus]")];
    const same = key ? all.find((node) => node.getAttribute("data-cart-focus") === key) : null;
    (same || all[Math.min(Math.max(index, 0), all.length - 1)] || dom.drawer.querySelector("[data-close-cart]"))?.focus();
  }

  /* What the cart IS, cheaply, for comparing a generated request against it. */
  function cartSignature() {
    return [...state.cart.entries()].map(([id, q]) => `${id}:${q}`).sort().join("|");
  }

  /* A REQUEST THAT NO LONGER DESCRIBES THE LIST MUST NOT STAY SENDABLE.
     The cart already syncs across tabs through the `storage` listener, but a
     request generated before that sync kept its old text AND its old sms: href,
     both live. A shopper could press SEND THE TEXT and send a list they had
     already changed somewhere else. Measured: tab A showed $12.00 and two
     lines while tab A's own cart had become $72.00. */
  function invalidateStaleRequest() {
    const panel = dom.orderSuccess;
    if (!panel || panel.hidden) return;
    if (panel.dataset.builtFor === undefined) return;
    if (panel.dataset.builtFor === cartSignature()) return;
    closeRequest();
    showToast("Your list changed, so that request is out of date. Make it again.");
  }

  /* Every ADD button re-reads the list whenever the list moves. Without this,
     removing an item in the drawer left the card's button still reading
     "ALL 4 ADDED" for a product the shopper now holds none of — and the cart
     syncs across tabs, so the stale one could be in a window nobody touched. */
  function refreshAllAddButtons() {
    document.querySelectorAll("[data-add]").forEach((button) => {
      const product = productById.get(button.dataset.add);
      if (product && !button.classList.contains("is-added")) refreshAddButton(button, product);
    });
  }

  function renderCart() {
    const summary = cartMath();
    invalidateStaleRequest();
    const linesInDeal = {};
    for (const id of state.cart.keys()) {
      const item = productById.get(id);
      if (item) linesInDeal[item.dealGroup] = (linesInDeal[item.dealGroup] || 0) + 1;
    }
    document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = String(summary.itemCount); });
    document.querySelectorAll("[data-mobile-count]").forEach((node) => { node.textContent = String(summary.itemCount); });
    /* "—", not "PAIR NEEDED": the drawer and the dialog both print an em dash
       for an unrequestable cart and the mobile bar printed a status word in a
       PRICE slot, on the same screen, for the same cart. The comment below the
       [data-cart-total] write has claimed since session 5 that "both say '—'
       now" -- it was true of the two selectors that write there and this third
       one was never added to them. The pair warning in the drawer says why. */
    document.querySelectorAll("[data-mobile-total]").forEach((node) => { node.textContent = summary.valid ? money.format(summary.cashTotal) : "—"; });
    if (dom.mobileBar) dom.mobileBar.hidden = summary.itemCount === 0;
    if (dom.cartFab) dom.cartFab.hidden = summary.itemCount === 0;
    if (!dom.cartItems) return;
    dom.cartItems.replaceChildren();

    for (const [id, quantity] of state.cart) {
      const product = productById.get(id);
      if (!product) continue;
      const line = document.createElement("article");
      line.className = "cart-line";
      if (!product.inStock) line.classList.add("is-unavailable");
      line.append(imageWithFallback(product, true));
      const copy = document.createElement("div");
      copy.className = "cart-line-copy";
      const title = document.createElement("h3");
      title.textContent = labelName(product);
      const deal = document.createElement("small");
      deal.textContent = product.inStock ? `${fullRule(product)} · ${product.size}` : "OUT OF STOCK · RECONFIRM";
      const controls = document.createElement("div");
      controls.className = "cart-line-controls";
      const stepper = document.createElement("div");
      stepper.className = "stepper";
      const decrease = document.createElement("button");
      decrease.type = "button";
      decrease.dataset.cartAction = "decrease";
      decrease.dataset.id = id;
      decrease.dataset.cartFocus = `decrease:${id}`;
      decrease.setAttribute("aria-label", `One fewer ${fullName(product)}`);
      decrease.textContent = "−";
      const amount = document.createElement("b");
      amount.textContent = String(quantity);
      // role=img so the label is legal — a bare <b> is role=generic, which
      // prohibits naming, so the label was silently ignored
      amount.setAttribute("role", "img");
      amount.setAttribute("aria-label", `Quantity ${quantity}`);
      const increase = document.createElement("button");
      increase.type = "button";
      increase.dataset.cartAction = "increase";
      increase.dataset.id = id;
      increase.dataset.cartFocus = `increase:${id}`;
      increase.setAttribute("aria-label", `One more ${fullName(product)}`);
      increase.textContent = "+";
      stepper.append(decrease, amount, increase);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-line";
      remove.dataset.cartAction = "remove";
      remove.dataset.id = id;
      remove.dataset.cartFocus = `remove:${id}`;
      remove.textContent = "×";
      remove.title = `Remove ${fullName(product)}`;
      remove.setAttribute("aria-label", `Remove ${fullName(product)} from the pickup list`);
      controls.append(stepper, remove);
      copy.append(title, deal, controls);
      const total = document.createElement("strong");
      total.className = "cart-line-total";
      total.textContent = lineTotal(product, quantity, summary.byDeal, linesInDeal);
      total.classList.toggle("is-deal", !total.textContent.startsWith("$"));
      line.append(copy, total);
      dom.cartItems.append(line);
    }

    if (dom.cartEmpty) dom.cartEmpty.hidden = summary.itemCount > 0;
    if (dom.cartFooter) dom.cartFooter.hidden = summary.itemCount === 0;
    if (dom.pairStatus) {
      dom.pairStatus.hidden = summary.warnings.length === 0;
      dom.pairStatus.replaceChildren();
      summary.warnings.forEach((warning) => {
        const row = document.createElement("p");
        row.textContent = warning;
        dom.pairStatus.append(row);
      });
    }
    // while a pair is short the cash total leaves that item out, so comparing
    // against a store total that counts it would be arithmetic nonsense. The
    // whole sentence is replaced — substituting a dash mid-sentence rendered
    // "Same items in a store — + tax", which is not a sentence.

    document.querySelectorAll("[data-cart-retail]").forEach((node) => {
      node.textContent = money.format(summary.comparisonTotal);
    });
    /* A saving built only from unsourced estimates says so, because otherwise
       it reads identically to one built from checked listings. */
    document.querySelectorAll("[data-store-estimated]").forEach((node) => {
      node.hidden = summary.comparisonSourced;
    });
    /* The whole band goes when there is no saving to state. It used to print
       "YOU SAVE" beside the words "PAIR NEEDED" in 36 px yellow — a status word
       shoved into the middle of a sentence, in the loudest type in the drawer,
       saying for the fourth time on one screen what the pink warning bar above
       it already says. */
    const rip = document.querySelector("[data-savings-rip]");
    const savingReal = summary.valid && summary.savings !== null;
    if (rip) rip.hidden = !savingReal;
    if (savingReal) {
      document.querySelectorAll("[data-cart-savings]").forEach((node) => {
        // exact arithmetic on the store prices shown; flooring to whole dollars
        // printed "$0" for the seven products whose gap is under a dollar. The
        // honesty lives in labelling the inputs, not in blurring the sum.
        node.textContent = money.format(summary.savings);
      });
    }
    document.querySelectorAll("[data-cart-total], [data-dialog-total]").forEach((node) => {
      /* An unrequestable cart has no price. It used to print the total of the
         COMPLETE bundles only, which is a figure that leaves the unpaired item
         out — the same arithmetic nonsense the store-comparison row already
         refuses. Worse, the mobile bar said "PAIR NEEDED" for the same cart on
         the same screen. All THREE say "—" now, and the pair warning above says
         why. (The mobile bar was missed here until session 7: it is written by
         [data-mobile-total], which is not in this querySelectorAll, so this
         comment described a fix that had only been half made.) */
      node.textContent = summary.valid ? money.format(summary.cashTotal) : "—";
    });
    document.querySelectorAll("[data-delivery-status]").forEach((node) => { node.textContent = deliveryMessage(summary.itemCount); });
    renderDelivery(summary.itemCount);
    // the prize's standing depends on the total, so it is re-read every render
    renderPrize(summary);
    /* The claw rip is a motion flourish over information that is already on the
       page. beast.js listens; if it never loads, nothing is lost. */
    const savingsKey = `${summary.valid}|${summary.savings}|${summary.comparisonTotal}`;
    if (savingsKey !== state.lastSavingsKey) {
      const first = state.lastSavingsKey === null;
      state.lastSavingsKey = savingsKey;
      if (!first && summary.valid && summary.savings) {
        document.dispatchEvent(new CustomEvent("stockup:savings-changed"));
      }
    }
    if (dom.checkout) {
      dom.checkout.disabled = !summary.valid;
      dom.checkout.title = summary.valid ? "Write the request and send it as a text" : summary.warnings.join(" ");
    }
    refreshAllAddButtons();
  }

  function announceQuantity(product, before, after) {
    if (after === before) return;
    if (after === 0) showToast(`Removed ${fullName(product)}.`);
    else if (after < before) showToast(`${fullName(product)} — now ${after}.`);
  }

  function updateQuantity(id, nextQuantity) {
    const product = productById.get(id);
    if (!product) return;
    /* loadCart() has always required an integer; this, the public API every
       test and the whole UI go through, did not. setQuantity(id, 2.5) priced
       half a bottle and setQuantity(id, NaN) printed "NaN PICKUP LIST",
       "$NaN" and "NaN more for free delivery" across four surfaces. */
    if (!Number.isInteger(nextQuantity) || nextQuantity <= 0) state.cart.delete(id);
    else if (product.inStock && product.pricingStatus === "active") state.cart.set(id, Math.min(product.inventoryQuantity, nextQuantity));
    saveCart();
    renderCart();
  }

  function addProduct(id) {
    const product = productById.get(id);
    if (!product || !product.inStock || product.pricingStatus !== "active") return;
    const before = state.cart.get(id) || 0;
    if (before >= product.inventoryQuantity) {
      // saying "Added" while silently refusing is the worst of both — and so is
      // a toast that vanishes over a button still reading "ADDED 2"
      const spent = [...document.querySelectorAll("[data-add]")].find((node) => node.dataset.add === id);
      if (spent) { spent.classList.remove("is-added"); refreshAddButton(spent, product); }
      showToast(`Only ${product.inventoryQuantity} ${fullName(product)} in stock.`);
      return;
    }
    updateQuantity(id, before + 1);
    const button = [...document.querySelectorAll("[data-add]")].find((node) => node.dataset.add === id);
    if (button) {
      const count = state.cart.get(id) || 0;
      button.classList.add("is-added");
      button.textContent = `ADDED ${count}`;
      /* Owner, 2026-09-12: "nice pressing animations, especially if they press
         multiple times." `data-press` cycles 1/2/3 so the keyframe restarts on
         every press instead of being ignored as already-running, and `--press`
         climbs with the count so the punch, the glow and the chip's kick all
         get harder the more they hit it. It stops climbing at 6 — past that it
         is a button trying to leave the card. */
      /* `|| 0` matters: dataset.press is undefined on the first press of a
         freshly rendered card, Number(undefined) is NaN, and NaN % 3 + 1 is
         NaN — so the attribute was set to the string "NaN" and then set to
         "NaN" again on every press after it. The CSS selector still matched,
         so the punch played once and never restarted, which is precisely the
         repeat-press feel the owner asked for. Caught by the check written for
         that feature, not by looking at it. */
      const press = ((Number(button.dataset.press) || 0) % 3) + 1;
      button.dataset.press = String(press);
      button.style.setProperty("--press", String(Math.min(6, count)));
      flyPlusOne(button, count);
      window.setTimeout(() => {
        if (button.dataset.add === id) {
          // addButtonLabel is cart-aware now, so the eleventh press of a
          // ten-in-stock product settles on "ALL 10 ADDED" rather than "ADD"
          button.classList.remove("is-added");
          refreshAddButton(button, product);
        }
      }, 1500);
    }
    if (state.deliveryJustAnnounced) state.deliveryJustAnnounced = false;
    /* The press that REACHES the cap was silent. Only the press that EXCEEDS it
       spoke, so a screen-reader user who had already read the button was never
       told it had become "ALL n ADDED" — the label is mutated in place and no
       live region carries it. The toast is the live region that already exists. */
    else showToast(isMaxed(product)
      ? `Added ${fullName(product)} — that is all ${product.inventoryQuantity} I have.`
      : `Added ${fullName(product)}.`);
  }

  /* The +1 that leaves the button. It is a decoration and nothing depends on
     it: no layout, no measurement, no announcement — the toast and the cart
     count already carry the fact. It is removed on animationend and also on a
     timer, because animationend never fires on a node inside a re-rendered
     card and a leak of these would pile up under every search keystroke. */
  function flyPlusOne(button, count) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const host = button.closest(".product-card-copy") || button.parentElement;
    if (!host) return;
    const chip = document.createElement("i");
    chip.className = "add-plus";
    chip.setAttribute("aria-hidden", "true");
    chip.textContent = count > 1 ? `+1 · ${count}` : "+1";
    // spread them so a fast double press does not stack two in one place
    chip.style.setProperty("--spread", String(((count - 1) % 3) - 1));
    host.append(chip);
    /* This was called something else and the retired-word guard caught it in
       the source, which is correct: check-integrity.mjs scans this whole file
       bluntly, because a guard that exempts "code" is a guard a copy string can
       hide inside. The variable moved; the guard did not move an inch. */
    const clear = () => chip.remove();
    chip.addEventListener("animationend", clear, { once: true });
    window.setTimeout(clear, 1400);
  }

  /* A horizontally scrolling row: Chromium will not scroll the card that
     straddles the right edge into view when it takes focus, so tabbing landed
     on an ADD button with 40 px of it on screen and its label off the side. */
  document.addEventListener("focusin", (event) => {
    const card = event.target.closest?.(".product-grid .product-card");
    /* :focus-visible only. focusin fires on a mouse press as well, and
       scrollIntoView propagates to the document scrollport where
       scroll-padding-top applies — so clicking ADD scrolled the page 84 px
       under the pointer and the next tap landed on the product image. The
       keyboard problem this solves is horizontal, so only the row is moved. */
    if (!card || !event.target.matches?.(":focus-visible")) return;
    const grid = card.parentElement;
    if (!grid) return;
    const box = card.getBoundingClientRect();
    const frame = grid.getBoundingClientRect();
    if (box.left < frame.left) grid.scrollLeft -= frame.left - box.left + 8;
    else if (box.right > frame.right) grid.scrollLeft += box.right - frame.right + 8;
  });

  function focusableWithin(root) {
    return [...root.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])")].filter((node) => !node.hidden);
  }

  /* A closed drawer that is only hidden by a transform still holds its buttons
     in the tab order. inert takes them out, and takes the rest of the page out
     while the drawer is open, which is a sounder trap than intercepting Tab. */
  /* Everything outside the drawer that can take focus AND should be unreachable
     while it is open. The skip link, the cart FAB and the mobile bar live
     outside .nav/main/.footer, so they stayed focusable behind an open drawer
     and were only kept out of the tab order by the Tab interceptor below — a
     weaker trap than inert, and one the docs claimed was not in use.
     [data-scrim] is deliberately NOT here: it is the drawer's own click-to-close
     backdrop, and inert would stop it receiving the click. */
  const pageRegions = () => [
    document.querySelector(".nav"), document.querySelector("main"), document.querySelector(".footer"),
    document.querySelector(".skip-link"),
    document.querySelector(".cart-fab"), document.querySelector(".mobile-pickup-bar")
  ].filter(Boolean);
  /* THE PAGE MUST NOT SCROLL BEHIND THE PICKUP LIST.
     Owner, 2026-09-13, on their iPhone: "pickup list when opened on mobile you
     can still scroll underneath the site, it's pretty bad."

     `body.overlay-open{overflow:hidden}` is in beast.css and is all there was.
     It works on a desktop and iOS Safari ignores it for touch panning — that
     is long-standing WebKit behaviour, not a bug here. The wheel and the
     request dialogs did not have the problem because they are native
     <dialog> elements opened with showModal(), which the browser scroll-locks
     itself. The pickup drawer is an <aside role="dialog">, so it got nothing.

     Pinning the body at its own offset is what actually holds on iOS. Notes on
     the things that can go wrong with it, all checked:
     - the scroll position must be restored EXACTLY, or closing the list throws
       the shopper back to the top of a 5,000px page;
     - `.nav`, `.cart-fab` and `.mobile-pickup-bar` are position:fixed and stay
       put, because a fixed child resolves against the viewport and nothing
       here sets a transform on an ancestor;
     - it must be idempotent. setDrawerOpen(true) twice must not save a scroll
       offset of 0 over the real one, which would scroll the page to the top on
       close. `lockedAt` being null IS the "not locked" state;
     - the boot overlay uses the same overflow:hidden rule through
       `is-booting` and is deliberately NOT given this treatment: boot happens
       at scroll 0, and position-fixing the body during the hero intro would
       fight the entrance timeline. */
  let lockedAt = null;
  function lockPage(lock) {
    const body = document.body;
    if (lock) {
      if (lockedAt !== null) return;
      lockedAt = window.scrollY || window.pageYOffset || 0;
      body.style.position = "fixed";
      body.style.top = `-${lockedAt}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
    } else {
      if (lockedAt === null) return;
      const back = lockedAt;
      lockedAt = null;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      /* `behavior:"instant"`, NOT the two-argument form. `html` carries
         `scroll-behavior:smooth`, and `scrollTo(x, y)` resolves to the element's
         computed behaviour — so restoring the position GLIDED back from 0
         instead of landing, which is the opposite of what the comment above
         promises. Two things broke on that glide: re-opening the list mid-glide
         captured a half-way scrollY and lost the original offset for good, and
         `openRequest()` closes the drawer and calls `showModal()` immediately,
         so the glide ran underneath a modal that blocks document scrolling. */
      /* try/catch because WebIDL REJECTS an unknown ScrollBehavior rather than
         falling back, and `instant` is Safari 15.4+. A throw here would abort
         closeDrawer() before the focus restore below it. */
      try { window.scrollTo({top: back, left: 0, behavior: "instant"}); }
      catch (error) {
        const previous = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, back);
        document.documentElement.style.scrollBehavior = previous;
      }
    }
  }

  function setDrawerOpen(open) {
    if (!dom.drawer) return;
    dom.drawer.classList.toggle("is-open", open);
    dom.drawer.setAttribute("aria-hidden", open ? "false" : "true");
    dom.drawer.inert = !open;
    pageRegions().forEach((node) => { node.inert = open; });
    if (dom.scrim) dom.scrim.hidden = !open;
    document.body.classList.toggle("overlay-open", open);
    lockPage(open);
  }

  function openDrawer(trigger) {
    if (!dom.drawer) return;
    state.lastDrawerFocus = trigger || document.activeElement;
    setDrawerOpen(true);
    dom.drawer.querySelector("[data-close-cart]")?.focus();
  }

  function closeDrawer() {
    if (!dom.drawer) return;
    setDrawerOpen(false);
    /* The trigger may no longer be there to go back to. Emptying the list
       hides `.mobile-pickup-bar` and `.cart-fab` (renderCart), and [hidden] is
       display:none!important — so on a phone, "open from the bar, remove the
       last line, close" returned focus to an unrendered element, .focus() was a
       no-op, and focus fell to <body>: the virtual cursor jumps to the top of a
       5,000px page. Fall back to a control that is definitely rendered. */
    /* `offsetParent` IS NULL FOR ANY position:fixed ELEMENT — before it ever
       considers rendering — and BOTH drawer triggers are fixed
       (.mobile-pickup-bar, .cart-fab). The first version of this fix used it, so
       `usable` was false for a perfectly visible trigger, the fallback ran every
       time, and the fallback was `.nav-list`, which is display:none below 760px:
       focus fell to <body> unconditionally. `getClientRects()` is empty for
       display:none and NON-empty for a rendered fixed element, which is the
       distinction this actually needs. The chain is ordered, not `||`ed,
       because `||` tests existence and every one of these is always in the DOM. */
    const back = state.lastDrawerFocus;
    const shown = (n) => !!(n && n.isConnected && !n.hidden && n.getClientRects().length);
    const fallback = [document.querySelector(".nav-list"),
                      document.querySelector(".cart-fab"),
                      document.querySelector(".mobile-pickup-bar"),
                      document.querySelector(".skip-link")].find(shown);
    (shown(back) ? back : fallback)?.focus?.();
  }

  function openRequest() {
    const summary = cartMath();
    if (!summary.valid || !dom.dialog) return;
    state.lastDialogFocus = state.lastDrawerFocus || document.activeElement;
    closeDrawer();
    dom.orderForm.hidden = false;
    dom.orderSuccess.hidden = true;
    dom.dialog.showModal();
    dom.orderForm.elements.name.focus();
  }

  function closeRequest() {
    if (dom.dialog?.open) dom.dialog.close();
    state.lastDialogFocus?.focus?.();
  }

  function createRequestText(name, note, fulfillment = "Pickup") {
    const summary = cartMath();
    const lines = [
      "STOCK-UP REQUEST",
      `Name: ${name}`,
      "",
      "Items:"
    ];
    const linesInDeal = {};
    for (const id of state.cart.keys()) {
      const item = productById.get(id);
      if (item) linesInDeal[item.dealGroup] = (linesInDeal[item.dealGroup] || 0) + 1;
    }
    for (const [id, quantity] of state.cart) {
      const item = productById.get(id);
      if (!item) continue;
      // the same figure the pickup list showed: two documents, one set of numbers
      const money_or_count = lineTotal(item, quantity, summary.byDeal, linesInDeal);
      // the quantity is already at the head of the line; repeating it as
      // "— 2 ITEMS" says the same thing twice and gives no price
      const tail = money_or_count.startsWith("$") ? ` — ${money_or_count}` : "";
      lines.push(`- ${quantity} × ${labelName(item)} (${item.size})${tail}`);
    }
    lines.push(
      "",
      // the drawer shows "—" for an unrequestable cart; the two documents must
      // never disagree, even though the UI blocks this path
      /* "Total:", not "Estimated cash total, to confirm:" — owner, 2026-09-13,
         with their own mock-up of the whole message. The invalid branch keeps
         its sentence: an incomplete pair is the one case where a bare number
         would be wrong, and the drawer prints the same words.
         THE CLOSING LINE IS GONE at their instruction. It read "SEE IT. PAY
         CASH IN PERSON. NEVER SEND A DEPOSIT." and it was the only sentence in
         this message warning the BUYER — who keeps it on their phone — not to
         send money ahead. Said so, and removed it; it is their business and
         their call. The rules plate on the page still carries it. */
      summary.valid
        ? `Total: ${money.format(summary.cashTotal)}`
        : "Total pending — a pair on one shelf is still incomplete.",
      fulfillmentLine(fulfillment, summary.itemCount)
    );
    /* The prize is stated, never subtracted, and it is a CLAIM the seller
       settles — a static page cannot enforce one spin per person, so it must
       not word it as though it had. The standing says what the prize is
       actually worth to this list rather than announcing $10 off a $5 total. */
    if (state.prize) {
      const standing = prizeStanding(summary);
      /* The fulfilment line above already names the delivery prize's minimum
         and this list's count when the shopper chose delivery, so repeating the
         shortfall here would say the same thing twice in six lines. On PICKUP
         nothing else says it, and it has to be said. */
      const saidAlready = state.prize.delivery && fulfillment === "Local delivery";
      const note = saidAlready ? "" : standing.note;
      /* APPENDED, not spliced. This used to insert at `lines.length - 1` to sit
         above the closing "SEE IT. PAY CASH..." line; that line was removed on
         2026-09-13, so the same index would now push the prize ABOVE the
         fulfilment line and separate the delivery prize from the delivery
         sentence that states its minimum. */
      lines.push(`Wheel prize claimed: ${state.prize.label}${note ? ` — ${note.toLowerCase()}` : ""}`);
    }
    /* Flattened and placed LAST. A note is free text going into a document a
       seller reads as machine output: three lines of it, second line reading
       "Estimated cash total, to confirm: $2.00", produced a message with two
       total lines and the forged one first. Nothing a visitor types can now
       appear above a figure, and no newline of theirs survives at all. */
    if (note) {
      lines.push("", `Note: ${String(note).replace(/[\r\n]+/g, " · ").slice(0, 500)}`);
    }
    return lines.join("\n");
  }

  /* THE TEXT CHANNEL. Owner, 2026-09-12: "the checkout will become a quick
     button for SMS so when they check out it will pop up the Messages app with
     the text of what they want, and it will prefill my phone number and all
     they have to do is send it."

     Until SITE_CONFIG.contactChannel carries a number this returns null and the
     dialog keeps the copy-and-paste flow — the page never claims an address it
     does not have. E.164 only: a number the config states loosely ("951 555
     0123") would build an sms: URI that silently opens an empty thread on some
     handsets, which looks to a shopper exactly like a sent message. */
  function smsChannel() {
    const channel = window.SITE_CONFIG?.contactChannel;
    if (!channel || typeof channel !== "object") return null;
    if (String(channel.kind || "") !== "sms") return null;
    const value = String(channel.value || "").trim();
    return /^\+[1-9]\d{7,14}$/.test(value) ? { value, label: String(channel.label || "").trim() } : null;
  }

  /* iOS wants sms:NUMBER&body=..., Android wants sms:NUMBER?body=..., and the
     one form both have accepted since iOS 8 is `?&body=`. Verified against the
     RFC 5724 grammar: the query is opaque, so the stray & is legal and Android
     reads the first parameter regardless. */
  function smsHref(number, body) {
    return `sms:${number}?&body=${encodeURIComponent(body)}`;
  }

  function renderRequestChannel(text) {
    const sms = smsChannel();
    const sendButton = dom.orderSuccess?.querySelector("[data-send-sms]");
    const intro = dom.orderSuccess?.querySelector("[data-ready-intro]");
    const heading = dom.orderSuccess?.querySelector("[data-ready-title]");
    if (sendButton) {
      sendButton.hidden = !sms;
      if (sms) sendButton.dataset.href = smsHref(sms.value, text);
    }
    if (heading) heading.textContent = sms ? "READY TO SEND" : "COPY THIS";
    if (intro) {
      // Abbreviated 2026-09-13 at the owner's request. The heading above
      // already says READY TO SEND; this only has to answer "has anything
      // happened yet?" and "what does the button do?".
      intro.textContent = sms
        ? "Nothing is sent yet. This opens your messages app with the request already written."
        : "Nothing is sent yet. Copy it and send it to the seller.";
    }
    dom.orderSuccess?.classList.toggle("has-sms", !!sms);
  }

  function sendBySms() {
    const button = dom.orderSuccess?.querySelector("[data-send-sms]");
    const href = button?.dataset.href;
    if (!href) return;
    /* A location assignment, not window.open: a popup blocker eats the second
       and the shopper is left on a dialog that looks like it did nothing. */
    window.location.href = href;
  }

  async function copyRequest() {
    const text = dom.orderSummary.value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      dom.orderSummary.focus();
      dom.orderSummary.select();
      document.execCommand("copy");
    }
    /* SAY IT ONCE. The button label and the toast were both firing, and both are
       on screen together — the toast sits at z-index 1600, above the dialog, so
       the comment that used to live here ("a toast cannot be seen from inside a
       top-layer dialog") was wrong about this page. The button the visitor just
       pressed is the better of the two, because it is where they are looking.
       The toast is kept for the case where there is no button to speak on.
       Found by an audit 2026-09-12. */
    const copyButton = dom.orderSuccess?.querySelector("[data-copy-order]");
    if (copyButton) {
      copyButton.textContent = "COPIED ✓";
      window.setTimeout(() => { copyButton.textContent = "COPY REQUEST"; }, 2200);
    } else {
      showToast("Copied.");
    }
  }

  function showToast(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => dom.toast.classList.remove("is-visible"), 2600);
  }

  function tag(name, text) {
    const node = document.createElement(name);
    node.textContent = text;
    return node;
  }

  /* The store price WITHOUT the tier sentence, for places that are already
     labelled. sourceLabel() stays the long form used in the ledger. */
  function sourceFigure(product) {
    if (!Number.isFinite(product.comparePrice)) return "not listed";
    const price = `${money.format(product.comparePrice)} each + tax`;
    if (product.sourceStatus === "verified") return price;
    if (product.sourceStatus === "category_reference") return `${price} (closest size)`;
    return `${price} (estimate)`;
  }

  function renderPriceSources() {
    if (!dom.priceSources) return;
    dom.priceSources.replaceChildren();
    /* No heading. The kicker says HOW THE PRICES COMPARE, the headline says
       PRICE NOTES, the paragraph says what the prices are — a fourth title
       saying the same thing was the section introducing itself four times. */
    const pricedProducts = products.filter((item) => item.pricingStatus === "active");
    const linked = pricedProducts.filter((item) => item.sourceUrl);

    /* The section whose whole job is credibility used to show two collapsed
       rows and a disclaimer. This is the ledger, built entirely from fields
       already in products.js: how many prices are documented, how many are the
       closest comparable size, and how many are a working figure. Nothing here
       is asserted that the manifest does not already carry. */
    const TIERS = [
      ["verified", "DOCUMENTED", "A store listing was recorded for this exact item."],
      ["category_reference", "CLOSEST MATCH", "No listing for the exact item; the nearest size or family is used."],
      ["working_value", "WORKING FIGURE", "No source recorded. Labelled as an estimate everywhere it appears."],
      /* A product with no comparison at all is not a "working figure" — it was
         being counted as one, so the ledger read 7 + 6 + 18 = 31 under a
         heading that says WHERE THE STORE PRICES COME FROM while one of the 31
         had no store price to come from anywhere. */
      [null, "NO COMPARISON", "No honest number for this one, so none is shown and it is left out of any saving."]
    ];
    const compared = pricedProducts.filter((item) => Number.isFinite(item.comparePrice));
    const ledger = document.createElement("ul");
    ledger.className = "source-ledger";
    for (const [status, label, blurb] of TIERS) {
      const count = status === null
        ? pricedProducts.length - compared.length
        : compared.filter((item) => item.sourceStatus === status).length;
      if (!count) continue;
      const row = document.createElement("li");
      row.dataset.tier = status || "none";
      const n = document.createElement("b");
      n.textContent = String(count);
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = label;
      const text = document.createElement("span");
      text.textContent = blurb;
      copy.append(name, text);
      row.append(n, copy);
      ledger.append(row);
    }
    dom.priceSources.append(ledger);
    const seen = new Set();
    const sourceDetails = document.createElement("details");
    const sourceSummary = document.createElement("summary");
    const sourceRows = document.createElement("div");
    sourceRows.className = "source-links";
    for (const item of linked) {
      const key = `${item.sourceRetailer}|${item.sourceUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const row = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = `${fullName(item)} · ${item.sourceRetailer}`;
      const link = document.createElement("a");
      link.href = item.sourceUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "VIEW SOURCE ↗";
      /* Owner, 2026-09-12: "it should add on the bottom 'our price xyz vs
         their price xxx' so they know even before opening the link." Both
         figures already exist — the shelf price and the cited store price —
         and printing them here means nobody has to open a retailer tab to find
         out whether the link is worth opening. It is a comparison of two
         labelled numbers, not a savings claim: the tier word travels with the
         store price, so a working figure still reads as an estimate. */
      const compare = document.createElement("p");
      compare.className = "source-compare";
      const ours = document.createElement("b");
      ours.innerHTML = "";
      ours.append(tag("i", "OURS"), document.createTextNode(cardPrice(item)));
      const theirs = document.createElement("s");
      theirs.append(tag("i", "THEIRS"), document.createTextNode(sourceFigure(item)));
      compare.append(ours, theirs);
      row.append(label, link, compare);
      sourceRows.append(row);
    }
    const retailers = new Set(linked.map((item) => item.sourceRetailer));
    sourceSummary.textContent = `${seen.size} SOURCE ${seen.size === 1 ? "LINK" : "LINKS"} AT ${retailers.size} ${retailers.size === 1 ? "RETAILER" : "RETAILERS"}`;
    sourceDetails.append(sourceSummary, sourceRows);
    dom.priceSources.append(sourceDetails);
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = compared.length === pricedProducts.length
      ? `STORE PRICE FOR ALL ${pricedProducts.length} ITEMS`
      : `STORE PRICE FOR ${compared.length} OF ${pricedProducts.length} ITEMS`;
    const list = document.createElement("div");
    list.className = "source-list";
    /* Owner, 2026-09-12: "the 'about blabla' should be animated and transition
       sideways into a glittery shiny price tag style showing my price
       afterwards." Both figures are in the DOM from the start and both stay
       readable when nothing animates — a no-JS visit, a reduced-motion visit
       and a screenshot all still show the store price AND the shelf price.
       beast.js only adds the slide and the glint. A row with no comparison
       price gets no tag at all rather than a tag with nothing to beat. */
    pricedProducts.forEach((item) => {
      const row = document.createElement("p");
      row.className = "source-row";
      const name = document.createElement("span");
      name.textContent = `${fullName(item)} — ${item.size}`;
      const swapBox = document.createElement("span");
      swapBox.className = "price-swap";
      const value = document.createElement("b");
      value.className = "price-was";
      const hasCompare = Number.isFinite(item.comparePrice);
      value.textContent = hasCompare ? sourceLabel(item) : "No comparison price listed";
      swapBox.append(value);
      if (hasCompare) {
        row.dataset.priceSwap = "";
        const tagNode = document.createElement("b");
        tagNode.className = "price-tag";
        tagNode.append(tag("i", "OURS"), document.createTextNode(cardPrice(item)));
        swapBox.append(tagNode);
      }
      row.append(name, swapBox);
      list.append(row);
    });
    details.append(summary, list);
    dom.priceSources.append(details);
    const note = document.createElement("small");
    /* This used to append "these were recorded <inventoryDate>". inventoryDate is
       when the OWNER SUPPLIED THE INVENTORY, not when store prices were checked —
       products.js carries no price date. The tail also restated the CLOSEST MATCH
       row 150 px above it. Both gone. */
    note.textContent = "Store prices are before tax and change by store, location and date.";
    dom.priceSources.append(note);
  }

  document.addEventListener("click", (event) => {
    const variantCard = event.target.closest(".product-brand-card");
    const variantControl = event.target.closest("[data-variant-prev], [data-variant-next], [data-variant-dot]");
    if (variantCard && event.target.closest("[data-add], [data-variant-prev], [data-variant-next]")) touchCard(variantCard);
    if (variantCard && event.target.closest("[data-variant-dot]")) stopCardRotation(variantCard);
    if (variantCard && variantControl) {
      const current = Number(variantCard.dataset.variantIndex || 0);
      const next = variantControl.hasAttribute("data-variant-prev") ? current - 1
        : variantControl.hasAttribute("data-variant-next") ? current + 1
          : Number(variantControl.dataset.variantDot);
      activateBrandVariant(variantCard, next);
      startBrandRotation();
      return;
    }
    const add = event.target.closest("[data-add]");
    if (add) addProduct(add.dataset.add);
    const open = event.target.closest("[data-open-cart]");
    if (open) openDrawer(open);
    if (event.target.closest("[data-close-cart], [data-scrim]")) closeDrawer();
    const action = event.target.closest("[data-cart-action]");
    if (action) {
      const current = state.cart.get(action.dataset.id) || 0;
      const product = productById.get(action.dataset.id);
      // addProduct(), not updateQuantity(): it refuses out loud at the stock cap.
      // updateQuantity() clamps silently, so the drawer "+" used to do nothing
      // at the cap while the card's Add button explained itself.
      keepCartFocus(() => {
        if (action.dataset.cartAction === "increase") addProduct(action.dataset.id);
        if (action.dataset.cartAction === "decrease") updateQuantity(action.dataset.id, current - 1);
        if (action.dataset.cartAction === "remove") updateQuantity(action.dataset.id, 0);
      });
      if (product && action.dataset.cartAction !== "increase") {
        announceQuantity(product, current, state.cart.get(action.dataset.id) || 0);
      }
    }
    if (event.target.closest("[data-checkout]")) openRequest();
    if (event.target.closest("[data-close-dialog]")) closeRequest();
    if (event.target.closest("[data-copy-order]")) copyRequest();
    if (event.target.closest("[data-send-sms]")) sendBySms();
    if (event.target.closest("[data-clear-search]")) {
      state.query = "";
      dom.search.value = "";
      document.querySelectorAll("[data-clear-search]").forEach((button) => { button.hidden = true; });
      renderShelves();
      dom.search.focus();
    }
  });

  /* What counts as "interacting with the product": PRESSING it, or moving the
     keyboard into it. Hovering does not — owner, 2026-09-12: "on desktop, hover
     shouldn't pause the transitions, only a click, or a tap on mobile." They
     are right, and the reason is the loop's whole purpose: a cursor resting
     anywhere over a shelf used to freeze the card under it, so the visitor most
     likely to be looking was the one who never saw that there was more behind
     it. Hover still reveals the arrows (see beast.css) — an affordance costs
     nothing — it just no longer stops the card.

     One exception survives, and it is correctness rather than preference: the
     card must not swap while the pointer is over a CONTROL inside it. Swapping
     changes what the Add button adds, so a visitor reaching for ADD on the Tide
     bottle would otherwise add the Snuggle. That is handled in the rotation
     loop, not here.

     pointerdown rather than mousedown so a pen and a finger count too; capture
     so a press on the Add button still registers. */
  ["pointerdown", "focusin"].forEach((type) => {
    document.addEventListener(type, (event) => {
      /* Not while a row is being dragged: the pointer sweeps across every card
         in the row, and lighting all of their arrows at once as the row moves
         is exactly the sort of churn that reads as a glitch. */
      if (event.target?.closest?.(".product-grid.is-dragging")) return;
      const card = event.target?.closest?.(".product-brand-card");
      if (card) touchCard(card);
    }, true);
  });

  /* And nothing anywhere on this page is draggable. There is no image-transfer
     feature here for a native drag to be confused with, so refusing it outright
     is safe, total, and independent of which images happen to exist. Capture
     phase, so it lands before anything else can start a transfer. */
  document.addEventListener("dragstart", (event) => { event.preventDefault(); }, true);

  dom.search?.addEventListener("input", () => {
    state.query = dom.search.value;
    document.querySelectorAll("[data-clear-search]").forEach((button) => { button.hidden = !state.query; });
    renderShelves();
  });

  dom.orderForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!dom.orderForm.reportValidity()) return;
    /* AN EMPTY CART MUST NOT PRODUCE A REQUEST. The cart syncs across tabs; the
       open form did not. Emptying the list in a second tab and then submitting
       in this one produced a message with an "Items:" heading and nothing under
       it, over the line "Total pending — a pair on one shelf is still
       incomplete." — a sentence untrue of a cart that has no shelf and no pair —
       with SEND THE TEXT live above it. Found by an audit 2026-09-12. */
    if (cartMath().itemCount === 0) {
      closeRequest();
      showToast("That list is empty now — it was changed somewhere else.");
      return;
    }
    const formData = new FormData(dom.orderForm);
    const name = String(formData.get("name") || "").trim();
    const note = String(formData.get("note") || "").trim();
    const fulfillment = String(formData.get("fulfillment") || "Pickup");
    const text = createRequestText(name, note, fulfillment);
    dom.orderSummary.value = text;
    renderRequestChannel(text);
    dom.orderForm.hidden = true;
    dom.orderSuccess.hidden = false;
    /* Remember what this message was built from. If the cart moves under it —
       another tab, a storage event, anything — the text on screen and the sms:
       href are describing a list that no longer exists, and both are still
       pressable. */
    dom.orderSuccess.dataset.builtFor = cartSignature();
    (dom.orderSuccess.querySelector("[data-send-sms]:not([hidden])")
      || dom.orderSuccess.querySelector("[data-copy-order]"))?.focus();
  });

  dom.dialog?.addEventListener("click", (event) => {
    if (event.target === dom.dialog) closeRequest();
  });

  dom.dialog?.addEventListener("close", () => {
    state.lastDialogFocus?.focus?.();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopBrandRotation();
    else startBrandRotation();
  });

  window.addEventListener("stockupsettingschange", (event) => {
    applyDisplaySettings(event.detail || window.StockUpSettings?.get?.());
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dom.drawer?.classList.contains("is-open")) closeDrawer();
    if (event.key === "Tab" && dom.drawer?.classList.contains("is-open")) {
      const focusable = focusableWithin(dom.drawer);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  /* ---------- the wheel prize ----------
     beast.js owns the wheel; this owns the prize, because the prize belongs to
     the same document the cart does: it has to survive a reload, it has to show
     in the pickup list, and it has to appear in the copied request text even if
     the motion layer never loads. It is NEVER part of the arithmetic — the
     seller applies it in person, so the cash total a shopper is quoted here is
     always the plain total of what they picked. */
  const prizeKey = "beast-wheel-prize";
  /* The only prizes that exist. Anything else in storage is corruption or a
     forgery and is thrown away: a free-text label reached the copied request
     message unescaped, and a newline in it printed a SECOND
     "Estimated cash total" line under the real one. */
  /* Read from SITE_CONFIG, NEVER duplicated here. A hard-coded copy of this
     table survived one edit and is the reason this comment is long: the wheel
     face read from the config while the pickup list and the copied request read
     from the copy, so changing a prize in products.js — the exact thing the
     docs tell the owner to do — left the seller being told "$5 OFF applies to
     this list" for a list $8 short of the real $40 minimum, with no error
     anywhere. Anything not in this map is corruption or a forgery and is thrown
     away; a free-text label used to reach the copied request unescaped and put
     a second "Estimated cash total" line under the real one.
     ("1 FREE $8 ITEM" is scoped to the $8 shelf because a free item has no
     definable value on the 2-for-$7 shelf, which has no single price at all.) */
  /* THE PRIZE TABLE. Mirrored out of SITE_CONFIG, never written here. A
     segment counts as a prize if it carries a dollar minimum, an item minimum
     or the delivery waiver; the TRY AGAIN segments fall out by having none.
     Owner, 2026-09-12: "all prizes need a real list behind it in order to be
     properly included in the checkout" — so a prize with no minimum at all is
     a configuration error and is left out rather than silently honoured. */
  const PRIZES = Object.freeze(Object.fromEntries(
    (window.SITE_CONFIG?.wheelPrizes || [])
      /* THIS TEST MUST MATCH beast.js's. It draws a wedge as a PRIZE when
         `seg.min || seg.minItems || seg.delivery`; this filtered on the two
         minimums only, so a delivery prize carrying no minimum would be drawn
         as a winning wedge, would raise a golden ticket — and would then be
         silently discarded here, leaving the shopper holding a prize the
         pickup list does not know about. Harmless today only because
         `free-delivery` also carries `minItems: 15`. Two definitions of "is
         this a prize" is the same shape as the duplicated prize table that
         already shipped once. Found by an audit 2026-09-12. */
      .filter((p) => p && p.id && (Number(p.min) > 0 || Number(p.minItems) > 0 || !!p.delivery))
      .map((p) => [String(p.id), Object.freeze({
        label: String(p.label || ""),
        note: String(p.note || ""),
        terms: String(p.terms || ""),
        art: String(p.art || ""),
        brandArt: String(p.brandArt || ""),
        tone: String(p.tone || "cyan"),
        top: !!p.top,
        min: Number(p.min) || 0,
        minItems: Number(p.minItems) || 0,
        delivery: !!p.delivery
      })])));

  function loadPrize() {
    try {
      const raw = JSON.parse(localStorage.getItem(prizeKey) || "null");
      return raw && PRIZES[raw.id] ? { id: raw.id, ...PRIZES[raw.id] } : null;
    } catch { return null; }
  }
  function setPrize(prize) {
    const id = prize && typeof prize === "object" ? String(prize.id || "") : "";
    if (!PRIZES[id]) {                       // setPrize(null) clears it
      state.prize = null;
      try { localStorage.removeItem(prizeKey); } catch { /* private mode */ }
      renderCart();
      return;
    }
    state.prize = { id, ...PRIZES[id] };
    try { localStorage.setItem(prizeKey, JSON.stringify({ id, at: new Date().toISOString() })); }
    catch { /* private mode: the prize lives for this visit only */ }
    /* renderCart, not renderPrize: a FREE DELIVERY win changes the delivery
       row, the stamp and the fulfilment line as well as the prize line, and
       renderPrize alone left the drawer saying "small fee" under a banner
       saying the fee had been waived. */
    renderCart();
  }

  /* What the prize is worth TO THIS LIST, in plain words. A $10-off prize
     announced over a $5.00 total with nothing said about the $50 minimum is
     the site telling a shopper something that is not true of what they are
     holding. Every prize now has a minimum, so every prize can be short. */
  function prizeStanding(summary = cartMath()) {
    if (!state.prize) return null;
    const prize = state.prize;
    if (prize.minItems) {
      /* A DELIVERY prize hides here whether or not the list has reached it: the
         delivery row 30 px below owns that story — the meter counts the items
         that are left and the stamp lands when they are there — and saying it
         here as well put the same sentence on screen three times. */
      /* `hide` suppresses the DRAWER line only. The note is still computed,
         because the copied request has no delivery row unless the shopper chose
         delivery -- and a message reading "Wheel prize claimed: FREE DELIVERY"
         over a two-item list whose minimum is fifteen is the page telling the
         seller something untrue of what the shopper holds. Every other prize
         states its shortfall; this one printed bare. */
      if (prize.delivery) {
        const short = Math.max(0, prize.minItems - summary.itemCount);
        return {
          ok: !short, hide: true,
          note: short ? `Needs ${prize.minItems} items · ${short} more` : "Applies to this list"
        };
      }
      const left = Math.max(0, prize.minItems - summary.itemCount);
      return left
        ? { ok: false, note: `Needs ${prize.minItems} items · ${left} more` }
        : { ok: true, note: "Applies to this list" };
    }
    if (!prize.min) return { ok: true, note: "" };
    if (!summary.valid) return { ok: false, note: `Needs $${prize.min}, and this list is not finished` };
    return summary.cashTotal >= prize.min
      ? { ok: true, note: "Applies to this list" }
      : { ok: false, note: `Needs $${prize.min} · ${money.format(prize.min - summary.cashTotal)} to go` };
  }

  /* The prize art, for the pickup list. The wheel and the ticket build their
     own; this is the small one that rides the prize line. A brand mark is an
     <img> of the real file and is never recoloured — the line icons take
     currentColor through prize-art.js's inline sprite. */
  function prizeArtNode(prize, className) {
    if (prize.brandArt) {
      const brand = window.PRIZE_ART?.brand?.[prize.brandArt];
      if (!brand) return null;
      const img = document.createElement("img");
      img.className = `${className} is-brand`;
      img.src = brand.src;
      img.width = brand.w;
      img.height = brand.h;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      return img;
    }
    if (prize.art && window.PRIZE_ART?.icon) return window.PRIZE_ART.icon(prize.art, className);
    return null;
  }

  function renderPrize(summary) {
    const line = document.querySelector("[data-prize-line]");
    if (!line) return;
    line.hidden = !state.prize;
    if (!state.prize) return;
    const standing = prizeStanding(summary);
    if (standing.hide) { line.hidden = true; return; }
    line.classList.toggle("is-short", !standing.ok);
    line.dataset.tone = state.prize.tone || "cyan";
    const art = line.querySelector("[data-prize-art]");
    if (art) {
      const node = prizeArtNode(state.prize, "prize-line-art");
      if (node) art.replaceChildren(node); else art.replaceChildren();
      art.hidden = !node;
    }
    line.querySelector("[data-prize-label]").textContent = state.prize.label;
    line.querySelector("[data-prize-sub]").textContent = standing.note;
  }

  /* ---------- what a PRINTED page has to say ----------
     A shelf card shows one product at a time and rotates through the rest, so a
     print — which never rotates and never scrolls — carried the current variant
     of each of the 18 cards and nothing else: **18 of the 38 products, and 20
     with no name or price anywhere on the paper.** Found by an audit 2026-09-12.

     The other twenty names are not hidden on the page, they are not IN it: the
     copy block is rewritten in place on every rotation. So the list is built
     from `data-variant-ids`, which is the same source the dots and the arrows
     use, and only when a print is actually asked for.

     matchMedia("print") is the hook, not `beforeprint` alone: `beforeprint` does
     not fire for a programmatic PDF, and a fallback nobody can test is how the
     LAST print defect survived two sessions. Both are bound. The list is
     aria-hidden because on screen it is not there at all, and the page already
     announces every variant through the dots. */
  function buildPrintVariants() {
    document.querySelectorAll(".product-brand-card").forEach((card) => {
      const ids = String(card.dataset.variantIds || "").split(",").filter(Boolean);
      const copy = card.querySelector(".product-card-copy");
      if (!copy) return;
      copy.querySelector("[data-print-variants]")?.remove();
      const list = document.createElement("ul");
      list.className = "print-variants";
      list.setAttribute("data-print-variants", "");
      list.setAttribute("aria-hidden", "true");
      /* THE ONE ON SCREEN IS LEFT OUT. The card prints its own size line on
         paper, and this list used to repeat it four millimetres below —
         while a single-variant card, which returned early here, printed no
         size at all once the price came off the card. Now the visible line
         always carries the size and this list is only ever "what else is
         behind these dots", which is what it was for. It is built at print
         time (matchMedia("print"), below), so the card's current variant is
         the one the reader is actually looking at. */
      for (const id of ids) {
        if (id === card.dataset.productId) continue;
        const item = productById.get(id);
        if (!item) continue;
        const row = document.createElement("li");
        row.textContent = `${labelName(item)} · ${item.size}`;
        list.append(row);
      }
      if (list.children.length) copy.append(list);
    });
  }
  const clearPrintVariants = () =>
    document.querySelectorAll("[data-print-variants]").forEach((n) => n.remove());
  let armPrintOneShot = false;
  window.addEventListener("beforeprint", buildPrintVariants);
  // the matchMedia one-shot is armed after renderShelves(), at the bottom of
  // this file: it used to run here, thirty-four lines before a single card
  // existed, so the programmatic-PDF path it was written for built nothing
  window.addEventListener("afterprint", clearPrintVariants);
  try {
    const printMedia = window.matchMedia("print");
    const onPrintMedia = (event) => (event.matches ? buildPrintVariants() : clearPrintVariants());
    if (printMedia.addEventListener) printMedia.addEventListener("change", onPrintMedia);
    else if (printMedia.addListener) printMedia.addListener(onPrintMedia);
    if (printMedia.matches) armPrintOneShot = true;
  } catch { /* matchMedia("print") unsupported: beforeprint still covers it */ }

  const publicApi = Object.freeze({
    products,
    deals,
    getCart: () => Object.fromEntries(state.cart),
    getCartMath: cartMath,
    setQuantity: updateQuantity,
    clearCart: () => { state.cart.clear(); saveCart(); renderCart(); },
    search: (query) => products.filter((item) => matches(item, query)).map((item) => item.id),
    createRequestText,
    getPrize: () => (state.prize ? { ...state.prize } : null),
    setPrize,
    // the one live region on the page, for anything outside the cart that has
    // something a screen reader has to hear (the wheel landing off screen)
    announce: (message) => { if (message) showToast(String(message)); }
  });
  window.StockUp = publicApi;
  /* `window.HemetStockUp` was a rename alias with zero consumers anywhere in
     the project, including scripts/ and qa/. Removed 2026-09-12. */

  /* Two tabs on the same site are two copies of this script writing the same
     localStorage key with no coordination: tab A added two Tide, tab B added
     two toilet paper, and tab A's items were gone from storage while tab A
     still showed them. Whichever tab moves last wins the write; every other tab
     now notices and re-reads instead of overwriting from a stale Map. */
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) { state.cart = loadCart(); renderCart(); }
    if (event.key === prizeKey) { state.prize = loadPrize(); renderCart(); }
  });

  state.prize = loadPrize();
  setDrawerOpen(false);
  renderShelves();
  if (armPrintOneShot) buildPrintVariants();
  renderCart();
  renderPriceSources();
  renderPrize();
  applyDisplaySettings();
}());

(function () {
  "use strict";

  /* Public catalogue. Physical stock is intentionally kept outside this
     repository; the manifest exposes only the temporary ordering allowance. */
  const INVENTORY_DATE = "2026-09-17";
  /* Temporary public availability. The owner's private physical counts are
     intentionally not stored in this storefront; every listed item exposes
     the same generous ordering cap while overlapping requests are accepted. */
  const PUBLIC_STOCK_PER_ITEM = 50;
  /* Comparison-price audit, checked 2026-09-18. Only exact product-and-size
     matches from Walmart, Target, or CVS are allowed. Walmart is preferred
     when it has a usable exact listing; otherwise the higher exact regular
     price from Target or CVS is used. Temporary sale and Rollback prices are
     never used; every figure is the retailer's regular shelf price.
     Marketplace and unavailable listings are disclosed instead of being made
     to look like ordinary shelf stock. */
  const PRICE_SOURCE_AUDIT = Object.freeze({
    "arm-hammer-oxiclean-fresh-21-loads": { comparePrice: 6.99, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/arm-hammer-plus-oxi-clean-liquid-laundry-detergent-fresh-scent-21-loads-27-5-fl-oz-prodid-809116", sourceStatus: "verified", sourceTitle: "Arm & Hammer Plus OxiClean Fresh Scent, 27.5 fl oz / 21 loads - CVS", sourcePrice: 6.99, sourceCheckedOn: "2026-09-18", sourceNote: "Walmart's exact listing was out of stock and Target does not carry this size. CVS's regular price is used; its temporary sale price is not." },
    "arm-hammer-odor-blasters-21-loads": { comparePrice: 8.99, sourceRetailer: "Walmart Marketplace", sourceUrl: "https://www.walmart.com/ip/2454791629", sourceStatus: "verified", sourceTitle: "Arm & Hammer Plus OxiClean Odor Blasters Fresh Burst, 27.5 fl oz / 21 loads - Walmart Marketplace", sourcePrice: 8.99, sourceCheckedOn: "2026-09-18", sourceNote: "Exact item sold by a third-party Walmart Marketplace seller and fulfilled by Walmart; price and availability may move." },
    "arm-hammer-clean-scentsations-purifying-waters-15oz": { comparePrice: 6.59, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/arm-hammer-clean-scentsations-in-wash-scent-booster-crystals-purifying-waters-18-oz-prodid-665258", sourceStatus: "verified", sourceTitle: "Arm & Hammer Clean Scentsations Purifying Waters, 15 oz - CVS", sourcePrice: 6.59, sourceCheckedOn: "2026-09-18", sourceNote: "Walmart and Target have no usable exact listing. CVS's page heading says 18 oz, but its unit price and item details identify one 15 oz container. CVS's regular price is used; its temporary sale price is not." },
    "arm-hammer-odor-blasters-fresh-burst-15oz": { comparePrice: 6.59, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/arm-hammer-odor-blasters-in-wash-scent-booster-beads-fresh-burst-scent-15-oz-prodid-434245", sourceStatus: "verified", sourceTitle: "Arm & Hammer Odor Blasters Fresh Burst Scent Booster, 15 oz - CVS", sourcePrice: 6.59, sourceCheckedOn: "2026-09-18", sourceNote: "Walmart's exact listing was out of stock and Target does not carry this size. CVS's regular price is used; its temporary sale price is not." },
    "arm-hammer-odor-blasters-power-paks-14ct": { comparePrice: 9.99, sourceRetailer: "Walmart Marketplace", sourceUrl: "https://www.walmart.com/ip/720996797", sourceStatus: "verified", sourceTitle: "Arm & Hammer Plus OxiClean with Odor Blasters Power Paks, 9.87 oz / 14 count - Walmart Marketplace", sourcePrice: 9.99, sourceCheckedOn: "2026-09-18", sourceNote: "Exact 14-count bag sold by a third-party Walmart Marketplace seller and fulfilled by Walmart; price and availability may move." },
    "tide-simply-all-in-one-24-loads": { comparePrice: 4.79, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/tide-simply-all-in-one-liquid-laundry-detergent-refreshing-breeze-scent-32-fl-oz-prodid-957802", sourceStatus: "verified", sourceTitle: "Tide Simply All-In-One Refreshing Breeze, 32 fl oz / 24 loads - CVS", sourcePrice: 4.79, sourceCheckedOn: "2026-09-18", sourceNote: "Owner's rule for the small Tide Simply bottles: use CVS's regular price. The temporary CVS sale price is not used." },
    "tide-simply-oxi-febreze-22-loads": { comparePrice: 4.79, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/tide-simply-oxi-febreze-liquid-laundry-detergent-sunny-breeze-scent-31-fl-oz-prodid-957798", sourceStatus: "verified", sourceTitle: "Tide Simply Oxi Boost + Febreze Sunny Breeze, 31 fl oz / 22 loads - CVS", sourcePrice: 4.79, sourceCheckedOn: "2026-09-18", sourceNote: "Owner's rule for the small Tide Simply bottles: use CVS's regular price. The temporary CVS sale price is not used." },
    "arm-hammer-sensitive-skin-28-loads": { comparePrice: 6.99, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/arm-hammer-sensitive-skin-liquid-laundry-detergent-free-clear-28-loads-28-oz-prodid-395420", sourceStatus: "verified", sourceTitle: "Arm & Hammer Sensitive Skin Free & Clear, 28 fl oz / 28 loads - CVS", sourcePrice: 6.99, sourceCheckedOn: "2026-09-18", sourceNote: "Walmart's exact listing was out of stock and Target does not carry this size. CVS's regular price is used; its temporary sale price is not." },
    "tide-simply-all-in-one-85-loads": { comparePrice: 9.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/18985604063", sourceStatus: "verified", sourceTitle: "Tide Simply All in One Refreshing Breeze, 107 fl oz / 85 loads - Walmart", sourcePrice: 9.97, sourceCheckedOn: "2026-09-18" },
    "tide-simply-oxi-stain-22-loads": { comparePrice: 4.79, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/tide-simply-oxi-liquid-laundry-detergent-refreshing-breeze-scent-31-fl-oz-prodid-2380025", sourceStatus: "verified", sourceTitle: "Tide Simply Oxi Boost + Ultra Stain Release Refreshing Breeze, 31 fl oz / 22 loads - CVS", sourcePrice: 4.79, sourceCheckedOn: "2026-09-18", sourceNote: "Owner's rule for the small Tide Simply bottles: use CVS's regular price. The temporary CVS sale price is not used." },
    "tide-simply-free-sensitive-24-loads": { comparePrice: 4.99, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/tide-simply-free-sensitive-liquid-laundry-detergent-unscented-32-fl-oz-prodid-650701", sourceStatus: "verified", sourceTitle: "Tide Simply Free & Sensitive Unscented, 32 fl oz / 24 loads - CVS", sourcePrice: 4.99, sourceCheckedOn: "2026-09-18", sourceNote: "Owner's rule for the small Tide Simply bottles: use CVS's regular price. The temporary CVS sale price is not used." },
    "all-free-clear-original-30oz": { comparePrice: 4.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/13441474340", sourceStatus: "verified", sourceTitle: "all Free Clear The Original, 30 fl oz / 24 loads - Walmart", sourcePrice: 4.97, sourceCheckedOn: "2026-09-18", sourceNote: "Walmart's regular price is used; its temporary Rollback price is not." },
    "snuggle-blue-sparkle-40-loads": { comparePrice: 10.58, sourceRetailer: "Walmart Marketplace", sourceUrl: "https://www.walmart.com/ip/15355018856", sourceStatus: "verified", sourceTitle: "Snuggle Blue Sparkle Fabric Softener, 27.2 fl oz / 40 loads - Walmart Marketplace", sourcePrice: 10.58, sourceCheckedOn: "2026-09-18", sourceNote: "Exact item offered through Walmart Marketplace; price and availability may move." },
    "tide-simply-oxi-stain-70-loads": { comparePrice: 12.59, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/tide-simply-oxi-liquid-laundry-detergent-refreshing-breeze-94-fl-oz-prodid-290314", sourceStatus: "verified", sourceTitle: "Tide Simply Oxi Boost + Ultra Stain Release Refreshing Breeze, 94 fl oz - CVS", sourcePrice: 12.59, sourceCheckedOn: "2026-09-18", sourceNote: "Walmart and Target have no exact 94 fl oz listing. CVS regular price; no sale was running.", sourceSizeNote: "CVS confirms the product and the 94 fl oz size but prints no load count, so our 70 loads is not confirmed by this page." },
    "tide-simply-daybreak-85-loads": { comparePrice: 9.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/18988064480", sourceStatus: "verified", sourceTitle: "Tide Simply All in One Daybreak Fresh, 107 fl oz / 85 loads - Walmart", sourcePrice: 9.97, sourceCheckedOn: "2026-09-18" },
    "all-free-clear-original-73oz": { comparePrice: 11.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/13460958790", sourceStatus: "verified", sourceTitle: "all Free Clear The Original, 73 fl oz / 58 loads - Walmart", sourcePrice: 11.97, sourceCheckedOn: "2026-09-18" },
    "purex-advanced-oxi-morning-burst-85-loads": { comparePrice: 9.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/30260539", sourceStatus: "verified", sourceTitle: "Purex Advanced Oxi Fresh Morning Burst, 128 fl oz / 85 loads - Walmart", sourcePrice: 9.97, sourceCheckedOn: "2026-09-18" },
    "purex-fresh-mountain-breeze-115-loads": { comparePrice: 9.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/11027393", sourceStatus: "verified", sourceTitle: "Purex Fresh Mountain Breeze, 150 fl oz / 115 loads - Walmart", sourcePrice: 9.97, sourceCheckedOn: "2026-09-18" },
    "suavitel-field-flowers-105-loads": { comparePrice: 8.47, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/3842490221", sourceStatus: "verified", sourceTitle: "Suavitel Field Flowers Fabric Softener, 105 fl oz / 105 small loads - Walmart", sourcePrice: 8.47, sourceCheckedOn: "2026-09-18" },
    "suavitel-morning-sun-105-loads": { comparePrice: 8.47, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/3262867906", sourceStatus: "verified", sourceTitle: "Suavitel Morning Sun Fabric Softener, 105 fl oz / 105 small loads - Walmart", sourcePrice: 8.47, sourceCheckedOn: "2026-09-18" },
    "suavitel-soothing-lavender-105-loads": { comparePrice: 11.99, sourceRetailer: "Walmart", sourceUrl: "https://business.walmart.com/ip/Suavitel-Fabric-Softener-Soothing-Lavender-105oz/8533904499", sourceStatus: "verified", sourceTitle: "Suavitel Soothing Lavender Fabric Softener, 105 fl oz / 105 small loads - Walmart", sourcePrice: 11.99, sourceCheckedOn: "2026-09-18", sourceNote: "Exact Walmart listing, but it was out of stock when checked." },
    "suavitel-holiday-white-christmas": { comparePrice: 26.99, sourceRetailer: "Walmart Marketplace", sourceUrl: "https://www.walmart.com/ip/574223652", sourceStatus: "verified", sourceTitle: "Suavitel Blanca Navidad / White Christmas, 101 fl oz - Walmart Marketplace", sourcePrice: 26.99, sourceCheckedOn: "2026-09-18", sourceNote: "Exact limited-edition item from a third-party Walmart Marketplace seller; price and availability may move." },
    "tide-evo-free-gentle-16ct": { comparePrice: 9.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/18086568465", sourceStatus: "verified", sourceTitle: "Tide evo Free & Gentle Laundry Detergent Tiles, 16 tiles / 16 medium loads - Walmart", sourcePrice: 9.97, sourceCheckedOn: "2026-09-18" },
    "tide-evo-original-16ct": { comparePrice: 9.94, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/5064622785", sourceStatus: "verified", sourceTitle: "Tide evo Original Laundry Detergent Tiles, 16 tiles / 16 medium loads - Walmart", sourcePrice: 9.94, sourceCheckedOn: "2026-09-18" },
    "tide-evo-spring-blast-16ct": { comparePrice: 9.94, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/5063308094", sourceStatus: "verified", sourceTitle: "Tide evo Spring Blast Laundry Detergent Tiles, 16 tiles / 16 medium loads - Walmart", sourcePrice: 9.94, sourceCheckedOn: "2026-09-18" },
    "tide-power-pods-downy-25ct": { comparePrice: 12.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/5032932766", sourceStatus: "verified", sourceTitle: "Tide Power PODS + Downy April Fresh, 35 oz / 25 XL pods - Walmart", sourcePrice: 12.97, sourceCheckedOn: "2026-09-18" },
    "tide-power-pods-odor-oxi-25ct": { comparePrice: 12.62, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/375153957", sourceStatus: "verified", sourceTitle: "Tide Power PODS Odor + Oxi Defense, 37 oz / 25 XL pods - Walmart", sourcePrice: 12.62, sourceCheckedOn: "2026-09-18" },
    "gain-happy-hibiscus-25ct": { comparePrice: 17.29, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/gain-super-flings-laundry-detergent-pacs-happy-hibiscus-hula-25-ct-prodid-314760", sourceStatus: "verified", sourceTitle: "Gain Super Flings Happy Hibiscus Hula, 35 oz / 25 2X-bigger flings - CVS", sourcePrice: 17.29, sourceCheckedOn: "2026-09-18", sourceNote: "Neither Walmart nor Target carries the 25-count; CVS's current regular price is used (no sale running)." },
    "tide-simply-daybreak-24-loads": { comparePrice: 4.79, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/tide-simply-all-in-one-liquid-laundry-detergent-daybreak-fresh-scent-24-loads-32-fl-oz-prodid-259300", sourceStatus: "verified", sourceTitle: "Tide Simply All in One Daybreak Fresh, 31 fl oz / 24 loads - CVS", sourcePrice: 4.79, sourceCheckedOn: "2026-09-18", sourceNote: "CVS's heading says 32 fl oz, but its item details and unit price identify the 31 fl oz bottle. Owner's rule for the small Tide Simply bottles: use CVS's regular price. The temporary CVS sale price is not used." },
    "tide-pods-spring-meadow-42ct": { comparePrice: 12.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/50621071", sourceStatus: "verified", sourceTitle: "Tide PODS Spring Meadow, 32 oz / 42 pacs - Walmart", sourcePrice: 12.97, sourceCheckedOn: "2026-09-18" },
    "tide-free-gentle-pods-42ct": { comparePrice: 12.99, sourceRetailer: "Target", sourceUrl: "https://www.target.com/p/tide-pods-free-38-gentle-liquid-laundry-detergent-pacs-42-ct/-/A-50225561", sourceStatus: "verified", sourceTitle: "Tide PODS Free & Gentle, 31 oz / 42 pacs - Target", sourcePrice: 12.99, sourceCheckedOn: "2026-09-18", sourceNote: "Walmart's current 42-count package appears as 30 oz; Target is the exact 31 oz / 42-count match." },
    "gain-flings-original-42ct": { comparePrice: 13.19, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/50104076", sourceStatus: "verified", sourceTitle: "Gain flings! Original, 42 flings - Walmart", sourcePrice: 13.19, sourceCheckedOn: "2026-09-18" },
    "tide-power-pods-oxi-boost-25ct": { comparePrice: 12.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/11295015861", sourceStatus: "verified", sourceTitle: "Tide Power PODS Oxi Boost, 37 oz / 25 XL pods - Walmart", sourcePrice: 12.97, sourceCheckedOn: "2026-09-18" },
    "tide-power-pods-odor-refresh-free-gentle-25ct": { comparePrice: 12.62, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/9672265348", sourceStatus: "verified", sourceTitle: "Tide Power PODS Odor Refresh Free & Gentle, 37 oz / 25 XL pods - Walmart", sourcePrice: 12.62, sourceCheckedOn: "2026-09-18" },
    "downy-gentle-ocean-mist-26oz": { comparePrice: 4.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/16584363088", sourceStatus: "verified", sourceTitle: "Downy Gentle Soft + Fresh Ocean Mist, 26 fl oz / 39 loads - Walmart", sourcePrice: 4.97, sourceCheckedOn: "2026-09-18" },
    "downy-calm-lavender-vanilla-26oz": { comparePrice: 4.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/6683459110", sourceStatus: "verified", sourceTitle: "Downy Calm Lavender & Vanilla Bean, 26 fl oz / 39 loads - Walmart", sourcePrice: 4.97, sourceCheckedOn: "2026-09-18" },
    "downy-cool-cotton-44oz": { comparePrice: 4.97, sourceRetailer: "Walmart", sourceUrl: "https://www.walmart.com/ip/2038706554", sourceStatus: "verified", sourceTitle: "Downy Cool Cotton, 44 fl oz / 60 loads - Walmart", sourcePrice: 4.97, sourceCheckedOn: "2026-09-18" },
    "gain-odor-defense-44oz": { comparePrice: 8.99, sourceRetailer: "CVS", sourceUrl: "https://www.cvs.com/shop/gain-odor-defense-liquid-fabric-softener-super-fresh-blast-scent-60-loads-44-oz-prodid-436046", sourceStatus: "verified", sourceTitle: "Gain + Odor Defense Super Fresh Blast, 44 fl oz / 60 loads - CVS", sourcePrice: 8.99, sourceCheckedOn: "2026-09-18", sourceNote: "Walmart's exact listing was out of stock and Target does not carry this size. CVS's regular price is used; its temporary sale price is not." }
  });

  const COMPARISON_FIELDS = Object.freeze([
    "comparePrice", "sourceRetailer", "sourceUrl", "sourceStatus", "sourceTitle",
    "sourcePrice", "sourceCheckedOn", "sourceNote", "sourceUnverifiable",
    "sourceRemovedOn", "sourceRemovedWhy"
  ]);

  window.SITE_CONFIG = Object.freeze({
    businessName: "Stock-Up",
    city: null,
    serviceCities: Object.freeze(["Temecula", "Hemet", "Winchester", "Menifee", "Murrieta", "French Valley"]),
    state: "California",
    /* SET 2026-09-14. It was null, so nothing PRINTABLE carried the address and
       the flyer's QR box stayed a dashed placeholder on a sheet whose own step
       01 says "Open the site and pick what you want." The domain resolves --
       the root CNAME is committed and the site is live on it. This is the one
       line that turns the address on everywhere it is printed. */
    publicUrl: "https://beast.deal/",
    /* THE CONTACT CHANNEL. Owner, 2026-09-12: checkout becomes a one-press
       text. Set this to { kind: "sms", value: "+1XXXXXXXXXX", label: "..." }
       and the request dialog's primary action turns into SEND THE TEXT, which
       opens Messages with the whole request already written and the seller's
       number already in the To field. Until it is set the dialog keeps the
       copy-and-paste flow, the contact line stays hidden, and nothing on the
       page claims an address that does not exist. `value` must be E.164. */
    contactChannel: Object.freeze({ kind: "sms", value: "+13233019200", label: "Text" }),
    pickupArea: null,
    pickupSchedule: null,
    salesTaxPolicy: null,
    /* Pickup is free. Local delivery starts at $5 and requires at least 12
       products on one request. The website cash total covers merchandise and
       any bulk-order fee; delivery begins at the stated starting price. */
    delivery: Object.freeze({
      enabled: true,
      minimumItems: 12,
      startingFee: 5,
      freeMinimumItems: null
    }),
    /* Resale guard for the each-price shelf. Once that shelf reaches 12 items,
       charge $10 for each started block of 20 items (12–20 = $10, 21–40 =
       $20, and so on). This is part of the cash total and is disclosed in the
       pickup list and generated request. */
    bulkOrder: Object.freeze({
      dealId: "8-each",
      startsAtItems: 12,
      blockSize: 20,
      feePerBlock: 10
    }),
    /* Temporarily locked while the redesigned face is previewed in place. The
       internal wheel lab can still exercise spins without changing this flag. */
    wheelEnabled: false,
    /* The catalogue rotation. 2000 ms at the owner's instruction 2026-09-12
       ("reduce the time to 2 seconds per item"); `catalogVariantHoldMs` is how
       long a card stays put after a visitor touches it before the loop picks
       it up again — 7000 ms, also theirs. */
    catalogVariantIntervalMs: 2000,
    catalogVariantHoldMs: 7000,
    /* THE PRIZE WHEEL — business facts, so they live here with the prices and
       beast.js may not invent one.

       `weight` is a PERCENTAGE. The eleven weights sum to exactly 100 and
       check-integrity.mjs fails the build if they ever stop doing so, so the
       odds printed under the wheel are the odds the wheel actually runs.
       The owner's numbers of 2026-09-12 were 70 TRY AGAIN / 20 $5 OFF /
       5 $10 OFF / 5 FREE DELIVERY / 1 FREE CAR, plus a 5% Dutch Bros added
       afterwards and a FREE ITEM with no number — 106 before anything was
       drawn. $5 OFF is the one that moved, 20 -> 13, because the 70% was the
       number they led with and the one that protects the business.

       SEGMENT GEOMETRY IS THE WEIGHT. A 1% prize is a 3.6-degree sliver and is
       drawn as one; its art sits on a flag outside the rim so it can still be
       read. Fattening a jackpot wedge to make it legible would show a shopper
       better odds than they are getting, which is the one thing a prize wheel
       must not do.

       `min`      dollar minimum on the cash total
       `minItems` item minimum instead of a dollar one
       `delivery` waives the delivery fee
       `art`      a symbol id in prize-art.js   `brandArt` an external mark
       `terms`    the sentence the winning ticket prints. Owner's words. */
    /* HOW LONG AN UNCOLLECTED PRIZE LIVES, IN DAYS. A BUSINESS FACT, so it is
       here with the prizes and the prices rather than in script.js -- it is the
       owner who honours the prize and the owner who decides how long they will.
       Added 2026-09-14 because there was no expiry at all: winning turned that
       browser's wheel OFF FOREVER (a spin is refused while a prize is held) on
       a dialog that says ONE SPIN A DAY. The timestamp needed to expire it was
       already being written by setPrize() and thrown away unread by loadPrize().
       SET BACK TO 0 -- NO EXPIRY -- ON THE SAME DAY IT WAS ADDED, and the
       reasoning matters more than the number. Shipped at 7, this silently
       DESTROYS CUSTOMER PROPERTY: `loadPrize()` removes the record, so a shopper
       who won FREE CAR, screenshotted the foil ticket and came in on day 9
       arrives holding an unconditional promise the site has already deleted,
       and the seller has to be the one to say no. Nothing on the ticket, the
       page or the flyer mentions a window -- no prize's `terms` carries one --
       so there is no surface on which the shopper could have known.
       An unapproved business rule that quietly voids something a customer won
       is worse than the bug it fixes, and the owner has not answered.
       THE MECHANISM IS KEPT, TESTED AND INERT. `loadPrize()` honours this
       number and `beast-regressions.py` proves it by seeding its own config, so
       turning it on is one edit here and nothing else. Before turning it on,
       decide what the TICKET says: a window nobody is told about is not a
       policy, it is a deletion. */
    wheelPrizeExpiryDays: 0,
    wheelPrizes: Object.freeze([
      Object.freeze({ id: "off5", label: "$5 OFF", note: "MIN $40", min: 40, weight: 13,
        art: "off-coin", tone: "cyan",
        terms: "$5 off your list when it comes to $40 or more. Cash, in person, when you collect." }),
      Object.freeze({ id: "miss-a", label: "TRY AGAIN", weight: 14, art: "try-again" }),
      Object.freeze({ id: "free-delivery", label: "FREE DELIVERY", note: "15+ ITEMS", minItems: 15, delivery: true, weight: 5,
        art: "free-delivery", tone: "pink",
        terms: "Delivery on me, inside the six towns, on one request of 15 items or more." }),
      Object.freeze({ id: "miss-b", label: "TRY AGAIN", weight: 14, art: "try-again" }),
      Object.freeze({ id: "off10", label: "$10 OFF", note: "MIN $50", min: 50, weight: 5,
        art: "off-coin", tone: "chrome",
        terms: "$10 off your list when it comes to $50 or more. Cash, in person, when you collect." }),
      Object.freeze({ id: "free-car", label: "FREE CAR", note: "MIN $50", min: 50, weight: 1, top: true,
        art: "car", tone: "gold",
        terms: "A car. A very small one \u2014 it is a Hot Wheels. Yours with a list of $50 or more." }),
      Object.freeze({ id: "miss-c", label: "TRY AGAIN", weight: 14, art: "try-again" }),
      Object.freeze({ id: "dutch-bros", label: "DUTCH BROS", note: "MIN $35", min: 35, weight: 5,
        brandArt: "dutch-bros", tone: "violet",
        terms: "One Dutch Bros drink on me with a list of $35 or more. I hand it over when you collect." }),
      Object.freeze({ id: "miss-d", label: "TRY AGAIN", weight: 14, art: "try-again" }),
      Object.freeze({ id: "free-item", label: "1 FREE ITEM", note: "MIN $40", min: 40, weight: 1, top: true,
        art: "free-item", tone: "gold",
        terms: "Any one item on your list, free. You pick it. Your list has to come to $40 or more." }),
      Object.freeze({ id: "miss-e", label: "TRY AGAIN", weight: 14, art: "try-again" })
    ])
  });

  /* The stable `8-each` id stays in carts and links. Keep the approved $7
     alternative beside the live $8 price so switching later is one deliberate
     preset change instead of another cross-site rewrite. */
  const EACH_PRICE_PRESETS = Object.freeze({
    live8: Object.freeze({ label: "$8 each", bundleQuantity: 1, bundlePrice: 8 }),
    backup7: Object.freeze({ label: "$7 each", bundleQuantity: 1, bundlePrice: 7 })
  });
  window.EACH_PRICE_PRESETS = EACH_PRICE_PRESETS;

  /* label   = the full rule, used in the pickup list and the request text
     cardLabel = the short price shown on a product card (the photo says the rest)
     The public price of the stable `8-each` group is $8. The dormant $7 preset
     above is retained only as an owner-requested backup.
     The $4 softener stage was folded into the any-two-for-$7 stage on 2026-09-10.
     There is no third label: a `cartLabel` field existed for years and nothing
     ever read it. Warnings use cardLabel || label. */
  const DEALS = {
    "2-for-5": { label: "2 for $5 · 1 for $3", cardLabel: "2 for $5", bundleQuantity: 2, bundlePrice: 5, singlePrice: 3 },
    "8-each": { ...EACH_PRICE_PRESETS.live8 },
    "paper-2-for-7": { label: "2 for $7", cardLabel: "2 for $7", bundleQuantity: 2, bundlePrice: 7 },
    "pricing-pending": { label: "Price pending", bundleQuantity: 1, bundlePrice: null }
  };
  window.DEAL_DEFINITIONS = Object.freeze(Object.fromEntries(Object.entries(DEALS).map(([id, deal]) => [id, Object.freeze({
    ...deal,
    effectiveUnitPrice: deal.bundlePrice === null ? null : deal.bundlePrice / deal.bundleQuantity
  })])));

  const product = (record) => {
    const dealGroup = record.dealGroup || "pricing-pending";
    const deal = window.DEAL_DEFINITIONS[dealGroup];
    const imageId = record.imageId || record.id;
    const catalogRecord = { ...record };
    for (const field of COMPARISON_FIELDS) delete catalogRecord[field];
    const comparison = PRICE_SOURCE_AUDIT[record.id] || Object.freeze({
      comparePrice: null,
      sourceStatus: "unavailable"
    });
    return Object.freeze({
      inventoryDate: INVENTORY_DATE,
      inventorySource: "TEMPORARY PUBLIC AVAILABILITY",
      inStock: record.inventoryQuantity > 0,
      pricingStatus: dealGroup === "pricing-pending" ? "pending" : "active",
      bundleQuantity: deal.bundleQuantity,
      bundlePrice: deal.bundlePrice,
      effectiveUnitPrice: deal.effectiveUnitPrice,
      comparePrice: null,
      sourceRetailer: null,
      sourceUrl: null,
      sourceStatus: dealGroup === "pricing-pending" ? "pricing_pending" : "working_value",
      ...catalogRecord,
      ...comparison,
      dealGroup,
      image: record.image || `assets/products-master/${imageId}.webp`,
      imagePng: record.imagePng || `assets/products-master/${imageId}.png`
    });
  };

  window.PRODUCTS = Object.freeze([
    product({ id: "arm-hammer-oxiclean-fresh-21-loads", sourcePath: "2x$5/900.jpg.avif", brand: "Arm & Hammer", name: "Plus OxiClean Stain Fighters", variant: "Fresh Scent · blue-label 3X Stain Fighters", size: "27.5 fl oz · 21 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Orange bottle · blue cap · blue label", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", searchTags: ["arm hammer", "oxiclean", "stain fighters", "fresh scent", "blue label", "21 loads"], alt: "Arm and Hammer Plus OxiClean Stain Fighters Fresh Scent detergent, 27.5 fluid ounces and 21 loads" }),
    product({ id: "arm-hammer-odor-blasters-21-loads", sourcePath: "2x$5/Arm-Hammer-Plus-OxiClean-Odor-Blasters-Fresh-Burst-21-Loads-Liquid-Laundry-Detergent-27-5-Fl-oz_68cb7644-83a6-4412-80f3-038a51866a1c.9ff42a98b32e98865196614abe46a004.png.webp", brand: "Arm & Hammer", name: "Plus OxiClean Odor Blasters", variant: "Fresh Burst · purple-label 3X Odor Fighters", size: "27.5 fl oz · 21 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Orange bottle · purple cap · purple label", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", searchTags: ["arm hammer", "oxiclean", "odor blasters", "fresh burst", "purple label", "21 loads"], alt: "Arm and Hammer Plus OxiClean Odor Blasters Fresh Burst detergent, 27.5 fluid ounces and 21 loads" }),
    product({ id: "arm-hammer-clean-scentsations-purifying-waters-15oz", sourcePath: "assets/products-master/arm-hammer-clean-scentsations-purifying-waters-15oz.png", brand: "Arm & Hammer", name: "Clean Scentsations In-Wash Scent Booster", variant: "Purifying Waters · blue cap", size: "15 oz", category: "Scent booster", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Orange-and-blue bottle · blue cap", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", imageSourceType: "Owner-photo-guided OpenAI-generated packshot, background removed with Apple Vision segmentation", searchTags: ["arm hammer", "clean scentsations", "purifying waters", "scent booster", "blue cap", "15 oz"], alt: "Arm and Hammer Clean Scentsations Purifying Waters in-wash scent booster, 15 ounces, with a blue cap" }),
    product({ id: "arm-hammer-odor-blasters-fresh-burst-15oz", sourcePath: "assets/products-master/arm-hammer-odor-blasters-fresh-burst-15oz.png", brand: "Arm & Hammer", name: "Odor Blasters In-Wash Scent Booster", variant: "Fresh Burst · purple cap", size: "15 oz", category: "Scent booster", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Orange-and-purple bottle · purple cap", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", imageSourceType: "Owner-photo-guided OpenAI-generated packshot, background removed with Apple Vision segmentation", searchTags: ["arm hammer", "odor blasters", "fresh burst", "scent booster", "purple cap", "15 oz"], alt: "Arm and Hammer Odor Blasters Fresh Burst in-wash scent booster, 15 ounces, with a purple cap" }),
    product({ id: "arm-hammer-odor-blasters-power-paks-14ct", sourcePath: "assets/products-master/arm-hammer-odor-blasters-power-paks-14ct.png", brand: "Arm & Hammer", name: "Plus OxiClean with Odor Blasters", variant: "5-in-1 Power Paks · Fresh Burst", size: "9.87 oz · 14 paks", category: "Laundry pods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bags", packaging: "Orange resealable bag · blue and purple graphics", inventoryStatus: "photo-confirmed", dealGroup: "paper-2-for-7", imageSourceType: "Owner-photo-guided OpenAI-generated packshot, background removed with Apple Vision segmentation", searchTags: ["arm hammer", "oxiclean", "odor blasters", "power paks", "pods", "fresh burst", "14 count", "9.87 oz"], alt: "Arm and Hammer Plus OxiClean with Odor Blasters Fresh Burst 5-in-1 Power Paks, 14 count" }),
    product({ id: "tide-simply-all-in-one-24-loads", sourcePath: "2x$5/large_bd1cd84d-bb0a-483b-b5a3-38118c0b8f84.jpg", brand: "Tide", name: "Simply All in One", variant: "Refreshing Breeze · small bottle", size: "32 fl oz · 24 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Yellow bottle · blue/green label · clear dosing cap", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", searchTags: ["tide", "simply", "all in one", "refreshing breeze", "small", "24 loads"], alt: "Tide Simply All in One Refreshing Breeze detergent, 32 fluid ounces and 24 loads" }),
    product({ id: "tide-simply-oxi-febreze-22-loads", sourcePath: "2x$5/Tide-Simply-Oxi-Boost-Febreze-Odor-Defense-31-fl-oz-22-Loads-Tough-on-Stains-and-Odors-Febreze-Sunny-Breeze-Scent_573bb246-0283-4f25-8228-0939943515f4.b7b4c1d7d71643181ae353dca88aa0cd.jpeg.webp", brand: "Tide", name: "Simply Oxi Boost + Febreze", variant: "Sunny Breeze · Odor Defense", size: "31 fl oz · 22 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Yellow bottle · dark-purple cap/label", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", searchTags: ["tide", "simply", "oxi", "febreze", "odor defense", "sunny breeze", "22 loads"], alt: "Tide Simply Oxi Boost plus Febreze Odor Defense Sunny Breeze detergent, 22 loads" }),
    product({ id: "arm-hammer-sensitive-skin-28-loads", sourcePath: "2x$5/3320097562.jpg", brand: "Arm & Hammer", name: "Sensitive Skin Free & Clear", variant: "Hypoallergenic · no perfumes or dyes", size: "28 fl oz · 28 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "White bottle · white cap · green/white label", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", searchTags: ["arm hammer", "sensitive skin", "free clear", "hypoallergenic", "28 loads"], alt: "Arm and Hammer Sensitive Skin Free and Clear detergent, 28 fluid ounces and 28 loads" }),
    product({ id: "tide-simply-all-in-one-85-loads", sourcePath: "7dolla/26840_1.jpg", brand: "Tide", name: "Simply All in One", variant: "Refreshing Breeze · large bottle", size: "107 fl oz · 85 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Large yellow bottle · blue label · dosing cap", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["tide", "simply", "all in one", "refreshing breeze", "large", "85 loads"], alt: "Tide Simply All in One Refreshing Breeze detergent, 107 fluid ounces and 85 loads" }),
    product({ id: "tide-simply-oxi-stain-22-loads", sourcePath: "2x$5/large_222759d8-8d18-48ae-9ed8-f07f1f54877a.png", brand: "Tide", name: "Simply Oxi + Stain", variant: "Refreshing Breeze · small bottle", size: "31 fl oz · 22 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Yellow bottle · orange/blue label", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", searchTags: ["tide", "simply", "oxi", "stain", "refreshing breeze", "small", "22 loads"], alt: "Tide Simply Oxi and Stain Refreshing Breeze detergent, 31 fluid ounces and 22 loads" }),
    product({ id: "tide-simply-free-sensitive-24-loads", sourcePath: "2x$5/6dba0bdf-5c19-4f0f-a8db-ad18310d7632.5351613ce2f9c21ab349cefe5fb80890.jpeg.webp", brand: "Tide", name: "Simply Free & Sensitive", variant: "Unscented · no dyes or perfumes", size: "32 fl oz · 24 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "White bottle · yellow/white label", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", searchTags: ["tide", "simply", "free sensitive", "unscented", "24 loads"], alt: "Tide Simply Free and Sensitive detergent, 32 fluid ounces and 24 loads" }),
    product({ id: "all-free-clear-original-30oz", sourcePath: "2x$5/0072613739431_1_A1C1_0600.png", brand: "all", name: "Free Clear — The Original", variant: "100% free of perfumes and dyes · small bottle", size: "30 fl oz · 24 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "White bottle · blue/white label", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", searchTags: ["all", "free clear", "original", "unscented", "small", "24 loads"], alt: "all Free Clear The Original detergent, 30 fluid ounces and 24 loads" }),
    product({ id: "snuggle-blue-sparkle-40-loads", sourcePath: "2x$5/08cb3868-c18a-433d-832c-1f7065e89b9b.jpg", brand: "Snuggle", name: "Blue Sparkle", variant: "Cuddle-Up Fresh", size: "27.2 fl oz · 40 loads", category: "Fabric softener", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottle", packaging: "Blue bottle · blue cap · teddy-bear label", inventoryStatus: "photo-confirmed", dealGroup: "2-for-5", searchTags: ["snuggle", "blue sparkle", "cuddle up fresh", "fabric softener", "40 loads"], alt: "Snuggle Blue Sparkle Cuddle-Up Fresh fabric softener, 27.2 fluid ounces and 40 loads" }),
    product({ id: "tide-simply-oxi-stain-70-loads", sourcePath: "7dolla/1692594.webp", brand: "Tide", name: "Simply Oxi + Stain", variant: "Refreshing Breeze · large bottle", size: "94 fl oz · 70 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Large yellow bottle · blue/orange label · dosing cap", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["tide", "simply", "oxi", "stain", "refreshing breeze", "large", "70 loads"], alt: "Tide Simply Oxi and Stain Refreshing Breeze detergent, 94 fluid ounces and 70 loads" }),
    product({ id: "tide-simply-daybreak-85-loads", sourcePath: "assets/inventory-sources/master-2026-09/tide-simply-daybreak-107oz-edited.png", brand: "Tide", name: "Simply All in One", variant: "Daybreak Fresh", size: "107 fl oz · 85 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Large yellow bottle · green label · dosing cap", inventoryStatus: "photo-confirmed", dealGroup: "8-each", imageSourceUrl: "https://www.homedepot.com/p/340972664", searchTags: ["tide", "simply", "all in one", "daybreak fresh", "large", "85 loads", "107 oz"], alt: "Tide Simply All in One Daybreak Fresh detergent, 107 fluid ounces and 85 loads" }),
    product({ id: "all-free-clear-original-73oz", sourcePath: "assets/inventory-sources/master-2026-09/all-free-clear-original-73oz.jpg", brand: "all", name: "Free Clear — The Original", variant: "100% free of perfumes and dyes · large bottle", size: "73 fl oz · 58 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Large white bottle · blue/white label", inventoryStatus: "photo-confirmed", dealGroup: "8-each", imageSourceUrl: "https://www.kroger.com/p/all-free-clear-laundry-detergent/0007261347415", searchTags: ["all", "free clear", "original", "unscented", "large", "58 loads", "73 oz"], alt: "all Free Clear The Original detergent, 73 fluid ounces and 58 loads" }),
    product({ id: "purex-advanced-oxi-morning-burst-85-loads", sourcePath: "7dolla/719CC47yAgL._AC_UF350,350_QL80_.jpg", brand: "Purex", name: "Advanced Oxi", variant: "Fresh Morning · cold-water power", size: "128 fl oz · 85 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Dark-blue bottle · orange/white label", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["purex", "advanced oxi", "fresh morning", "cold water", "85 loads", "128 oz"], alt: "Purex Advanced Oxi Fresh Morning detergent, 128 fluid ounces and 85 loads" }),
    product({ id: "purex-fresh-mountain-breeze-115-loads", sourcePath: "7dolla/001081069-1.webp", brand: "Purex", name: "Fresh Mountain Breeze", variant: "Floral and woody notes", size: "150 fl oz · 115 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Dark-blue bottle · white/green mountain label", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["purex", "fresh mountain breeze", "floral", "woody", "115 loads", "150 oz"], alt: "Purex Fresh Mountain Breeze detergent, 150 fluid ounces and 115 loads" }),
    product({ id: "suavitel-field-flowers-105-loads", sourcePath: "7dolla/suavitel-fabric-softeners-61043164-64_1000.jpg.avif", brand: "Suavitel", name: "Field Flowers", variant: "Field Flowers · blue bottle", size: "105 fl oz · 105 small loads", category: "Fabric softener", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottle", packaging: "Blue bottle · floral label", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["suavitel", "field flowers", "blue", "fabric softener", "105 loads"], alt: "Suavitel Field Flowers fabric softener, 105 fluid ounces and 105 small loads" }),
    product({ id: "suavitel-morning-sun-105-loads", sourcePath: "7dolla/f76e0a66-7a6c-4ff4-8aa7-a39c0c06b5d2.569496cdbc604546d278c3a2e25e7cf5.jpeg.webp", brand: "Suavitel", name: "Morning Sun", variant: "Morning Sun · yellow bottle", size: "105 fl oz · 105 small loads", category: "Fabric softener", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Yellow bottle · sunflower/floral label", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["suavitel", "morning sun", "yellow", "fabric softener", "105 loads"], alt: "Suavitel Morning Sun fabric softener, 105 fluid ounces and 105 small loads" }),
    product({ id: "suavitel-soothing-lavender-105-loads", sourcePath: "7dolla/suavitel-fabric-softeners-61043170-combo6-64_1000.jpg.avif", brand: "Suavitel", name: "Soothing Lavender", variant: "Lavender", size: "105 fl oz · 105 small loads", category: "Fabric softener", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Purple bottle · lavender label", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["suavitel", "soothing lavender", "purple", "fabric softener", "105 loads"], alt: "Suavitel Soothing Lavender fabric softener, 105 fluid ounces and 105 small loads" }),
    /* `size` says "101 fl oz" and stops there: the load count on this bottle was
       never confirmed, and a size line is now drawn on the card, so the honest
       move is to claim nothing about loads rather than to print the words
       "load count unconfirmed" at a customer. Every other Suavitel says 105. */
    product({ id: "suavitel-holiday-white-christmas", sourcePath: "7dolla/0750954665980.png", brand: "Suavitel", name: "Blanca Navidad / White Christmas", variant: "Limited-edition holiday scent", size: "101 fl oz", category: "Fabric softener", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "White bottle · Christmas/holiday graphics", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["suavitel", "blanca navidad", "white christmas", "holiday", "fabric softener", "101 oz"], alt: "Suavitel Blanca Navidad White Christmas holiday fabric softener, 101 fluid ounces" }),
    product({ id: "tide-evo-free-gentle-16ct", sourcePath: "7dolla/Screenshot 2026-08-27 at 6.07.47 PM.png", brand: "Tide", name: "evo Laundry Detergent Tiles", variant: "Free & Gentle", size: "16 tiles · 16 medium loads", category: "Laundry detergent tiles", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "boxes", packaging: "Orange/light-blue box", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["tide", "evo", "tiles", "free gentle", "sensitive", "16 count"], alt: "Tide evo Free and Gentle laundry detergent tiles, 16 medium loads" }),
    product({ id: "tide-evo-original-16ct", sourcePath: "7dolla/GUEST_60ebfa06-ee8e-4728-9e9a-7446621eed1d.avif", brand: "Tide", name: "evo Laundry Detergent Tiles", variant: "Original Scent", size: "16 tiles · 16 medium loads", category: "Laundry detergent tiles", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "boxes", packaging: "Orange/navy box", inventoryStatus: "photo-confirmed", dealGroup: "8-each", searchTags: ["tide", "evo", "tiles", "original scent", "16 count"], alt: "Tide evo Original Scent laundry detergent tiles, 16 medium loads" }),
    product({ id: "tide-evo-spring-blast-16ct", sourcePath: "assets/inventory-sources/master-2026-09/tide-evo-spring-blast-16ct.jpg", brand: "Tide", name: "evo Laundry Detergent Tiles", variant: "Spring Blast", size: "16 tiles · 16 medium loads", category: "Laundry detergent tiles", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "boxes", packaging: "Orange/purple box", inventoryStatus: "photo-confirmed", dealGroup: "8-each", imageSourceUrl: "https://www.homedepot.com/p/339818224", searchTags: ["tide", "evo", "tiles", "spring blast", "16 count"], alt: "Tide evo Spring Blast laundry detergent tiles, 16 medium loads" }),
    product({ id: "tide-power-pods-downy-25ct", sourcePath: "assets/inventory-sources/master-2026-09/tide-power-pods-downy-25ct.jpg", brand: "Tide", name: "Power PODS + Downy", variant: "Soft Boosters + April Fresh", size: "35 oz · 25 XL pods", category: "Laundry pods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "tubs", packaging: "Orange tub · pink/gray label", inventoryStatus: "photo-confirmed", dealGroup: "8-each", imageSourceUrl: "https://www.walmart.com/ip/5032932766", searchTags: ["tide", "power pods", "downy", "soft boosters", "april fresh", "25 xl", "35 oz"], alt: "Tide Power PODS plus Downy Soft Boosters April Fresh, 25 XL pods in a 35 ounce tub" }),
    product({ id: "tide-power-pods-odor-oxi-25ct", sourcePath: "assets/inventory-sources/master-2026-09/tide-power-pods-odor-oxi-25ct.png", brand: "Tide", name: "Power PODS Odor + Oxi Defense", variant: "Advanced Odor + Stain Fighter", size: "37 oz · 25 XL pods", category: "Laundry pods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "tubs", packaging: "Orange tub · blue/gray label", inventoryStatus: "photo-confirmed", dealGroup: "8-each", imageSourceUrl: "https://delivery.publix.com/store/publix/products/26182157", searchTags: ["tide", "power pods", "odor", "oxi", "defense", "25 xl", "37 oz"], alt: "Tide Power PODS Odor and Oxi Defense, 25 XL pods in a 37 ounce tub" }),
    product({ id: "gain-happy-hibiscus-25ct", sourcePath: "assets/inventory-sources/master-2026-09/gain-happy-hibiscus-25ct.jpg", brand: "Gain", name: "Gain Plus Happy Hibiscus", variant: "4X Oxi · 3X Fresh · 2X Febreze · Color Guard", size: "35 oz · 25 2X-bigger flings", category: "Laundry pods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "tubs", packaging: "Green tub · pink lid · hibiscus graphics", inventoryStatus: "merge-inferred; quantity unconfirmed", dealGroup: "8-each", imageSourceUrl: "https://www.cvs.com/shop/gain-super-flings-laundry-detergent-pacs-happy-hibiscus-hula-scent-25-ct-prodid-314760", searchTags: ["gain", "happy hibiscus", "hibiscus hula", "flings", "febreze", "25 count", "35 oz"], alt: "Gain Plus Happy Hibiscus laundry flings, 25 count in a green tub with pink lid" }),
    /* ---- GROUP 2, added 2026-09-12. Seven products the restock brought that
       this manifest did not carry. Their packshots were produced by the owner's
       Codex from researched retail images and background-removed with Apple's
       Vision segmentation (scripts/remove-packshot-background.swift), so the
       labels are the real ones. `sourcePath` points at the master itself
       because the master IS the source for these — there is no owner photograph
       behind them, and that is recorded rather than disguised.

       PRICE STAGE: the owner's decision, "same pricing" — a 42-count tub sells
       at the each-price tier exactly like the 25-count tubs already on that shelf. That is a
       steeper discount than anything else here (a 42-count tub is roughly
       1.7x the 25-count) and it was their call, made knowingly.

       comparePrice is null on all seven. None of them has a checked store
       price yet, and this file may not invent one: they show "No comparison
       price listed" and are left out of any saving until someone opens a real
       listing for each. That is the top open item in the master brief. ---- */
    product({ id: "tide-simply-daybreak-24-loads", sourcePath: "assets/products-master/tide-simply-daybreak-24-loads.png", brand: "Tide", name: "Simply All in One", variant: "Daybreak Fresh · small bottle", size: "31 fl oz · 24 loads", category: "Liquid detergent", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Yellow bottle · green label · clear dosing cap", inventoryStatus: "packshot-confirmed", dealGroup: "2-for-5", imageSourceType: "Retail packshot, background removed with Vision segmentation", searchTags: ["tide", "simply", "all in one", "daybreak", "green", "24 loads", "31 oz"], alt: "Tide Simply All in One Daybreak Fresh detergent, 31 fluid ounces and 24 loads" }),
    product({ id: "tide-pods-spring-meadow-42ct", sourcePath: "assets/products-master/tide-pods-spring-meadow-42ct.png", brand: "Tide", name: "PODS 3-in-1", variant: "Spring Meadow · Coldwater Clean", size: "32 oz · 42 pacs", category: "Laundry pods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "tubs", packaging: "Orange tub · purple label", inventoryStatus: "packshot-confirmed", dealGroup: "8-each", imageSourceType: "Retail packshot, background removed with Vision segmentation", searchTags: ["tide", "pods", "3 in 1", "spring meadow", "coldwater", "42 pacs", "purple"], alt: "Tide PODS 3-in-1 Spring Meadow laundry pods, 42 pacs" }),
    product({ id: "tide-free-gentle-pods-42ct", sourcePath: "assets/products-master/tide-free-gentle-pods-42ct.png", brand: "Tide", name: "PODS Free & Gentle", variant: "Unscented · no added dyes or perfumes", size: "31 oz · 42 pacs", category: "Laundry pods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "tubs", packaging: "White tub · pale-blue label", inventoryStatus: "packshot-confirmed", dealGroup: "8-each", imageSourceType: "Retail packshot, background removed with Vision segmentation", searchTags: ["tide", "pods", "free gentle", "unscented", "42 pacs", "sensitive"], alt: "Tide PODS Free and Gentle unscented laundry pods, 42 pacs" }),
    product({ id: "gain-flings-original-42ct", sourcePath: "assets/products-master/gain-flings-original-42ct.png", brand: "Gain", name: "flings! Original", variant: "3-in-1 · Oxi Boost + Febreze", size: "42 flings", category: "Laundry pods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "tubs", packaging: "Green tub · green lid", inventoryStatus: "packshot-confirmed", dealGroup: "8-each", imageSourceType: "Retail packshot, background removed with Vision segmentation", searchTags: ["gain", "flings", "original", "oxi", "febreze", "42", "green"], alt: "Gain flings Original laundry detergent pods, 42 flings" }),
    product({ id: "tide-power-pods-oxi-boost-25ct", sourcePath: "assets/products-master/tide-power-pods-oxi-boost-25ct.png", brand: "Tide", name: "Power PODS Oxi Boost", variant: "Set-In Stain Removal + Oxi Power", size: "37 oz · 25 XL pods", category: "Laundry pods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "tubs", packaging: "Orange tub · dark-blue label", inventoryStatus: "packshot-confirmed", dealGroup: "8-each", imageSourceType: "Retail packshot, background removed with Vision segmentation", searchTags: ["tide", "power pods", "oxi boost", "set in stain", "25 xl", "37 oz"], alt: "Tide Power PODS Oxi Boost laundry pods, 25 XL pods" }),
    product({ id: "tide-power-pods-odor-refresh-free-gentle-25ct", sourcePath: "assets/products-master/tide-power-pods-odor-refresh-free-gentle-25ct.png", brand: "Tide", name: "Power PODS Odor Refresh Free & Gentle", variant: "Unscented", size: "37 oz · 25 XL pods", category: "Laundry pods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "tubs", packaging: "White tub · grey lid · teal label", inventoryStatus: "packshot-confirmed", dealGroup: "8-each", imageSourceType: "Retail packshot, background removed with Vision segmentation", searchTags: ["tide", "power pods", "odor refresh", "free gentle", "unscented", "25 xl"], alt: "Tide Power PODS Odor Refresh Free and Gentle unscented pods, 25 XL pods" }),
    product({ id: "downy-gentle-ocean-mist-26oz", sourcePath: "assets/inventory-sources/master-2026-09/downy-gentle-ocean-mist-26oz.jpg", brand: "Downy", name: "Gentle Soft + Fresh", variant: "Ocean Mist", size: "26 fl oz · 39 loads", category: "Fabric softener", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottle", packaging: "White/light-blue bottle", inventoryStatus: "photo-confirmed", dealGroup: "paper-2-for-7", imageSourceUrl: "https://www.walmart.com/ip/16584363088", searchTags: ["downy", "gentle", "soft fresh", "ocean mist", "fabric softener", "39 loads", "26 oz"], alt: "Downy Gentle Soft and Fresh Ocean Mist fabric softener, 26 fluid ounces and 39 loads" }),
    product({ id: "downy-calm-lavender-vanilla-26oz", sourcePath: "2x7 dolla/6a628b60-cd49-4c31-8c05-538989c72e2f.jpg", brand: "Downy", name: "Calm", variant: "Lavender & Vanilla Bean · 4X Fresh & Soft", size: "26 fl oz · 39 loads", category: "Fabric softener", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottles", packaging: "Purple floral bottle", inventoryStatus: "photo-confirmed", dealGroup: "paper-2-for-7", searchTags: ["downy", "calm", "lavender", "vanilla bean", "fabric softener", "39 loads", "26 oz"], alt: "Downy Calm Lavender and Vanilla Bean fabric softener, 26 fluid ounces and 39 loads" }),
    product({ id: "downy-cool-cotton-44oz", sourcePath: "assets/inventory-sources/master-2026-09/downy-cool-cotton-44oz.jpg", brand: "Downy", name: "Cool Cotton", variant: "2-in-1 Soft + Fresh", size: "44 fl oz · 60 loads", category: "Fabric softener", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottle", packaging: "Blue bottle", inventoryStatus: "confirmed from later inventory photo", dealGroup: "paper-2-for-7", imageSourceUrl: "https://www.stockupexpress.com/products/downy-ultra-laundry-liquid-fabric-softener-fabric-conditioner-cool-cotton-44-fl-oz-60-loads-44-fz-6-pack", searchTags: ["downy", "cool cotton", "soft fresh", "fabric softener", "60 loads", "44 oz"], alt: "Downy Cool Cotton fabric softener, 44 fluid ounces and 60 loads" }),
    product({ id: "gain-odor-defense-44oz", sourcePath: "assets/inventory-sources/master-2026-09/gain-odor-defense-44oz.jpg", brand: "Gain", name: "+ Odor Defense", variant: "Super Fresh Blast", size: "44 fl oz · 60 loads", category: "Fabric softener", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "bottle", packaging: "Green bottle · bright-green cap", inventoryStatus: "confirmed from later inventory photo", dealGroup: "paper-2-for-7", imageSourceUrl: "https://www.kroger.com/p/gain-odor-defense-liquid-fabric-softener-super-fresh-blast-scent-60-loads-he-compatible/0003077205053", searchTags: ["gain", "odor defense", "super fresh blast", "fabric softener", "60 loads", "44 oz"], alt: "Gain Odor Defense Super Fresh Blast fabric softener, 44 fluid ounces and 60 loads" }),
    product({ id: "unbranded-toilet-paper-12-rolls", retailNote: "Usually $8–$12 retail · different brands in stock", sourcePath: "assets/products/everyday-essential-toilet-paper-12-rolls.png", image: "assets/products/everyday-essential-toilet-paper-12-rolls.webp", imagePng: "assets/products/everyday-essential-toilet-paper-12-rolls.png", brand: "Unbranded / unknown", name: "Toilet Paper", variant: "2-ply · brand not provided", size: "12 rolls per package", category: "Paper goods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "packages", packaging: "Exact retail SKU and package artwork not provided", inventoryStatus: "quantity-confirmed; brand unresolved", dealGroup: "paper-2-for-7", imageSourceType: "Earlier generated package artwork restored at owner request", searchTags: ["toilet paper", "bath tissue", "paper goods", "2 ply", "12 rolls", "unbranded"], alt: "Purple package of 12 rolls of two-ply toilet paper" }),
    product({ id: "unbranded-paper-towels-6-rolls", retailNote: "Usually $8–$12 retail · different brands in stock", sourcePath: "assets/products/everyday-essential-paper-towels-6-rolls.png", image: "assets/products/everyday-essential-paper-towels-6-rolls.webp", imagePng: "assets/products/everyday-essential-paper-towels-6-rolls.png", brand: "Unbranded / unknown", name: "Paper Towels", variant: "Brand not provided", size: "6 rolls per package", category: "Paper goods", inventoryQuantity: PUBLIC_STOCK_PER_ITEM, inventoryUnit: "packages", packaging: "Exact retail SKU and package artwork not provided", inventoryStatus: "quantity-confirmed; brand unresolved", dealGroup: "paper-2-for-7", imageSourceType: "Earlier generated package artwork restored at owner request", searchTags: ["paper towels", "paper goods", "6 rolls", "unbranded"], alt: "Orange package of six rolls of paper towels" })
  ]);

  /* IDS THAT HAVE BEEN USED AND MUST NEVER BE REUSED. Nothing reads this list
     today — it is a record, not a guard — but an id is what the pickup list in
     a visitor's localStorage refers to, so handing an old id to a new product
     silently turns a saved line into the wrong item.
     `gain-happy-hibiscus-32ct` was missing until 2026-09-15. The 32 ct tub was
     retired on 2026-09-14 and its 9 units were re-homed onto the 25 ct row, so
     the id left the manifest without ever being written down here. Found by an
     audit of the documentation, not by a gate, because there is no gate. */
  window.ARCHIVED_PRODUCT_IDS = Object.freeze([
    "tide-pods-original-14ct", "tide-pods-spring-meadow-16ct", "suavitel-complete-field-flowers-100-loads",
    "everyday-essential-toilet-paper-12-rolls", "everyday-essential-paper-towels-6-rolls",
    "gain-happy-hibiscus-32ct"
  ]);
}());

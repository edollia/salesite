# Beast Stock-Up

A static storefront for **Stock-Up**, a local household-supplies resale business in
Temecula, Hemet, Winchester, Menifee, Murrieta and French Valley, California —
skinned as a Stock-Up × MrBeast collab.

Name-brand laundry detergent, fabric softener, pods and paper goods. Cash in
person, pickup or local delivery. **No backend, no payment, nothing is sent
anywhere**: a shopper builds a pickup list and the site opens their messages app
with the request already written.

## Running it

It is plain static files. Any static server will do:

```sh
python3 -m http.server 5577 --bind 127.0.0.1
# then open http://127.0.0.1:5577/
```

## What is here

| File | Role |
|---|---|
| `index.html` | The whole page. |
| `beast.css` | The entire visual system. |
| `beast.js` | The motion layer. Runs after `script.js`; never touches inventory, prices or the cart. |
| `script.js` | Product cards, search, cart, deal maths, the wheel prize, the request text. **The cart contract.** |
| `products.js` | Inventory truth, `SITE_CONFIG` and the prize table. **The only place a price or a discount may live.** |
| `prize-art.js` | Generated. Inline SVG sprite for the prize icons. |
| `product-fit.css` | Generated. Per-product display scale. |
| `site-settings.js` | Three display toggles kept in `localStorage`. |

## Editing anything

**Prices, products and prizes live in `products.js` and nowhere else.** Change a
quantity, a price stage or a prize there and every surface follows. Do not
hard-code a number into the markup — several guards in the full workspace exist
specifically to catch that, and they are not in this repo.

The full workspace — the briefs, the 153-check test suite, the print pieces and
the maintenance notes — lives outside this repo. This is the deployable site.

## Before this goes public

- **Two unresolved trademarks are on these pages**: MrBeast (the panther and the
  "STOCK-UP × MRBEAST" pill assert a partnership) and Dutch Bros (a wheel prize).
  Neither is cleared.
- `og:image` is a relative path and needs an absolute URL once the domain exists.

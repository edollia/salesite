(function () {
  "use strict";

  const storageKey = "stock-up-display-settings-v1";
  const defaults = Object.freeze({
    showAvailability: false,
    showComparisons: true,
    autoRotateProducts: true,
  });

  function normalize(value) {
    const source = value && typeof value === "object" ? value : {};
    return Object.freeze(Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [
      key,
      typeof source[key] === "boolean" ? source[key] : fallback
    ])));
  }

  function get() {
    try { return normalize(JSON.parse(localStorage.getItem(storageKey) || "{}")); }
    catch { return normalize({}); }
  }

  function emit(settings) {
    window.dispatchEvent(new CustomEvent("stockupsettingschange", { detail: settings }));
  }

  /* WRAPPED, like every other storage write in this project. These two were the
     only bare ones: a throw in private mode or on a full quota propagated out of
     admin.js's change handler, so `emit()` never ran and the "SAVED TO THIS
     BROWSER ✓" flash never fired — the checkbox stayed visually toggled, nothing
     was saved, and the one UI whose entire job is persisting a preference said
     nothing at all. Found by the completeness pass. */
  function save(next) {
    const settings = normalize({ ...get(), ...next });
    let stored = true;
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); }
    catch { stored = false; }          /* private mode, or a full quota */
    /* emit EITHER WAY. The setting is live for this page whether or not it
       survives a reload, and the caller needs to know which. Swallowing the
       throw without telling anyone would be the silent half of the same bug. */
    emit(settings);
    return Object.freeze({ ...settings, stored });
  }

  function reset() {
    let stored = true;
    try { localStorage.removeItem(storageKey); }
    catch { stored = false; }
    const settings = get();
    emit(settings);
    return Object.freeze({ ...settings, stored });
  }

  window.StockUpSettings = Object.freeze({ storageKey, defaults, get, save, reset });
}());

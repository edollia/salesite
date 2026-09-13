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

  function save(next) {
    const settings = normalize({ ...get(), ...next });
    localStorage.setItem(storageKey, JSON.stringify(settings));
    emit(settings);
    return settings;
  }

  function reset() {
    localStorage.removeItem(storageKey);
    const settings = get();
    emit(settings);
    return settings;
  }

  window.StockUpSettings = Object.freeze({ storageKey, defaults, get, save, reset });
}());

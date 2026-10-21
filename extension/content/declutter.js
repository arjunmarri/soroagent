// "Hide ads": hides ads and distractions without changing the page layout.
//  - Ads inside the page are made invisible but keep their space (visibility: hidden), so text
//    and images never jump around.
//  - Floating overlays (cookie walls, newsletter pop-ups, sticky video players) are removed; they
//    float above the page, so removing them doesn't move anything either.
// The main content is never hidden.
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});

  // Ad slots and ad-network widgets (cosmetic selectors in the style of common blocklists).
  const AD_SELECTORS = [
    'ins.adsbygoogle', '[id^="google_ads"]', '[id^="div-gpt-ad"]', '[data-google-query-id]', '[id*="gpt-ad"]',
    'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication"]', 'iframe[src*="amazon-adsystem"]', 'iframe[id^="google_ads_iframe"]',
    'amp-ad', 'amp-embed', 'amp-sticky-ad',
    '[data-ad]', '[data-ad-slot]', '[data-adunit]', '[data-ad-unit]', '[data-ad-placement]', '[data-testid*="ad-slot" i]',
    '[aria-label="Advertisement" i]', '[aria-label="Sponsored" i]',
    '[class~="ad"]', '[class~="ads"]', '[class~="advert"]', '[class~="advertisement"]', '[class~="sponsored"]',
    '[class*="ad-slot"]', '[class*="ad-container"]', '[class*="ad-wrapper"]', '[class*="ad-banner"]', '[class*="banner-ad"]',
    '[class*="adunit"]', '[class*="ad-unit"]', '[class*="native-ad"]', '[class*="sponsored-content"]', '[class*="promoted-content"]',
    '[id*="ad-slot"]', '[id*="adslot"]', '[id^="ad-"]', '[id^="ads-"]', '[class*="dfp-"]', '[id^="dfp-"]',
    '[id*="taboola"]', '[class*="taboola"]', '[id*="outbrain"]', '[class*="outbrain"]', '.OUTBRAIN', '[class*="revcontent"]', '[class*="mgid"]',
  ];
  // Distractions that sit in the page: share bars, "recommended for you" rails, newsletter boxes.
  const DISTRACTION_SELECTORS = [
    '[class*="share-bar"]', '[class*="social-share"]', '[class*="sharing-bar"]', '[class*="newsletter-signup"]', '[class*="newsletter-promo"]',
    '[class*="related-ads"]', '[class*="recommended-stories"]', '[class*="trending-now"]', '[class*="most-popular"]',
  ];
  // Floating overlays: consent walls, pop-ups and sticky players.
  const OVERLAY_SELECTORS = [
    '#onetrust-banner-sdk', '#onetrust-consent-sdk', '.fc-consent-root', '#CybotCookiebotDialog', '.qc-cmp2-container', '#sp_message_container',
    '[class*="cookie-banner"]', '[class*="cookie-consent"]', '[id*="cookie-banner"]', '[class*="consent-banner"]',
    '[class*="newsletter-modal"]', '[class*="subscribe-modal"]', '[class*="popup-overlay"]', '[class*="modal-overlay"]',
    '[class*="sticky-video"]', '[class*="floating-video"]', '[class*="video-float"]', '[class*="sticky-player"]', '.jw-flag-floating', '[class*="outstream"]',
  ];
  const AD_LABEL = /^(advertisement|advertisements|ad|ads|sponsored|promoted|paid content|anzeige|publicité|publicidad)$/i;

  const state = { active: false, observer: null, pending: 0, hidden: 0, lockedStyles: null };

  function contentRoot() {
    let best = null;
    let bestLength = 0;
    for (const el of document.querySelectorAll('article, main, [role="main"]')) {
      const length = (el.innerText || '').length;
      if (length > bestLength) {
        best = el;
        bestLength = length;
      }
    }
    return bestLength > 500 ? best : null;
  }

  // Never hide the page itself, the main content, anything containing it, or our own UI.
  function isProtected(el, main) {
    if (el === document.body || el === document.documentElement || el.closest('soroagent-assistant')) return true;
    if (main && (el === main || el.contains(main))) return true;
    // Big blocks of prose are content, unless an ad network clearly owns them.
    return (el.innerText || '').length > 1500 && !el.matches('ins.adsbygoogle, [id^="google_ads"], [id*="taboola"], [id*="outbrain"]');
  }

  // Out-of-flow elements can be removed without moving anything; sticky ones still take space.
  function isFloating(el) {
    const position = getComputedStyle(el).position;
    return position === 'fixed' || position === 'absolute';
  }

  function hide(el, mode) {
    if (el.hasAttribute('data-soroagent-declutter')) return;
    el.setAttribute('data-soroagent-declutter', mode);
    state.hidden++;
  }

  // Small "Advertisement" / "Sponsored" labels mark the slot around them.
  function hideLabelledSlots(main) {
    for (const label of document.querySelectorAll('span, div, p, small, figcaption, header')) {
      if (label.children.length > 1 || !AD_LABEL.test((label.textContent || '').trim())) continue;
      let slot = label.parentElement;
      for (let depth = 0; slot && depth < 3; depth++) {
        const rect = slot.getBoundingClientRect();
        if (rect.height > 60 && rect.height < window.innerHeight * 0.9) break;
        slot = slot.parentElement;
      }
      if (slot && !isProtected(slot, main)) hide(slot, 'space');
    }
  }

  function sweep() {
    state.pending = 0;
    const main = contentRoot();
    for (const el of document.querySelectorAll([...AD_SELECTORS, ...DISTRACTION_SELECTORS].join(','))) {
      if (isProtected(el, main)) continue;
      hide(el, isFloating(el) ? 'gone' : 'space');
    }
    for (const el of document.querySelectorAll(OVERLAY_SELECTORS.join(','))) {
      if (!isProtected(el, main)) hide(el, isFloating(el) ? 'gone' : 'space');
    }
    hideLabelledSlots(main);
    // Pop-ups often lock scrolling; unlock it while overlays are hidden.
    for (const el of [document.documentElement, document.body]) {
      if (getComputedStyle(el).overflow === 'hidden' && document.querySelector('[data-soroagent-declutter="gone"]')) {
        state.lockedStyles = state.lockedStyles || new Map();
        if (!state.lockedStyles.has(el)) state.lockedStyles.set(el, el.style.overflow);
        el.style.setProperty('overflow', 'auto', 'important');
      }
    }
  }

  /** Turns ad hiding on. Returns how many elements are hidden. */
  function hideAds() {
    state.active = true;
    sweep();
    if (!state.observer) {
      // Ads keep loading after the page does; hide them as they arrive.
      state.observer = new MutationObserver(() => {
        if (!state.pending) state.pending = setTimeout(sweep, 400);
      });
      state.observer.observe(document.body, { childList: true, subtree: true });
    }
    return document.querySelectorAll('[data-soroagent-declutter]').length;
  }

  function showAds() {
    state.active = false;
    if (state.observer) state.observer.disconnect();
    state.observer = null;
    clearTimeout(state.pending);
    for (const el of document.querySelectorAll('[data-soroagent-declutter]')) el.removeAttribute('data-soroagent-declutter');
    if (state.lockedStyles) {
      for (const [el, value] of state.lockedStyles) el.style.overflow = value;
      state.lockedStyles = null;
    }
    state.hidden = 0;
  }

  soroagent.declutter = { hideAds, showAds, isActive: () => state.active, count: () => document.querySelectorAll('[data-soroagent-declutter]').length };
  // Applied to the page: keep the space of in-page ads, remove floating ones.
  soroagent.DECLUTTER_CSS = `
[data-soroagent-declutter="space"] { visibility: hidden !important; }
[data-soroagent-declutter="space"] iframe, [data-soroagent-declutter="space"] video { visibility: hidden !important; }
[data-soroagent-declutter="gone"] { display: none !important; }
`;
})(globalThis);

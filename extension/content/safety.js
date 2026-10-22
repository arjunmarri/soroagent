// Page safety check: a quick look at the page itself for signs of scams, phishing, malware
// tricks and spam. It isn't an antivirus (it can't scan files or see servers); it reads the
// address, forms, scripts, links and text the page shows. Strong signs turn the owl red.
// assessSignals() and the helpers are pure (unit tested); collectSignals() reads the DOM.
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});

  const RISKY_TLDS = ['zip', 'mov', 'xyz', 'top', 'click', 'loan', 'work', 'gq', 'tk', 'ml', 'cf', 'ga', 'cam', 'rest', 'country', 'kim', 'support', 'icu', 'buzz'];
  const TWO_PART_SUFFIXES = /\.(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/i;

  // Brands phishing pages most often copy, and the sites that really belong to them.
  const BRANDS = {
    paypal: ['paypal.com'],
    microsoft: ['microsoft.com', 'live.com', 'office.com', 'microsoftonline.com', 'outlook.com', 'xbox.com'],
    'apple id': ['apple.com', 'icloud.com'],
    icloud: ['apple.com', 'icloud.com'],
    netflix: ['netflix.com'],
    google: ['google.com', 'youtube.com', 'gmail.com'],
    gmail: ['google.com', 'gmail.com'],
    facebook: ['facebook.com', 'meta.com'],
    instagram: ['instagram.com'],
    metamask: ['metamask.io'],
    coinbase: ['coinbase.com'],
    binance: ['binance.com'],
    chase: ['chase.com'],
    'wells fargo': ['wellsfargo.com'],
    'bank of america': ['bankofamerica.com'],
    amazon: ['amazon.com', 'amazon.co.uk', 'amazon.in', 'amazon.de', 'amazon.ca', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.co.jp', 'amazon.com.au'],
  };

  const BRAND_NAMES = { paypal: 'PayPal', microsoft: 'Microsoft', 'apple id': 'Apple ID', icloud: 'iCloud', netflix: 'Netflix', google: 'Google', gmail: 'Gmail', facebook: 'Facebook', instagram: 'Instagram', metamask: 'MetaMask', coinbase: 'Coinbase', binance: 'Binance', chase: 'Chase', 'wells fargo': 'Wells Fargo', 'bank of america': 'Bank of America', amazon: 'Amazon' };

  // What each sign means for the reader, and how much it weighs.
  const SIGNS = {
    scareware: { weight: 5, text: 'Says your device is infected or locked, or asks you to call "support". Real virus warnings never come from a web page.' },
    impersonation: { weight: 5, text: 'Asks you to sign in to a well-known brand, but this site doesn\'t belong to that brand. This is how phishing pages look.' },
    cryptoGiveaway: { weight: 5, text: 'Promises to send back more crypto than you send. That\'s always a scam.' },
    miner: { weight: 5, text: 'Loads a known cryptocurrency-mining script that uses your computer without asking.' },
    insecurePassword: { weight: 3, text: 'Asks for a password on an unencrypted (http) page, so it could be read in transit.' },
    crossSitePassword: { weight: 3, text: 'Sends the password you type to a different website.' },
    prizeScam: { weight: 3, text: 'Claims you\'ve won a prize or gift. These pages usually collect personal or card details.' },
    notificationBait: { weight: 3, text: 'Tells you to click "Allow" to continue. That lets the site flood you with spam notifications.' },
    fakeUpdate: { weight: 3, text: 'Pushes a "player" or "browser update" download. Real updates come from your browser or system, not a web page.' },
    executables: { weight: 2, text: 'Offers program files (.exe, .apk, .msi…) for download.' },
    obfuscated: { weight: 2, text: 'Runs scripts that are deliberately disguised, a common trick in malicious pages.' },
    hiddenFrames: { weight: 2, text: 'Hides several invisible frames from other websites inside the page.' },
    redirect: { weight: 2, text: 'Automatically redirects you to a different website.' },
    lookalike: { weight: 2, text: 'The address uses look-alike characters (punycode), which can imitate another site\'s name.' },
    ipAddress: { weight: 2, text: 'The address is a raw IP number instead of a site name.' },
    spamWords: { weight: 2, text: 'Packed with spam keywords (casino, pills, loans, cracks…).' },
    linkFarm: { weight: 2, text: 'Hundreds of links to unrelated websites, typical of spam link farms.' },
    riskyTld: { weight: 1, text: 'Uses a domain ending that\'s popular with spam and scam sites.' },
    adHeavy: { weight: 1, text: 'Covered in ads.' },
  };

  /** Pure: "login.secure.example.co.uk" → "example.co.uk"; "1.2.3.4" stays as is. */
  function siteOf(host) {
    const h = String(host || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || !h.includes('.')) return h;
    const parts = h.split('.');
    return parts.slice(TWO_PART_SUFFIXES.test(h) ? -3 : -2).join('.');
  }

  /** Pure: true when `host` belongs to one of `domains` (subdomains included). */
  const ownedBy = (host, domains) => domains.some((d) => host === d || host.endsWith(`.${d}`));

  /** Pure: the brand a sign-in page claims to be, when the host doesn't belong to it. */
  function impersonatedBrand(text, host) {
    const h = String(host || '').toLowerCase();
    // "Sign in with Google" / "Continue with Apple" buttons are normal on real sites.
    const t = String(text || '').toLowerCase().replace(/\b(sign in|log ?in|sign up|continue|connect|register)\s+(with|using|via)\s+[a-z ]{2,20}/g, ' ');
    for (const [brand, domains] of Object.entries(BRANDS)) {
      const named = new RegExp(`\\b${brand}\\b`).test(t);
      if (named && /\b(sign in|log ?in|verify|account|password)\b/.test(t) && !ownedBy(h, domains)) return brand;
    }
    return '';
  }

  /** Pure: text-based signs in the page's visible text. */
  function textSigns(text) {
    const t = String(text || '').slice(0, 30000);
    const signs = [];
    if (/your (computer|pc|device|iphone|mac|phone|windows)( has been| is| was)? (infected|hacked|locked|compromised|blocked)|\b\d+ viruses? (detected|found)|call (microsoft|apple|windows|technical|tech) support|do not (close|restart|shut down) (this|your) (page|computer|window)/i.test(t)) signs.push('scareware');
    if (/congratulations[^.]{0,60}(you('ve| have)? (won|been selected)|winner)|claim your (prize|reward|gift)|free (iphone|gift ?card|samsung)/i.test(t)) signs.push('prizeScam');
    if (/send \d+(\.\d+)? ?(btc|eth|usdt|bitcoin|ether)[^.]{0,80}(receive|get|back) \d+|double your (bitcoin|crypto|btc|eth)/i.test(t)) signs.push('cryptoGiveaway');
    if (/(click|press|tap) "?allow"? to (continue|verify|confirm|watch|download|prove)|confirm (that )?you are not a robot by clicking allow/i.test(t)) signs.push('notificationBait');
    if (/(flash|video) player (update|is out of date)|your browser is out of date[^.]{0,40}(update|download)|(install|download) (the )?(required|latest) (update|codec|plugin) to (play|watch|continue)/i.test(t)) signs.push('fakeUpdate');
    const spam = t.match(/\b(casino|viagra|cialis|payday loans?|keygen|cracked|crack download|slot gacor|xxx|escort|porn)\b/gi) || [];
    if (spam.length >= 8) signs.push('spamWords');
    return signs;
  }

  /**
   * Pure: { level: 'ok' | 'caution' | 'danger', score, reasons: [{ sign, text }] } from a list of
   * sign ids (see SIGNS). Danger needs strong evidence: one decisive sign plus another, or many.
   */
  function assessSignals(signIds, extra = {}) {
    const unique = [...new Set(signIds)].filter((s) => SIGNS[s]);
    const score = unique.reduce((sum, s) => sum + SIGNS[s].weight, 0);
    const reasons = unique.sort((a, b) => SIGNS[b].weight - SIGNS[a].weight).map((sign) => ({
      sign,
      text: sign === 'impersonation' && extra.brand ? SIGNS[sign].text.replace('a well-known brand', BRAND_NAMES[extra.brand] || extra.brand) : SIGNS[sign].text,
    }));
    const level = score >= 6 ? 'danger' : score >= 3 ? 'caution' : 'ok';
    return { level, score, reasons };
  }

  /** Reads the page and returns assessSignals()'s result. */
  function checkPageSafety(doc = document, loc = location, { adCount = 0 } = {}) {
    const host = loc.hostname.toLowerCase();
    const here = siteOf(host);
    const signs = [];
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) signs.push('ipAddress');
    if (host.split('.').some((label) => label.startsWith('xn--'))) signs.push('lookalike');
    if (RISKY_TLDS.includes(host.split('.').pop())) signs.push('riskyTld');

    const passwords = doc.querySelectorAll('input[type="password"]');
    if (passwords.length && loc.protocol === 'http:' && !/^(localhost|127\.0\.0\.1)$/.test(host)) signs.push('insecurePassword');
    for (const input of passwords) {
      const action = input.form && input.form.getAttribute('action');
      if (!action) continue;
      try {
        const target = new URL(action, loc.href);
        if (/^https?:$/.test(target.protocol) && siteOf(target.hostname) !== here) {
          signs.push('crossSitePassword');
          break;
        }
      } catch {
        // relative or odd action; ignore
      }
    }

    const body = doc.body;
    const text = body ? (body.innerText || body.textContent || '').slice(0, 30000) : '';
    signs.push(...textSigns(text));
    let brand = '';
    if (passwords.length) {
      // What the page says it is: its title and main headings (not its buttons).
      const heading = [doc.title, ...[...doc.querySelectorAll('h1, h2, form legend')].slice(0, 12).map((e) => e.textContent)].join(' ');
      brand = impersonatedBrand(heading, host);
      if (brand) signs.push('impersonation');
    }

    for (const script of doc.querySelectorAll('script')) {
      const src = script.getAttribute('src') || '';
      if (/coinhive|coin-hive|cryptonight|webminepool|minero\.cc|coinimp|cryptoloot|jsecoin/i.test(src)) signs.push('miner');
      if (!src) {
        const code = script.textContent.slice(0, 20000);
        if (/eval\s*\(\s*(atob|unescape|decodeURIComponent)\s*\(|document\.write\s*\(\s*unescape\s*\(|eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k/i.test(code) || /(\\x[0-9a-f]{2}){60,}/i.test(code)) signs.push('obfuscated');
        if (/CoinHive\.Anonymous|new\s+Client\.Anonymous\(/.test(code)) signs.push('miner');
      }
    }

    const links = [...doc.querySelectorAll('a[href]')];
    if (links.some((a) => /\.(exe|scr|msi|apk|bat|vbs|jar|pif|cmd)(\?|#|$)/i.test(a.getAttribute('href')))) signs.push('executables');
    const external = new Set();
    for (const a of links.slice(0, 2000)) {
      try {
        const h = new URL(a.href, loc.href).hostname;
        if (h && siteOf(h) !== here) external.add(siteOf(h));
      } catch {
        // ignore
      }
    }
    if (links.length > 150 && external.size > 60) signs.push('linkFarm');

    let hidden = 0;
    for (const frame of doc.querySelectorAll('iframe[src]')) {
      try {
        const h = new URL(frame.getAttribute('src'), loc.href).hostname;
        const style = getComputedStyle(frame);
        const tiny = frame.offsetWidth <= 2 || frame.offsetHeight <= 2;
        if (siteOf(h) !== here && (tiny || style.display === 'none' || style.visibility === 'hidden')) hidden++;
      } catch {
        // ignore
      }
    }
    if (hidden >= 3) signs.push('hiddenFrames');

    const refresh = doc.querySelector('meta[http-equiv="refresh" i]');
    const target = refresh && (refresh.getAttribute('content') || '').match(/url\s*=\s*['"]?([^'";]+)/i);
    if (target) {
      try {
        if (siteOf(new URL(target[1], loc.href).hostname) !== here) signs.push('redirect');
      } catch {
        // ignore
      }
    }
    if (adCount >= 15) signs.push('adHeavy');
    return assessSignals(signs, { brand });
  }

  Object.assign(soroagent, { SAFETY_SIGNS: SIGNS, siteOf, impersonatedBrand, textSigns, assessSignals, checkPageSafety });
})(globalThis);

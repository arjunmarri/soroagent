// Shop product pages (Amazon, Shopify stores, most online shops). A page is a product page when it
// clearly says so (schema.org Product data, og:type "product", Amazon's product title) and has an
// "Add to cart" style button or a price, or when it shows an Add to cart button next to a price.
// Cart buttons may still be hidden (size not picked yet, item out of stock), so they count either
// way. Used for the panel's "Buy later" (wish list) option. The parsing helpers are pure.
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});

  const ADD_TO_CART = /^\s*(add to (cart|bag|basket|trolley)|add to shopping (cart|bag)|buy now|buy it now|in den warenkorb|ajouter au panier|añadir al carrito|aggiungi al carrello|カートに入れる)\b/i;
  const CART_SELECTORS = [
    '#add-to-cart-button', '#buy-now-button', '[name="add-to-cart"]', '[name="submit.add-to-cart"]',
    'button[name="add"]', 'form[action*="/cart/add"] [type="submit"]', '[data-testid*="add-to-cart" i]', '[id*="add-to-cart" i]', '[class*="add-to-cart" i]',
  ];

  /** Pure: true for button text like "Add to Cart", "Add to bag", "Buy Now". */
  const isAddToCartText = (text) => ADD_TO_CART.test(String(text || '').replace(/\s+/g, ' '));

  const first = (value) => (Array.isArray(value) ? value[0] : value);
  const clean = (value, max = 200) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

  /**
   * Pure: the first schema.org Product in parsed JSON-LD blocks (objects, arrays or @graph):
   * { title, price, currency, image } or null.
   */
  function productFromJsonLd(blocks) {
    const queue = [...(Array.isArray(blocks) ? blocks : [blocks])];
    while (queue.length) {
      const item = queue.shift();
      if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item)) {
        queue.push(...item);
        continue;
      }
      if (item['@graph']) queue.push(...[].concat(item['@graph']));
      const types = [].concat(item['@type'] || []).map(String);
      if (types.some((t) => /^(Product|ProductGroup|IndividualProduct)$/i.test(t))) {
        const offer = first(item.offers) || {};
        const offers = offer.offers ? first(offer.offers) : offer; // AggregateOffer
        const image = first(item.image);
        return {
          title: clean(item.name),
          price: clean(offers.price ?? offers.lowPrice ?? '', 30),
          currency: clean(offers.priceCurrency, 8),
          image: clean(typeof image === 'object' && image ? image.url || image.contentUrl : image, 500),
        };
      }
    }
    return null;
  }

  /** Pure: "$19.99", "€ 1.299,00 EUR" → a display price. */
  function formatPrice(price, currency) {
    const p = clean(price, 30);
    if (!p) return '';
    if (/[^\d.,\s]/.test(p) || !currency) return p;
    const n = Number(p);
    if (!Number.isFinite(n)) return `${p} ${currency}`;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
    } catch {
      return `${p} ${currency}`;
    }
  }

  function visible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }

  // 'visible' when a cart button is on screen, 'hidden' when there's only a hidden one, else ''.
  function addToCart(doc) {
    let found = '';
    const candidates = [
      ...doc.querySelectorAll(CART_SELECTORS.join(',')),
      ...[...doc.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"], [role="button"]')].filter((el) => {
        const text = el.value || el.getAttribute('aria-label') || el.textContent;
        return text && text.length < 60 && isAddToCartText(text);
      }),
    ];
    for (const el of candidates) {
      if (visible(el)) return 'visible';
      found = 'hidden';
    }
    return found;
  }

  const meta = (doc, ...names) => {
    for (const name of names) {
      const el = doc.querySelector(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`);
      if (el && el.content) return el.content;
    }
    return '';
  };

  /** The product on this page, or null when it isn't a shop product page. */
  function detectProduct(doc = document, loc = location) {
    const cart = addToCart(doc);
    const blocks = [];
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        blocks.push(JSON.parse(script.textContent));
      } catch {
        // broken structured data; ignore it
      }
    }
    const ld = productFromJsonLd(blocks) || {};
    const ogType = meta(doc, 'og:type');
    const amazonPrice = doc.querySelector('#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, .priceToPay .a-offscreen, #priceblock_ourprice, #price_inside_buybox');
    const price = ld.price || meta(doc, 'product:price:amount', 'og:price:amount', 'price') || (amazonPrice && amazonPrice.textContent) || '';
    const amazonTitle = doc.querySelector('#productTitle');
    const saysProduct = Boolean(ld.title) || /product/i.test(ogType) || Boolean(amazonTitle) || Boolean(doc.querySelector('[itemtype*="schema.org/Product"]'));
    if (!((saysProduct && (cart || price)) || (cart === 'visible' && price))) return null;
    const amazonImage = doc.querySelector('#landingImage, #imgBlkFront');
    const title = clean((amazonTitle && amazonTitle.textContent) || ld.title || meta(doc, 'og:title') || doc.title);
    return {
      title,
      price: formatPrice(price, ld.currency || meta(doc, 'product:price:currency', 'og:price:currency', 'priceCurrency')),
      image: clean((amazonImage && (amazonImage.getAttribute('data-old-hires') || amazonImage.src)) || ld.image || meta(doc, 'og:image'), 500),
      url: loc.href,
      site: loc.hostname.replace(/^www\./, ''),
    };
  }

  Object.assign(soroagent, { isAddToCartText, productFromJsonLd, formatPrice, detectProduct });
})(globalThis);

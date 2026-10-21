import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('content/product.js');

test('add-to-cart buttons are recognized in several shops and languages', () => {
  for (const text of ['Add to Cart', ' add to bag ', 'Add to Basket', 'Buy Now', 'In den Warenkorb', 'Ajouter au panier']) assert.ok(S.isAddToCartText(text), text);
  for (const text of ['Cart', 'Add to list', 'Buy the book review', 'Subscribe']) assert.ok(!S.isAddToCartText(text), text);
});

test('products are read from schema.org structured data, including @graph and offer lists', () => {
  assert.deepEqual(S.productFromJsonLd([{ '@type': 'Product', name: 'Owl lamp', image: ['https://a.com/1.jpg'], offers: { price: '19.99', priceCurrency: 'USD' } }]), {
    title: 'Owl lamp', price: '19.99', currency: 'USD', image: 'https://a.com/1.jpg',
  });
  const graph = { '@graph': [{ '@type': 'WebPage' }, { '@type': ['Product'], name: 'Mug', image: { url: 'https://a.com/m.png' }, offers: { '@type': 'AggregateOffer', lowPrice: 5, priceCurrency: 'EUR' } }] };
  assert.equal(S.productFromJsonLd(graph).price, '5');
  assert.equal(S.productFromJsonLd(graph).image, 'https://a.com/m.png');
  assert.equal(S.productFromJsonLd([{ '@type': 'Article', name: 'News' }]), null);
});

test('prices keep the shop formatting, or get a currency symbol', () => {
  assert.equal(S.formatPrice('$19.99', 'USD'), '$19.99');
  assert.match(S.formatPrice('19.99', 'USD'), /19\.99/);
  assert.equal(S.formatPrice('', 'USD'), '');
});

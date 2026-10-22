import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('content/safety.js', 'content/quips.js');

test('scam text is recognized, ordinary text is not', () => {
  assert.deepEqual(S.textSigns('WARNING! Your computer is infected. Call Microsoft Support now'), ['scareware']);
  assert.deepEqual(S.textSigns('Congratulations! You have won a free iPhone. Claim your prize'), ['prizeScam']);
  assert.deepEqual(S.textSigns('Send 0.5 BTC to this address and receive 1 BTC back'), ['cryptoGiveaway']);
  assert.deepEqual(S.textSigns('Click Allow to continue watching'), ['notificationBait']);
  assert.deepEqual(S.textSigns('Researchers found the virus spreads in winter. Microsoft announced support for ARM.'), []);
});

test('sign-in pages for a brand on someone else\'s site are flagged', () => {
  assert.equal(S.impersonatedBrand('PayPal: Log in to your account', 'paypal-secure-login.xyz'), 'paypal');
  assert.equal(S.impersonatedBrand('PayPal: Log in to your account', 'www.paypal.com'), '');
  assert.equal(S.impersonatedBrand('Sign in with your Microsoft account', 'login.microsoftonline.com'), '');
  assert.equal(S.impersonatedBrand('Our review of the PayPal app', 'example.com'), '');
  assert.equal(S.impersonatedBrand('Sign in to GitHub · Continue with Google · Sign in with Apple', 'github.com'), '', 'social sign-in buttons are fine');
});

test('the owl turns red only on strong evidence', () => {
  assert.equal(S.assessSignals([]).level, 'ok');
  assert.equal(S.assessSignals(['riskyTld', 'adHeavy']).level, 'ok');
  assert.equal(S.assessSignals(['insecurePassword']).level, 'caution');
  assert.equal(S.assessSignals(['scareware']).level, 'caution');
  assert.equal(S.assessSignals(['scareware', 'riskyTld']).level, 'danger');
  const result = S.assessSignals(['riskyTld', 'impersonation'], { brand: 'paypal' });
  assert.equal(result.level, 'danger');
  assert.equal(result.reasons[0].sign, 'impersonation', 'strongest reason first');
  assert.match(result.reasons[0].text, /sign in to PayPal/);
});

test('sites are compared by their registrable domain', () => {
  assert.equal(S.siteOf('login.secure.example.co.uk'), 'example.co.uk');
  assert.equal(S.siteOf('www.paypal.com'), 'paypal.com');
  assert.equal(S.siteOf('1.2.3.4'), '1.2.3.4');
});

test('one-liners are random and never repeat back to back', () => {
  assert.ok(S.QUIPS.length >= 20);
  let previous = '';
  for (let i = 0; i < 200; i++) {
    const quip = S.pickQuip(previous);
    assert.ok(S.QUIPS.includes(quip));
    assert.notEqual(quip, previous);
    previous = quip;
  }
  assert.equal(S.pickQuip(S.QUIPS[0], () => 0), S.QUIPS[1]);
});

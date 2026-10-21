import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('shared/markdown.js');

test('@handles in X summaries become links to the account', () => {
  const out = S.linkHandles('- **@NASA** — launch news; (@elonmusk) replied. Mail me@site.com', 'x.com');
  assert.equal(out, '- **[@NASA](https://x.com/NASA)** — launch news; ([@elonmusk](https://x.com/elonmusk)) replied. Mail me@site.com');
  assert.match(S.renderMarkdown(out), /<a href="https:\/\/x\.com\/NASA"[^>]*>@NASA<\/a>/);
});

test('existing links, code and other sites are left alone', () => {
  assert.equal(S.linkHandles('see [@a](https://x.com/a) and `@b`', 'https://x.com/home'), 'see [@a](https://x.com/a) and `@b`');
  assert.equal(S.linkHandles('@someone', 'example.com'), '@someone');
});

test('u/ and r/ names in Reddit summaries become links', () => {
  assert.equal(
    S.linkHandles('Posted by u/spez in r/LocalLLaMA', 'www.reddit.com'),
    'Posted by [u/spez](https://www.reddit.com/user/spez) in [r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA)'
  );
});

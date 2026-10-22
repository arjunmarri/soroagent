// One-liners the owl says when the panel opens. Picked at random, never the same one twice in a
// row. Add your own: keep them short, kind, and about browsing, feeds or attention.
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});

  const QUIPS = Object.freeze([
    'Actually, always skip low-quality videos. They fry the brain.',
    'Reminder: the comments section is not peer review.',
    'Your 47 open tabs called. They want a summary.',
    'If a headline ends in a question mark, the answer is usually no.',
    'Big if true. Bigger if sourced.',
    'Doomscrolling is cardio for your thumb only.',
    'Touch grass. Then come back and finish the article.',
    'This page could have been a summary.',
    'Hot take: "I did my own research" should come with citations.',
    'One does not simply read the comments.',
    'Respectfully, that thread is 80% vibes.',
    'Owls don\'t skim. Okay, I skim. Very, very fast.',
    'Plot twist: the real treasure was the snippets we saved along the way.',
    'Not me reading the whole page so you don\'t have to.',
    'Brain rot is real. I\'m the antidote, with feathers.',
    'Main character energy: actually opening a "read later" tab.',
    'Never trust a thumbnail with a red arrow and a shocked face.',
    'Ratio\'d by an owl. Couldn\'t be you.',
    'Hydrate. Then hit Summarize.',
    'Instructions unclear, summarized the entire internet.',
    'I\'m not saying it\'s misinformation, but I am squinting.',
    'Wise owl rule: "you won\'t believe what happened next" means you won\'t.',
    'Context is the main character. Clickbait is the extra.',
    'Sorting facts from vibes since 2026.',
    'Low battery, high curiosity. Let\'s go.',
    'Somebody on the internet is wrong. It\'s fine. Breathe.',
    'Reading the replies at 2am is a choice. A bad one, but a choice.',
    'Nobody: … Me: turning your rabbit hole into notes.',
    'Pro tip: "breaking" news is often just bent.',
    'Quality over quantity. Unless it\'s snacks.',
  ]);

  /** A random one-liner, different from `previous`. `random` is injectable for tests. */
  function pickQuip(previous = '', random = Math.random) {
    const choices = QUIPS.filter((q) => q !== previous);
    return choices[Math.floor(random() * choices.length) % choices.length];
  }

  Object.assign(soroagent, { QUIPS, pickQuip });
})(globalThis);

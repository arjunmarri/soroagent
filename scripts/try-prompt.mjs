// Runs one SoroAgent action against your local model, outside the browser, so you can tune
// prompts in extension/prompts/ quickly.
//
//   npm run try-prompt -- --action summarize
//   npm run try-prompt -- --site x --action summarize --show-prompt
//   npm run try-prompt -- --site x --action ask --question "Which posts are about privacy?"
//   npm run try-prompt -- --action save --input my-page.txt --model qwen3:30b-a3b
//
// Options: --site <id> (default "default"), --action <name>, --input <file>, --question <text>,
//          --context <text>, --model <name> (default: the best installed model), --url <server>
//          (default http://127.0.0.1:11434 or $SOROAGENT_URL), --show-prompt
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXT = join(ROOT, 'extension');

function parseArgs(argv) {
  const args = { site: 'default', action: 'summarize', showPrompt: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key === 'show-prompt') args.showPrompt = true;
    else args[key.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const load = async (rel) => import(pathToFileURL(join(EXT, rel)).href);
for (const file of ['shared/config.js', 'shared/markdown.js', 'shared/prompts.js', 'background/llm.js', 'background/recommend.js']) await load(file);
for (const file of readdirSync(join(EXT, 'prompts')).filter((f) => f.endsWith('.js') && !f.startsWith('_')).sort()) await load(`prompts/${file}`);
const S = globalThis.SoroAgent;

if (!S.PROMPT_ACTIONS.includes(args.action)) {
  console.error(`Unknown action "${args.action}". Actions: ${S.PROMPT_ACTIONS.join(', ')}`);
  process.exit(1);
}

const inputFile = args.input || join(EXT, 'prompts/samples', args.site === 'x' ? 'x-posts.txt' : 'article.txt');
const text = readFileSync(inputFile, 'utf8').trim();
const count = (text.match(/^\[\d+\]/gm) || []).length;
const context =
  args.context ?? (args.site === 'x' ? 'These are top posts from X search results for the query "local llm".' : '');
const vars = S.pageVars(
  { title: basename(inputFile), url: 'https://example.com/sample', text },
  { context, count: count || '', question: args.question || 'What are the main points?' }
);
const prompts = S.promptsFor(args.site);
let messages = S.buildMessages(args.action, vars, prompts);
if (args.action === 'ask') messages = [messages[0], { role: 'user', content: vars.question }];

if (args.showPrompt) {
  for (const m of messages) console.log(`\x1b[2m──── ${m.role} ────\x1b[0m\n${m.content}\n`);
}

const connection = S.resolveConnection({ ...S.DEFAULT_SETTINGS, baseUrl: args.url || process.env.SOROAGENT_URL || S.DEFAULT_SETTINGS.baseUrl });
const status = await S.listModels(connection);
const best = S.recommendModels(status.models)[0];
connection.model = args.model || (best && best.id) || status.suggested;
if (!connection.model) {
  console.error('No models found on the server. Pull one first, e.g. ollama pull qwen2.5:7b');
  process.exit(1);
}

const json = args.action === 'save';
console.log(`\x1b[2m──── ${args.site}/${args.action} on ${connection.model} ────\x1b[0m`);
const started = Date.now();
const reply = await S.chat({ connection, api: status.api, messages, json, onToken: (t) => process.stdout.write(t) });
console.log(`\n\x1b[2m──── ${((Date.now() - started) / 1000).toFixed(1)}s ────\x1b[0m`);

if (json) {
  const parsed = S.parseSnippetMeta(reply, basename(inputFile));
  console.log('Parsed by SoroAgent:', JSON.stringify(parsed, null, 2));
}

#!/usr/bin/env node
// Announces one terum-skills release in a Discord channel through a webhook.
//
// Reads the release and the pull requests it shipped through `gh`, then posts a short release note
// that pings @everyone: what is new and what was fixed, written from the pull request titles.
// It announces versions; it never cuts one. Releases are still made by release.yml, and
// .github/workflows/release-announcement.yml runs this after every Release run.
//
// A pull request belongs to the release when its merge commit lies between the previous stable
// tag and this one, so the list agrees with GitHub's generated release notes.
//
// Usage:
//   node scripts/release-announcement.mjs                  # announce the latest release
//   node scripts/release-announcement.mjs --tag v0.23.0    # announce a given release
//   node scripts/release-announcement.mjs --sha <commit>   # announce the release tagged at that commit;
//                                                          # posts nothing when there is none (a dry run)
//   add --dry-run to print the payload instead of posting.
// Posting needs DISCORD_WEBHOOK_URL. With --sha, RUN_STARTED_AT (ISO time) skips a release that was
// published before the Release run started, so a recovery run never announces a version twice.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// execFile with an argument array: no shell, so nothing in a title or body is ever interpreted.
const run = promisify(execFile);
const REPO = 'Terum-Inc/terum-skills';
const DAY = 24 * 60 * 60 * 1000;
const COLOR = 0x51478a;

const args = process.argv.slice(2);
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dryRun = args.includes('--dry-run');
const wantTag = option('--tag');
const wantSha = option('--sha');
const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!dryRun && !webhook) {
  process.stderr.write('DISCORD_WEBHOOK_URL is not set. Add it as a repository secret, or pass --dry-run.\n');
  process.exit(2);
}

async function gh(ghArgs) {
  try {
    const { stdout } = await run('gh', ghArgs, { maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`gh ${ghArgs.join(' ')} failed: ${detail}\nThis script needs the GitHub CLI logged in (or GH_TOKEN set).\n`);
    process.exit(2);
  }
}

const SEMVER = /^v(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;
const parts = tag => SEMVER.exec(tag).slice(1, 4).map(Number);
const compare = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

// Newest first by publish time.
const releases = JSON.parse(await gh(['release', 'list', '--repo', REPO, '--limit', '200', '--json', 'tagName,publishedAt,isPrerelease']))
  .filter(release => SEMVER.test(release.tagName))
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

let release;
if (wantTag) {
  release = releases.find(r => r.tagName === wantTag);
  if (!release) {
    process.stderr.write(`No GitHub Release is tagged ${wantTag}.\n`);
    process.exit(2);
  }
} else if (wantSha) {
  // The Release run that just finished made at most one release; it is among the newest.
  for (const candidate of releases.slice(0, 5)) {
    const sha = (await gh(['api', `repos/${REPO}/commits/${candidate.tagName}`, '--jq', '.sha'])).trim();
    if (sha === wantSha) { release = candidate; break; }
  }
  if (!release) {
    process.stderr.write(`No release for this run (nothing is tagged at ${wantSha}); nothing posted.\n`);
    process.exit(0);
  }
  const startedAt = process.env.RUN_STARTED_AT ? new Date(process.env.RUN_STARTED_AT) : null;
  if (startedAt && new Date(release.publishedAt) < startedAt) {
    process.stderr.write(`${release.tagName} was published before this Release run started; already announced, nothing posted.\n`);
    process.exit(0);
  }
} else {
  release = releases[0];
  if (!release) {
    process.stderr.write('This repository has no releases yet; nothing posted.\n');
    process.exit(0);
  }
}

// The previous stable release below this one, by version.
const previous = releases
  .filter(r => !r.isPrerelease && compare(r.tagName, release.tagName) < 0)
  .map(r => r.tagName)
  .sort(compare)
  .at(-1) ?? null;
const previousRelease = releases.find(r => r.tagName === previous);

// The commits a range adds, from GitHub's compare view (up to 250, far more than a release holds).
async function commitsBetween(base, head) {
  const shas = await gh(['api', `repos/${REPO}/compare/${base}...${head}`, '--jq', '.commits[].sha']);
  return new Set(shas.split('\n').filter(Boolean));
}

// Fetch a week before the previous release, so a pull request that merged just before it was tagged
// is still considered. Membership is decided by commit, so fetching extra pull requests is harmless.
const fetchFrom = new Date(new Date(previousRelease?.publishedAt ?? release.publishedAt).getTime() - 7 * DAY);
const commits = previous ? await commitsBetween(previous, release.tagName) : new Set();
const pulls = JSON.parse(await gh(['pr', 'list', '--repo', REPO, '--state', 'merged', '--limit', '500',
  '--search', `merged:>=${fetchFrom.toISOString().slice(0, 10)}`,
  '--json', 'number,title,body,mergedAt,url,headRefName,mergeCommit']))
  .filter(pull => !/^release\//.test(pull.headRefName) && !/^(?:release|chore\(release\)):/.test(pull.title))
  .filter(pull => pull.mergeCommit?.oid && commits.has(pull.mergeCommit.oid))
  .sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));

// What each pull request contributes to the note. Only changes users can notice are announced:
// docs, CI, tests and other upkeep are left out.
const TITLE = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;
const INTERNAL = new Set(['docs', 'chore', 'ci', 'test', 'refactor', 'build', 'perf', 'style']);
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
// Markdown that would change the meaning of a title; backticks stay so `/command` shows as code.
const escape = text => text.replace(/([*_~|\\])/g, '\\$1');
function classify(pull) {
  const match = TITLE.exec(pull.title);
  const type = match?.[1].toLowerCase() ?? null;
  const breaking = Boolean(match?.[3]) || /BREAKING[ -]CHANGE/.test(pull.body ?? '');
  const section = breaking ? 'breaking' : type === 'feat' ? 'new' : INTERNAL.has(type) ? null : 'fixes';
  // Drop the type(scope) prefix and internal references: a milestone tag ("M1.1 — ") in front,
  // a spec section or split marker ("(IE6 §3.1)", "(piece 1 of 2)") at the end.
  let text = (match ? match[4] : pull.title).trim()
    .replace(/^M\d+(?:\.\d+)*\s*[—–-]\s*/, '')
    .replace(/\s*\((?:[^()]*§[^()]*|piece \d+ of \d+)\)\s*$/i, '');
  text = capitalize(text);
  if (!/[.!?]$/.test(text)) text += '.';
  return { section, text };
}

const SECTIONS = [['breaking', '◆ Breaking changes'], ['new', '◇ New'], ['fixes', '◈ Fixes and improvements']];
const url = `https://github.com/${REPO}/releases/tag/${release.tagName}`;
const notesLink = `[Full release notes](${url})`;

const bySection = new Map(SECTIONS.map(([key]) => [key, []]));
for (const pull of pulls) {
  const { section, text } = classify(pull);
  if (section) bySection.get(section).push(text);
}
const listed = [...bySection.values()].reduce((n, items) => n + items.length, 0);

const head = [
  `## Terum ${release.tagName} is out for Mac and Windows${release.isPrerelease ? ' as a pre-release' : ''}!`,
  '-# Update from inside the app to get it.',
].join('\n');
const tail = previous ? `Based on ${previous} · ${notesLink}` : notesLink;

// Discord caps a description at 4096 characters; keep whole bullets and point to the full notes.
let body = '';
let shown = 0;
let cut = false;
for (const [key, heading] of SECTIONS) {
  const items = bySection.get(key);
  if (!items.length || cut) continue;
  let block = `\n\n### ${heading}`;
  for (const item of items) {
    const line = `\n- ${escape(item)}`;
    if (head.length + body.length + block.length + line.length + tail.length + 120 > 4096) { cut = true; break; }
    block += line;
    shown++;
  }
  body += block;
}
if (cut) body += `\n\n…and ${listed - shown} more in the ${notesLink.replace('Full', 'full')}.`;
if (!listed) body = '\n\nBehind-the-scenes improvements; nothing changes in how you use the app.';

const payload = {
  username: 'terum-skills changelog',
  content: '@everyone',
  embeds: [{
    description: `${head}${body}\n\n${tail}`,
    color: COLOR,
    timestamp: release.publishedAt,
  }],
  allowed_mentions: { parse: ['everyone'] },
};

if (dryRun) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(0);
}
const response = await fetch(`${webhook}?wait=true`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!response.ok) {
  process.stderr.write(`Discord refused the post: ${response.status} ${await response.text()}\n`);
  process.exit(1);
}
process.stderr.write(`Announced ${release.tagName} (${listed} changes listed from ${pulls.length} pull requests).\n`);

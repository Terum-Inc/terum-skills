#!/usr/bin/env node
// Announces one terum-skills release in a Discord channel through a webhook.
//
// Reads the release and the pull requests it shipped (scripts/release-notes.mjs), then posts a short
// release note that pings @everyone: what is new and what was fixed, written from the pull request
// titles. It announces versions; it never cuts one. Releases are still made by release.yml, and
// .github/workflows/release-announcement.yml runs this after every Release run.
//
// Usage:
//   node scripts/release-announcement.mjs                  # announce the latest release
//   node scripts/release-announcement.mjs --tag v0.23.0    # announce a given release
//   node scripts/release-announcement.mjs --sha <commit>   # announce the release tagged at that commit;
//                                                          # posts nothing when there is none (a dry run)
//   add --dry-run to print the payload instead of posting.
//   --observations FILE                                    # hermetic mode (tests): read GitHub from JSON
// Posting needs DISCORD_WEBHOOK_URL. With --sha, RUN_STARTED_AT (ISO time) skips a release that was
// published before the Release run started, so a recovery run never announces a version twice.
import { readFileSync } from 'node:fs';
import { announced, hermeticWorld, liveWorld, notesFor, options, releases, resolveRelease } from './release-notes.mjs';

const COLOR = 0x51478a;
const SITE_CHANGELOG = 'https://www.terum.ai/changelog';
const opts = options(process.argv.slice(2));
const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!opts.dryRun && !webhook) {
  process.stderr.write('DISCORD_WEBHOOK_URL is not set. Add it as a repository secret, or pass --dry-run.\n');
  process.exit(2);
}

const world = opts.observations ? hermeticWorld(JSON.parse(readFileSync(opts.observations, 'utf8'))) : liveWorld();
let notes;
try {
  const all = await releases(world);
  const resolved = await resolveRelease(all, opts, world);
  if (resolved.skip) {
    process.stderr.write(`${resolved.skip}; nothing posted.\n`);
    process.exit(0);
  }
  notes = await notesFor(resolved.release, all, world);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}

// Markdown that would change the meaning of a title; backticks stay so `/command` shows as code.
const escape = text => text.replace(/([*_~|\\])/g, '\\$1');
const HEADINGS = [['breaking', '◆ Breaking changes'], ['new', '◇ New'], ['fixes', '◈ Fixes and improvements']];
const notesLink = `[Full release notes](${notes.url})`;
const siteLink = `[Changelog](${SITE_CHANGELOG}#${notes.tag})`;
const listed = announced(notes);

const head = [
  `## Terum ${notes.tag} is out for Mac and Windows${notes.prerelease ? ' as a pre-release' : ''}!`,
  '-# Update from inside the app to get it.',
].join('\n');
const tail = `${notes.previous ? `Based on ${notes.previous} · ` : ''}${notesLink} · ${siteLink}`;

// Discord caps a description at 4096 characters; keep whole bullets and point to the full notes.
let body = '';
let shown = 0;
let cut = false;
for (const [key, heading] of HEADINGS) {
  const items = notes.sections[key];
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
    timestamp: notes.publishedAt,
  }],
  allowed_mentions: { parse: ['everyone'] },
};

if (opts.dryRun) {
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
process.stderr.write(`Announced ${notes.tag} (${listed} changes listed from ${notes.pulls.length} pull requests).\n`);

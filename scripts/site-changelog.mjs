#!/usr/bin/env node
// Publishes the terum-skills changelog to the website: builds `changelog.json` (every release, newest
// first, with the same curated sections the Discord announcement uses plus the merged pull requests)
// and commits it to the website repository, which Vercel then deploys as https://www.terum.ai/changelog.
//
// It publishes notes; it never cuts a version. Releases are still made by release.yml, and
// .github/workflows/release-announcement.yml runs this after every Release run.
//
// Usage:
//   node scripts/site-changelog.mjs                  # the latest release (and any release the file lacks)
//   node scripts/site-changelog.mjs --tag v0.23.0    # rebuild a given release
//   node scripts/site-changelog.mjs --sha <commit>   # the release tagged at that commit; nothing when there is none
//   node scripts/site-changelog.mjs --all            # rebuild every release from scratch (a backfill)
//   --dry-run         print the file instead of committing it
//   --out FILE        write the file locally instead of committing it (seeding the site repository by hand)
//   --observations F  hermetic mode (tests): read GitHub from JSON
//
// Committing needs SITE_REPO_TOKEN: a fine-grained token with Contents read/write on the website
// repository only. Reading the current file needs it too, so --dry-run and --out without the token
// build from GitHub alone. SITE_REPO, SITE_BRANCH and SITE_CHANGELOG_PATH override the defaults.
// With --sha, RUN_STARTED_AT (ISO time) skips a release published before the Release run started.
// An unchanged file is never committed, so a rerun deploys nothing.
import { readFileSync, writeFileSync } from 'node:fs';
import { REPO, hermeticWorld, liveWorld, notesFor, options, releases, resolveRelease } from './release-notes.mjs';

const SITE_REPO = process.env.SITE_REPO || 'Terum-Inc/Terum-Website';
const SITE_BRANCH = process.env.SITE_BRANCH || 'main';
const SITE_PATH = process.env.SITE_CHANGELOG_PATH || 'changelog.json';
const opts = options(process.argv.slice(2));
const token = process.env.SITE_REPO_TOKEN;
const local = opts.dryRun || Boolean(opts.out);
if (!local && !token) {
  process.stderr.write('SITE_REPO_TOKEN is not set. Add it as a repository secret, or pass --dry-run or --out FILE.\n');
  process.exit(2);
}

const observations = opts.observations ? JSON.parse(readFileSync(opts.observations, 'utf8')) : null;
const github = observations ? hermeticWorld(observations) : liveWorld();
// The website repository is read and written with its own token; without one (a local dry run) the
// current file is unknown and the output holds whatever this run built.
const site = observations ? github : token ? liveWorld({ GH_TOKEN: token }) : null;

const render = file => `${JSON.stringify(file, null, 2)}\n`;
const same = (a, b) => JSON.stringify(a.releases) === JSON.stringify(b.releases);

try {
  const all = await releases(github);
  let target = null;
  if (!opts.all) {
    const resolved = await resolveRelease(all, opts, github);
    if (resolved.skip) {
      process.stderr.write(`${resolved.skip}; nothing published.\n`);
      process.exit(0);
    }
    target = resolved.release.tagName;
  }

  const current = site ? await site.readFile(SITE_REPO, SITE_PATH, SITE_BRANCH) : null;
  let existing = { releases: [] };
  if (current) {
    try { existing = JSON.parse(current.text); } catch { existing = { releases: [] }; }
    if (!Array.isArray(existing.releases)) existing = { releases: [] };
  }
  const known = new Map(existing.releases.map(entry => [entry.tag, entry]));

  // Rebuild the target and anything the file lacks; everything with --all. Entries for releases that
  // GitHub no longer lists are dropped.
  const built = [];
  for (const release of all) {
    const rebuild = opts.all || release.tagName === target || !known.has(release.tagName);
    built.push(rebuild ? await notesFor(release, all, github) : known.get(release.tagName));
  }
  const file = { repo: REPO, generatedAt: new Date().toISOString(), releases: built };
  const rebuilt = built.filter((entry, i) => entry !== known.get(all[i].tagName)).map(entry => entry.tag);

  if (opts.dryRun) {
    process.stdout.write(render(file));
    process.exit(0);
  }
  if (opts.out) {
    writeFileSync(opts.out, render(file));
    process.stderr.write(`Wrote ${opts.out}: ${built.length} releases (${rebuilt.length} rebuilt).\n`);
    process.exit(0);
  }
  if (current && same(existing, file)) {
    process.stderr.write(`${SITE_REPO}:${SITE_PATH} already carries these ${built.length} releases; unchanged, nothing committed.\n`);
    process.exit(0);
  }
  const subject = target ?? (rebuilt[0] ?? 'rebuild');
  const result = await site.writeFile(SITE_REPO, SITE_PATH, SITE_BRANCH, {
    text: render(file),
    message: `changelog: ${subject}${rebuilt.length > 1 ? ` (+${rebuilt.length - 1} more)` : ''}`,
    sha: current?.sha,
  });
  process.stderr.write(`Published ${rebuilt.join(', ') || 'no change'} to ${SITE_REPO}:${SITE_PATH}${result.url ? ` (${result.url})` : ''}.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}

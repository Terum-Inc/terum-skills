// What one terum-skills release shipped, written for users: the shared model behind the Discord
// announcement (scripts/release-announcement.mjs) and the website changelog
// (scripts/site-changelog.mjs). This module builds the notes; the two scripts only format and send them.
//
// A pull request belongs to a release when its merge commit lies between the previous stable tag
// and this one, so the list agrees with GitHub's generated release notes. Only changes users can
// notice are announced: `feat` is new, `fix` and untyped titles are fixes, a `type!:` title or a
// BREAKING CHANGE note is breaking; docs, CI, tests and other upkeep are listed but not announced.
//
// Everything the model reads comes through a "world": `liveWorld()` shells out to `gh` (no shell,
// an argument array, so nothing in a title is ever interpreted), `hermeticWorld(observations)` answers
// from a JSON fixture so the scripts can be tested without a network, the way release-plan.mjs does.
import { execFile } from 'node:child_process';

// execFile with an argument array and an optional stdin; promisify(execFile) cannot feed stdin.
function run(file, args, { env, input }) {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { maxBuffer: 64 * 1024 * 1024, env }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve(stdout);
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

export const REPO = 'Terum-Inc/terum-skills';
export const SEMVER = /^v(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;
const DAY = 24 * 60 * 60 * 1000;
const PULL_FIELDS = 'number,title,body,mergedAt,url,headRefName,mergeCommit,author';

const parts = tag => SEMVER.exec(tag).slice(1, 4).map(Number);
/** Semantic-version order of two `v<x.y.z>` tags; negative when `a` is older. */
export function compareTags(a, b) {
  const [x, y] = [parts(a), parts(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export class GhError extends Error {
  constructor(args, detail) {
    super(`gh ${args.join(' ')} failed: ${detail}\nThis script needs the GitHub CLI logged in (or GH_TOKEN set).`);
    this.name = 'GhError';
  }
}

/** A world that reads GitHub through `gh`. `env` overrides the process environment (a GH_TOKEN for another repository). */
export function liveWorld(env = {}) {
  async function gh(args, { input } = {}) {
    try {
      return await run('gh', args, { env: { ...process.env, ...env }, input });
    } catch (error) {
      const detail = error instanceof Error ? `${error.message}${error.stderr ? `\n${String(error.stderr).trim()}` : ''}` : String(error);
      throw new GhError(args, detail);
    }
  }
  return {
    async listReleases() {
      return JSON.parse(await gh(['release', 'list', '--repo', REPO, '--limit', '200', '--json', 'tagName,publishedAt,isPrerelease']));
    },
    async tagCommit(tag) {
      return (await gh(['api', `repos/${REPO}/commits/${tag}`, '--jq', '.sha'])).trim();
    },
    // The commits a range adds, from GitHub's compare view (up to 250, far more than a release holds).
    async compareCommits(base, head) {
      const shas = await gh(['api', `repos/${REPO}/compare/${base}...${head}`, '--jq', '.commits[].sha']);
      return shas.split('\n').filter(Boolean);
    },
    async mergedPulls(since) {
      return JSON.parse(await gh(['pr', 'list', '--repo', REPO, '--state', 'merged', '--limit', '500',
        '--search', `merged:>=${since}`, '--json', PULL_FIELDS]));
    },
    // A file in another repository, or null when it does not exist yet.
    async readFile(repo, path, branch) {
      try {
        const file = JSON.parse(await gh(['api', `repos/${repo}/contents/${path}?ref=${branch}`]));
        return { sha: file.sha, text: Buffer.from(file.content, 'base64').toString('utf8') };
      } catch (error) {
        if (error instanceof GhError && /HTTP 404/.test(error.message)) return null;
        throw error;
      }
    },
    async writeFile(repo, path, branch, { text, message, sha }) {
      const body = { message, branch, content: Buffer.from(text, 'utf8').toString('base64'), ...(sha ? { sha } : {}) };
      const result = JSON.parse(await gh(['api', '-X', 'PUT', `repos/${repo}/contents/${path}`, '--input', '-'], { input: JSON.stringify(body) }));
      return { sha: result.commit?.sha ?? null, url: result.commit?.html_url ?? null };
    },
  };
}

/** A world that answers from a fixture: { releases, tagCommits, compare, pulls, files, writes }. */
export function hermeticWorld(observations) {
  const obs = observations;
  obs.writes ??= [];
  return {
    async listReleases() { return obs.releases ?? []; },
    async tagCommit(tag) {
      const sha = obs.tagCommits?.[tag];
      if (!sha) throw new GhError(['api', `repos/${REPO}/commits/${tag}`], 'HTTP 404: Not Found');
      return sha;
    },
    async compareCommits(base, head) { return obs.compare?.[`${base}...${head}`] ?? []; },
    async mergedPulls(since) { return (obs.pulls ?? []).filter(pull => pull.mergedAt.slice(0, 10) >= since); },
    async readFile(repo, path) { return obs.files?.[`${repo}/${path}`] ?? null; },
    async writeFile(repo, path, branch, change) {
      obs.writes.push({ repo, path, branch, ...change });
      return { sha: 'fixture', url: null };
    },
  };
}

/** Every `v<x.y.z>` release, newest first by publish time. */
export async function releases(world) {
  return (await world.listReleases())
    .filter(release => SEMVER.test(release.tagName))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

/**
 * Which release a script is about. Returns { release } or { skip: reason } (nothing to do, exit 0);
 * throws when a named tag has no release.
 *   tag           announce this release
 *   sha           the release tagged at that commit, if the Release run that just finished made one
 *   runStartedAt  with sha: skip a release published before the run started (a recovery run)
 */
export async function resolveRelease(all, { tag, sha, runStartedAt } = {}, world) {
  if (tag) {
    const release = all.find(r => r.tagName === tag);
    if (!release) throw new Error(`No GitHub Release is tagged ${tag}.`);
    return { release };
  }
  if (sha) {
    // The Release run that just finished made at most one release; it is among the newest.
    for (const candidate of all.slice(0, 5)) {
      if (await world.tagCommit(candidate.tagName) !== sha) continue;
      const startedAt = runStartedAt ? new Date(runStartedAt) : null;
      if (startedAt && new Date(candidate.publishedAt) < startedAt) {
        return { skip: `${candidate.tagName} was published before this Release run started; already announced` };
      }
      return { release: candidate };
    }
    return { skip: `No release for this run (nothing is tagged at ${sha})` };
  }
  if (!all[0]) return { skip: 'This repository has no releases yet' };
  return { release: all[0] };
}

/** The previous stable release below this one, by version, or null. */
export function previousStable(all, release) {
  return all
    .filter(r => !r.isPrerelease && compareTags(r.tagName, release.tagName) < 0)
    .map(r => r.tagName)
    .sort(compareTags)
    .at(-1) ?? null;
}

// What each pull request contributes. Only changes users can notice are announced:
// docs, CI, tests and other upkeep are left out of the sections.
const TITLE = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;
const INTERNAL = new Set(['docs', 'chore', 'ci', 'test', 'refactor', 'build', 'perf', 'style']);
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);
export function classify(pull) {
  const match = TITLE.exec(pull.title);
  const type = match?.[1].toLowerCase() ?? null;
  const scope = match?.[2] ?? null;
  const breaking = Boolean(match?.[3]) || /BREAKING[ -]CHANGE/.test(pull.body ?? '');
  const section = breaking ? 'breaking' : type === 'feat' ? 'new' : INTERNAL.has(type) ? null : 'fixes';
  // Drop the type(scope) prefix and internal references: a milestone tag ("M1.1 — ") in front,
  // a spec section or split marker ("(IE6 §3.1)", "(piece 1 of 2)") at the end.
  let text = (match ? match[4] : pull.title).trim()
    .replace(/^M\d+(?:\.\d+)*\s*[—–-]\s*/, '')
    .replace(/\s*\((?:[^()]*§[^()]*|piece \d+ of \d+)\)\s*$/i, '');
  text = capitalize(text);
  if (!/[.!?]$/.test(text)) text += '.';
  return { section, text, type, scope };
}

export const SECTIONS = ['breaking', 'new', 'fixes'];

// Markdown reduced to the words: links keep their text, emphasis and code marks go, images and tags go.
const inline = s => s
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/(\*\*|__)(.*?)\1/g, '$2')
  .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:]|$)/g, '$1$2')
  .replace(/`([^`]*)`/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim();
// Where a pull request stops describing the change and starts talking to its reviewer.
const STOP = /^#{1,6}\s*(?:test(?:ing|s)?(?:\s+plan)?|gates?|verification|checklist|how to (?:test|verify)|dispatch|after (?:merge|merging)|why this is a pr|rollout|screenshots?)\b/i;

/**
 * What a pull request says about itself, as blocks the website can lay out: the description from its body up to
 * the test plan, as [{ type: 'h' | 'p', text }] and [{ type: 'list', items }], at most eight blocks and about
 * 1,400 characters. Code fences, images, check-box lists and the "generated with" footer are left out.
 */
export function summarize(body) {
  if (typeof body !== 'string' || !body.trim()) return [];
  const blocks = [];
  let list = null, para = [], fence = false;
  const flushPara = () => { if (para.length) { blocks.push({ type: 'p', text: inline(para.join(' ')) }); para = []; } };
  const flushList = () => { if (list?.length) blocks.push({ type: 'list', items: list }); list = null; };
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; flushPara(); flushList(); continue; }
    if (fence || /^\s*<!--/.test(line) || /generated with \[?claude code|^\s*🤖/i.test(line)) continue;
    const heading = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
    if (heading) { flushPara(); flushList(); if (STOP.test(line)) break; blocks.push({ type: 'h', text: inline(heading[1]) }); continue; }
    const item = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) { if (/^\[[ xX]\]/.test(item[1])) continue; flushPara(); (list ??= []).push(inline(item[1])); continue; }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (list) { list[list.length - 1] += ' ' + inline(line.trim()); continue; }
    para.push(line.trim().replace(/^>\s?/, ''));
  }
  flushPara(); flushList();
  const out = [];
  let chars = 0;
  for (const block of blocks) {
    if (block.type === 'list') block.items = block.items.filter(Boolean);
    const length = block.type === 'list' ? block.items.join('').length : block.text.length;
    if (!length) continue;
    if (out.length && chars + length > 1400) break;
    out.push(block); chars += length;
    if (out.length >= 8) break;
  }
  while (out.length && out[out.length - 1].type === 'h') out.pop();
  return out;
}

/**
 * The notes for one release:
 * { tag, version, publishedAt, prerelease, previous, url, compareUrl, headline,
 *   sections: { breaking: [text], new: [text], fixes: [text] },
 *   pulls: [{ number, title, text, author, url, type, scope, section, summary }] }  (oldest merge first)
 */
export async function notesFor(release, all, world) {
  const previous = previousStable(all, release);
  const previousRelease = all.find(r => r.tagName === previous);
  // Fetch a week before the previous release, so a pull request that merged just before it was tagged
  // is still considered. Membership is decided by commit, so fetching extra pull requests is harmless.
  const fetchFrom = new Date(new Date(previousRelease?.publishedAt ?? release.publishedAt).getTime() - 7 * DAY);
  const commits = new Set(previous ? await world.compareCommits(previous, release.tagName) : []);
  const merged = (await world.mergedPulls(fetchFrom.toISOString().slice(0, 10)))
    .filter(pull => pull.mergeCommit?.oid && commits.has(pull.mergeCommit.oid));
  const isReleasePull = pull => /^release\//.test(pull.headRefName) || /^(?:release|chore\(release\)):/.test(pull.title);
  const pulls = merged.filter(pull => !isReleasePull(pull)).sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));
  // A release pull request may name the release in its title: "release: 0.16.0 (Windows setup hand-off, team move)".
  // That line is the maintainers' own summary, and the website leads with it when it exists.
  const named = merged.filter(isReleasePull).map(pull => /^(?:release|chore\(release\)):\s*\S+\s*\((.+)\)\s*$/.exec(pull.title)?.[1]?.trim()).find(Boolean) ?? null;

  const sections = Object.fromEntries(SECTIONS.map(key => [key, []]));
  const listed = [];
  for (const pull of pulls) {
    const { section, text, type, scope } = classify(pull);
    if (section) sections[section].push(text);
    listed.push({ number: pull.number, title: pull.title, text, author: pull.author?.login ?? null, url: pull.url, type, scope, section, summary: summarize(pull.body) });
  }
  // The one line that stands for the release: the release pull request's own summary when its title carries one,
  // else its first breaking change, else its first feature, else its first fix.
  const headline = (named ? capitalize(named).replace(/[.!?]$/, '') + '.' : null) ?? SECTIONS.map(key => sections[key][0]).find(Boolean) ?? QUIET;
  return {
    tag: release.tagName,
    version: release.tagName.slice(1),
    publishedAt: release.publishedAt,
    prerelease: Boolean(release.isPrerelease),
    previous,
    url: `https://github.com/${REPO}/releases/tag/${release.tagName}`,
    compareUrl: previous ? `https://github.com/${REPO}/compare/${previous}...${release.tagName}` : null,
    headline,
    sections,
    pulls: listed,
  };
}

/** What a release with nothing user-facing says for itself. */
export const QUIET = 'Behind-the-scenes improvements; nothing changes in how you use the app.';

/** How many bullets the sections announce. */
export const announced = notes => SECTIONS.reduce((n, key) => n + notes.sections[key].length, 0);

/** Command-line options shared by the two scripts. */
export function options(argv) {
  const option = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  return {
    tag: option('--tag'),
    sha: option('--sha'),
    observations: option('--observations'),
    out: option('--out'),
    dryRun: argv.includes('--dry-run'),
    all: argv.includes('--all'),
    runStartedAt: process.env.RUN_STARTED_AT || undefined,
  };
}

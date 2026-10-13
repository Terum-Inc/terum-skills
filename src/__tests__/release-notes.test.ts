import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { temporaryDirectory } from '../lib/__tests__/fixtures.js';

// The two announcement scripts, run hermetically: `--observations` answers every GitHub read from a
// JSON fixture and an empty PATH proves that neither `gh` nor anything else is spawned.
const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const announcement = resolve(root, 'scripts/release-announcement.mjs');
const siteChangelog = resolve(root, 'scripts/site-changelog.mjs');
const SITE = 'Terum-Inc/Terum-Website/changelog.json';

interface Pull { number: number; title: string; body?: string; mergedAt: string; url: string; headRefName: string; mergeCommit: { oid: string } | null; author: { login: string } }
interface Observations {
  releases: { tagName: string; publishedAt: string; isPrerelease: boolean }[];
  tagCommits: Record<string, string>;
  compare: Record<string, string[]>;
  pulls: Pull[];
  files?: Record<string, { sha: string; text: string }>;
}
interface Result { code: number | string; stdout: string; stderr: string }
interface Block { type: string; text?: string; items?: string[] }
interface Notes { tag: string; previous: string | null; headline: string; sections: Record<string, string[]>; pulls: { number: number; text: string; author: string | null; type: string | null; scope: string | null; section: string | null; summary: Block[] }[] }
interface Changelog { repo: string; generatedAt: string; releases: Notes[] }

const sha = (n: number): string => n.toString(16).padStart(40, '0');
function pull(number: number, title: string, mergedAt: string, extra: Partial<Pull> = {}): Pull {
  return { number, title, mergedAt, url: `https://github.com/Terum-Inc/terum-skills/pull/${number}`, headRefName: `topic/${number}`, mergeCommit: { oid: sha(number) }, author: { login: 'teniroo' }, ...extra };
}

// v0.23.0 as GitHub recorded it: six pull requests, plus the release PR, plus an unrelated merge
// that happened in the window but is not on the compare range.
function world(): Observations {
  return {
    releases: [
      { tagName: 'v0.23.0', publishedAt: '2026-09-24T20:10:17Z', isPrerelease: false },
      { tagName: 'v0.22.0', publishedAt: '2026-09-23T00:47:01Z', isPrerelease: false },
      { tagName: 'v0.21.0', publishedAt: '2026-09-20T03:52:44Z', isPrerelease: false },
    ],
    tagCommits: { 'v0.23.0': sha(0x23), 'v0.22.0': sha(0x22), 'v0.21.0': sha(0x21) },
    compare: {
      'v0.22.0...v0.23.0': [303, 307, 304, 308, 309, 310, 311].map(sha),
      'v0.21.0...v0.22.0': [290, 291].map(sha),
    },
    pulls: [
      pull(303, 'fix(setup): a join that finished in the terminal still ends with the desktop app open', '2026-09-23T10:00:00Z'),
      pull(307, 'fix(desktop): sidebar rows and footer links respond to hover', '2026-09-23T11:00:00Z'),
      pull(304, 'feat(setup): place the eight bundled skills into the global roots without asking', '2026-09-23T12:00:00Z'),
      pull(308, 'fix(publish): check team clones out byte for byte so an unchanged republish mints nothing', '2026-09-23T13:00:00Z', { author: { login: 'ajayw36' } }),
      pull(309, 'feat(eval): run a head-to-head from the app', '2026-09-23T14:00:00Z', { author: { login: 'ajayw36' } }),
      pull(310, 'fix(desktop): make the in-app head-to-head reachable (IE6 §3.1)', '2026-09-23T15:00:00Z', { author: { login: 'ajayw36' } }),
      pull(311, 'release: 0.23.0', '2026-09-24T19:00:00Z', { headRefName: 'release/0.23.0', author: { login: 'ryanliu-terum' } }),
      pull(312, 'docs(release): dry-run a release only when release.yml changed', '2026-09-24T21:00:00Z', { mergeCommit: { oid: sha(312) } }),
      pull(290, 'docs: cut the README to a landing page', '2026-09-22T10:00:00Z'),
      pull(291, 'chore: tidy the lockfile', '2026-09-22T11:00:00Z'),
    ],
  };
}

async function invoke(script: string, obs: Observations, args: string[], env: Record<string, string> = {}): Promise<Result> {
  const cwd = await temporaryDirectory('terum-release-notes-');
  const emptyPath = resolve(cwd, 'empty-path');
  await mkdir(emptyPath);
  const observations = resolve(cwd, 'observations.json');
  await writeFile(observations, JSON.stringify(obs));
  return run(process.execPath, [script, ...args, '--observations', observations], {
    cwd,
    env: { PATH: emptyPath + delimiter + dirname(process.execPath), NODE_NO_WARNINGS: '1', ...env },
  }).then(
    (result) => ({ ...result, code: 0 }),
    (error: { code?: number | string; stdout: string; stderr: string }) => ({ code: error.code ?? 1, stdout: error.stdout, stderr: error.stderr }),
  );
}

const description = (result: Result): string => (JSON.parse(result.stdout) as { embeds: { description: string }[] }).embeds[0]?.description ?? '';

describe('release-announcement (Discord, hermetic)', () => {
  it('announces the latest release with its new features and fixes', async () => {
    const result = await invoke(announcement, world(), ['--dry-run']);
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    const text = description(result);
    expect(text).toBe([
      '## Terum v0.23.0 is out for Mac and Windows!',
      '-# Update from inside the app to get it.',
      '',
      '### ◇ New',
      '- Place the eight bundled skills into the global roots without asking.',
      '- Run a head-to-head from the app.',
      '',
      '### ◈ Fixes and improvements',
      '- A join that finished in the terminal still ends with the desktop app open.',
      '- Sidebar rows and footer links respond to hover.',
      '- Check team clones out byte for byte so an unchanged republish mints nothing.',
      '- Make the in-app head-to-head reachable.',
      '',
      'Based on v0.22.0 · [Full release notes](https://github.com/Terum-Inc/terum-skills/releases/tag/v0.23.0) · [Changelog](https://www.terum.ai/changelog#v0.23.0)',
    ].join('\n'));
    const payload = JSON.parse(result.stdout) as { content: string; username: string; embeds: { timestamp: string }[] };
    expect(payload.content).toBe('@everyone');
    expect(payload.username).toBe('terum-skills changelog');
    expect(payload.embeds[0]?.timestamp).toBe('2026-09-24T20:10:17Z');
  });

  it('says so when a release has only behind-the-scenes changes', async () => {
    const result = await invoke(announcement, world(), ['--dry-run', '--tag', 'v0.22.0']);
    expect(result.code).toBe(0);
    expect(description(result)).toContain('Behind-the-scenes improvements; nothing changes in how you use the app.');
    expect(description(result)).toContain('Based on v0.21.0');
  });

  it('posts nothing for a commit that no release is tagged at (a dry run of release.yml)', async () => {
    const result = await invoke(announcement, world(), ['--dry-run', '--sha', sha(0x99)]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('nothing is tagged at');
  });

  it('posts nothing for a release published before the run started (a recovery run)', async () => {
    const result = await invoke(announcement, world(), ['--dry-run', '--sha', sha(0x23)], { RUN_STARTED_AT: '2026-09-25T00:00:00Z' });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('already announced');
  });

  it('refuses a tag with no release, and refuses to post without a webhook', async () => {
    const missing = await invoke(announcement, world(), ['--dry-run', '--tag', 'v9.9.9']);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain('No GitHub Release is tagged v9.9.9');
    const noWebhook = await invoke(announcement, world(), []);
    expect(noWebhook.code).toBe(2);
    expect(noWebhook.stderr).toContain('DISCORD_WEBHOOK_URL is not set');
  });

  it('marks breaking changes and strips milestone and spec references from titles', async () => {
    const obs = world();
    obs.pulls.push(
      pull(320, 'feat(cli)!: M2 — drop the legacy config format', '2026-09-23T16:00:00Z'),
      pull(321, 'tidy the receipt (piece 1 of 2)', '2026-09-23T17:00:00Z', { body: 'Notes\n\nBREAKING CHANGE: receipts move.' }),
    );
    obs.compare['v0.22.0...v0.23.0'] = [...(obs.compare['v0.22.0...v0.23.0'] ?? []), sha(320), sha(321)];
    const text = description(await invoke(announcement, obs, ['--dry-run']));
    expect(text).toContain('### ◆ Breaking changes\n- Drop the legacy config format.\n- Tidy the receipt.\n\n### ◇ New');
  });
});

describe('site-changelog (website changelog.json, hermetic)', () => {
  it('builds every release the file lacks, newest first, with sections and merged pull requests', async () => {
    const result = await invoke(siteChangelog, world(), ['--dry-run']);
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    const file = JSON.parse(result.stdout) as Changelog;
    expect(file.repo).toBe('Terum-Inc/terum-skills');
    expect(file.releases.map(r => r.tag)).toEqual(['v0.23.0', 'v0.22.0', 'v0.21.0']);
    const [latest, previous] = file.releases as [Notes, Notes];
    expect(latest.previous).toBe('v0.22.0');
    expect(latest.headline).toBe('Place the eight bundled skills into the global roots without asking.');
    expect(previous.headline).toBe('Behind-the-scenes improvements; nothing changes in how you use the app.');
    expect(latest.sections.new).toHaveLength(2);
    expect(latest.sections.fixes).toHaveLength(4);
    expect(latest.sections.breaking).toHaveLength(0);
    expect(latest.pulls.map(p => p.number)).toEqual([303, 307, 304, 308, 309, 310]);
    expect(latest.pulls[3]).toMatchObject({ number: 308, author: 'ajayw36', type: 'fix', section: 'fixes' });
    expect(previous.sections).toEqual({ breaking: [], new: [], fixes: [] });
    expect(previous.pulls.map(p => p.number)).toEqual([290, 291]);
    expect(previous.pulls[0]).toMatchObject({ type: 'docs', section: null });
    // a release pull request that names the release in its title gives the website its headline
    const named = world();
    named.pulls.push(pull(292, 'release: 0.22.0 (the README as a landing page, and a tidier lockfile)', '2026-09-22T20:00:00Z', { headRefName: 'release/0.22.0' }));
    named.compare['v0.21.0...v0.22.0'] = [...(named.compare['v0.21.0...v0.22.0'] ?? []), sha(292)];
    const renamed = JSON.parse((await invoke(siteChangelog, named, ['--dry-run'])).stdout) as Changelog;
    expect(renamed.releases[1]?.headline).toBe('The README as a landing page, and a tidier lockfile.');
    expect(renamed.releases[1]?.pulls.map(p => p.number)).toEqual([290, 291]);
    expect(latest.pulls[0]).toMatchObject({ number: 303, text: 'A join that finished in the terminal still ends with the desktop app open.', scope: 'setup', summary: [] });
  });

  it('carries each pull request\'s description as blocks, up to its test plan', async () => {
    const obs = world();
    const described = obs.pulls.find(p => p.number === 304)!;
    described.body = [
      '## What this adds', '',
      'Setup places the **eight bundled skills** into the global roots, see [the spec](https://example.com/spec).', '',
      'It asks nothing:', '',
      '- `terum-skills setup` writes them', '- a second run leaves them alone', '',
      '```sh', 'npx -y terum-skills@latest setup', '```', '',
      '## Test plan', '', '- [x] ran setup twice', '',
      '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
    ].join('\n');
    const file = JSON.parse((await invoke(siteChangelog, obs, ['--dry-run'])).stdout) as Changelog;
    const pull = file.releases[0]?.pulls.find(p => p.number === 304);
    expect(pull?.summary).toEqual([
      { type: 'h', text: 'What this adds' },
      { type: 'p', text: 'Setup places the eight bundled skills into the global roots, see the spec.' },
      { type: 'p', text: 'It asks nothing:' },
      { type: 'list', items: ['terum-skills setup writes them', 'a second run leaves them alone'] },
    ]);
  });

  it('writes the file locally with --out', async () => {
    const cwd = await temporaryDirectory('terum-site-changelog-out-');
    const out = resolve(cwd, 'changelog.json');
    const result = await invoke(siteChangelog, world(), ['--out', out, '--all']);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain('3 releases (3 rebuilt)');
    const file = JSON.parse(await readFile(out, 'utf8')) as Changelog;
    expect(file.releases).toHaveLength(3);
  });

  it('keeps entries already on the site and rebuilds only the target', async () => {
    const obs = world();
    const kept = { tag: 'v0.22.0', version: '0.22.0', note: 'as the site had it' };
    obs.files = { [SITE]: { sha: 'abc', text: JSON.stringify({ repo: 'x', releases: [kept, { tag: 'v0.21.0', stale: true }] }) } };
    const result = await invoke(siteChangelog, obs, ['--dry-run', '--tag', 'v0.21.0']);
    expect(result.code).toBe(0);
    const file = JSON.parse(result.stdout) as { releases: Record<string, unknown>[] };
    expect(file.releases[0]).toHaveProperty('sections');      // v0.23.0 was missing: built
    expect(file.releases[1]).toEqual(kept);                    // v0.22.0 was present: kept as is
    expect(file.releases[2]).not.toHaveProperty('stale');      // v0.21.0 was the target: rebuilt
  });

  it('commits nothing when the site already carries what it built', async () => {
    const built = JSON.parse((await invoke(siteChangelog, world(), ['--dry-run', '--all'])).stdout) as Changelog;
    const obs = world();
    obs.files = { [SITE]: { sha: 'abc', text: JSON.stringify({ ...built, generatedAt: 'earlier' }) } };
    const result = await invoke(siteChangelog, obs, [], { SITE_REPO_TOKEN: 'fixture' });
    expect(result.code).toBe(0);
    expect(result.stderr).toContain('unchanged, nothing committed');
  });

  it('refuses to commit without a token, and does nothing for an untagged commit', async () => {
    const noToken = await invoke(siteChangelog, world(), []);
    expect(noToken.code).toBe(2);
    expect(noToken.stderr).toContain('SITE_REPO_TOKEN is not set');
    const untagged = await invoke(siteChangelog, world(), ['--dry-run', '--sha', sha(0x99)]);
    expect(untagged.code).toBe(0);
    expect(untagged.stdout).toBe('');
    expect(untagged.stderr).toContain('nothing published');
  });
});

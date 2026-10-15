import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GuardError } from '../guard.js';
import { Runner, systemRunner } from '../runner.js';
import { packageVersion } from '../package.js';
import { skillVersions, describeClone, cloneOrigin, assertSafePath, CloneBusy, cloneTeam, localPushGuardLauncher, openTeamRepo, pushGuardHook, PushRefused, pinCheckoutBytes, refreshClone, SafeWriteExhausted, VERBATIM_ATTRIBUTES, shellQuote, treeText, withCloneLock, cloneLockPath, lockWait } from '../teamRepo.js';
import { bareTeam, cloneWithIdentity, holdCloneLock, mappedRunner, git, originSha, person, pushFromSeed, SYMLINKS_SUPPORTED, temporaryDirectory, wrapRunner } from './fixtures.js';

const exists = (path: string) => access(path).then(() => true, () => false);
const personJson = (handle: string) => `${JSON.stringify(person(handle))}\n`;

describe('pinCheckoutBytes', () => {
  it('rewrites a clone git converted to CRLF with its committed bytes, keeps other attribute lines, and is one read after that', async () => {
    const fixture = await bareTeam();
    const clone = join(fixture.root, 'windows');
    // Git for Windows' default, forced through the environment (the highest config level) for the clone and the pin alike.
    const env = { ...process.env, GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_1: 'core.autocrlf', GIT_CONFIG_VALUE_1: 'true' };
    await git(['clone', '-q', '--branch', 'main', fixture.bare, clone], undefined, env);
    expect(await readFile(join(clone, 'team.json'), 'utf8')).toContain('\r\n');
    await writeFile(join(clone, '.git', 'info', 'attributes'), '*.png binary');
    await pinCheckoutBytes(clone, systemRunner, env);
    expect(await readFile(join(clone, 'team.json'), 'utf8')).toBe(await git(['show', 'main:team.json'], fixture.bare));
    expect(await readFile(join(clone, '.git', 'info', 'attributes'), 'utf8')).toBe(`*.png binary\n${VERBATIM_ATTRIBUTES}\n`);
    expect(await git(['status', '--porcelain'], clone, env)).toBe('');
    const gitCalls: string[][] = [];
    await pinCheckoutBytes(clone, wrapRunner(systemRunner, (command, args, _options, next) => { gitCalls.push([...args]); return next(); }), env);
    expect(gitCalls).toEqual([]);
  });
});

describe('safeWrite (§6.0)', () => {
  it('regenerates README only for generic remotes before the push', async () => {
    const fixture = await bareTeam();
    const generic = await cloneWithIdentity(fixture.bare, join(fixture.root, 'generic'));
    let genericStaged = '';
    const genericRunner = wrapRunner(systemRunner, async (command, args, _options, next) => {
      if (command === 'git' && args[0] === 'push') genericStaged = await git(['show', '--name-only', '--format=', 'HEAD'], generic);
      return next();
    });
    await openTeamRepo(generic, fixture.bare, genericRunner).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' });
    expect(await readFile(join(generic, 'README.md'), 'utf8')).toContain('<!-- terum-skills:begin -->');
    expect(genericStaged).toContain('README.md');
    const githubFixture = await bareTeam();
    const github = await cloneWithIdentity(githubFixture.bare, join(githubFixture.root, 'github'));
    const publicRemote = 'https://github.com/acme/team.git';
    await git(['remote', 'set-url', 'origin', publicRemote], github);
    let githubStaged = '';
    const runner = wrapRunner(systemRunner, async (command, args, options, next) => {
      if (command === 'git' && args[0] === 'fetch') return { code: 0, stdout: '', stderr: '' };
      if (command === 'git' && args[0] === 'remote' && args[1] === 'get-url') return { code: 0, stdout: `${publicRemote}\n`, stderr: '' };
      if (command === 'git' && args[0] === 'push') { githubStaged = await git(['show', '--name-only', '--format=', 'HEAD'], github); return { code: 1, stdout: '', stderr: 'remote: Permission denied' }; }
      return next();
    });
    await expect(openTeamRepo(github, publicRemote, runner).safeWrite((tree) => tree.set('people/github.json', personJson('github')), { action: 'join', handle: 'github' })).rejects.toThrow(PushRefused);
    expect(githubStaged).not.toContain('README.md');
    expect(await exists(join(github, 'README.md'))).toBe(false);
  });

  it('derives every generic-remote README version from the written tree, spawning no ls-tree at all', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    let lsTrees = 0;
    const runner = wrapRunner(systemRunner, async (command, args, _options, next) => {
      if (command === 'git' && args[0] === 'ls-tree') lsTrees++;
      return next();
    });
    const skill = '---\nname: new\ndescription: New\nlicense: UNLICENSED\nmetadata:\n  id: 55555555-5555-4555-8555-555555555555\n  author: Me <me@example.com>\n  terum-category: docs\n---\n';
    await openTeamRepo(clone, fixture.bare, runner).safeWrite((tree) => tree.set('skills/new/v1/SKILL.md', skill), { action: 'publish', handle: 'me' });
    await git(['fetch', '-q', 'origin'], fixture.seed);
    await git(['reset', '-q', '--hard', 'origin/main'], fixture.seed);
    // D1: the Latest column is the version LABEL, never a tree hash — and `versionsInTree` reads it
    // straight out of the post-image, so the README costs no process at all.
    expect(await readFile(join(fixture.seed, 'README.md'), 'utf8')).toContain('| new | docs | New | 0 | — | Version 1 |');
    expect(lsTrees).toBe(0);
  });

  it('omits a removed tracked person from the regenerated generic-remote README', async () => {
    const fixture = await bareTeam();
    await pushFromSeed(fixture.seed, 'people/me.json', personJson('me'));
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.remove('people/me.json'), { action: 'join', handle: 'me' });
    expect(await readFile(join(clone, 'README.md'), 'utf8')).not.toContain('- @me — me');
  });
  // D69: on a half-migrated generic-remote repo the write still lands, README.md stays out of its
  // commit byte-for-byte, and the reason reaches the caller through `onReadmeRefusal`.
  it('commits a generic-remote write without README.md when a versionless skill folder refuses the regeneration, and tells the caller why', async () => {
    const fixture = await bareTeam();
    const skill = (name: string, id: string) => `---\nname: ${name}\ndescription: ${name}\nlicense: UNLICENSED\nmetadata:\n  id: ${id}\n  author: Me <me@example.com>\n  terum-category: docs\n---\n`;
    await pushFromSeed(fixture.seed, 'skills/a/v1/SKILL.md', skill('a', '66666666-6666-4666-8666-666666666666'));
    await pushFromSeed(fixture.seed, 'skills/legacy/SKILL.md', skill('legacy', '77777777-7777-4777-8777-777777777777'));
    const readme = '# team\n\n<!-- terum-skills:begin -->\n| Skill | Owner |\n| --- | --- |\n| a | me |\n| legacy | me |\n<!-- terum-skills:end -->\n';
    await pushFromSeed(fixture.seed, 'README.md', readme);
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const refusals: string[] = [];
    const result = await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me', onReadmeRefusal: (reason) => refusals.push(reason) });
    expect(result.changed).toBe(true);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toMatch(/README\.md left unchanged: skills\/legacy has no v<N>\/SKILL\.md/);
    expect(await git(['show', '--name-only', '--format=', 'HEAD'], clone)).toBe('people/me.json\n');
    expect(await readFile(join(clone, 'README.md'), 'utf8')).toBe(readme);
  });
  it('lands eight barrier-released writers within the deadline and leaves every clone clean', async () => {
    const fixture = await bareTeam();
    const clones = await Promise.all(Array.from({ length: 8 }, (_, index) => cloneWithIdentity(fixture.bare, join(fixture.root, `clone-${index}`), `User ${index}`, `u${index}@example.com`)));
    let release!: () => void;
    const barrier = new Promise<void>((done) => { release = done; });
    const writers = clones.map(async (clone, index) => {
      await barrier;
      return openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set(`people/u${index}.json`, personJson(`u${index}`)), { action: 'join', handle: `u${index}` });
    });
    release();
    const results = await Promise.all(writers);
    expect(results.every((result) => result.changed && result.pushedTo === 'main')).toBe(true);
    for (const clone of clones) expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
    await git(['fetch', '-q', 'origin'], fixture.seed);
    await git(['reset', '-q', '--hard', 'origin/main'], fixture.seed);
    for (let index = 0; index < 8; index++) expect(await readFile(join(fixture.seed, 'people', `u${index}.json`), 'utf8')).toContain(`"handle":"u${index}"`);
  });

  it('replays a pure mutation on rejection without minting a second value', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    let pushes = 0;
    let executions = 0;
    const runner: Runner = { run(command, args, options) { if (command === 'git' && args[0] === 'push' && pushes++ === 0) return Promise.resolve({ code: 1, stdout: '', stderr: ' ! [rejected]        HEAD -> main (fetch first)\nerror: failed to push some refs' }); return systemRunner.run(command, args, options); } };
    const id = '4e80fd2a-04bc-4d9f-88f7-a849d92879f1';
    await openTeamRepo(clone, fixture.bare, runner).safeWrite((tree) => { executions++; tree.set('people/me.json', personJson('me').replace('{', `{"id":"${id}",`)); }, { action: 'join', handle: 'me', deadlineMs: 5_000 });
    expect(executions).toBe(2);
    await git(['fetch', '-q', 'origin'], fixture.seed);
    await git(['reset', '-q', '--hard', 'origin/main'], fixture.seed);
    expect(await readFile(join(fixture.seed, 'people', 'me.json'), 'utf8')).toContain(id);
  });

  it('deadline exhaustion resets to origin/main, removes what it created, and fails loudly', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    let clock = 0;
    const rejecting: Runner = { run(command, args, options) { if (command === 'git' && args[0] === 'push') return Promise.resolve({ code: 1, stdout: '', stderr: ' ! [rejected]        HEAD -> main (non-fast-forward)' }); return systemRunner.run(command, args, options); } };
    await expect(openTeamRepo(clone, fixture.bare, rejecting).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me', deadlineMs: 1, now: () => clock, sleep: async () => { clock = 2; } })).rejects.toThrow(SafeWriteExhausted);
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
    expect((await git(['rev-parse', 'HEAD'], clone)).trim()).toBe((await git(['rev-parse', 'origin/main'], clone)).trim());
    expect(await exists(join(clone, 'people', 'me.json'))).toBe(false);
  });

  it('a guard rejection pushes nothing, leaves the clone clean, and removes the folder it created', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const before = await originSha(fixture.bare);
    await expect(openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('skills/new/v1/SKILL.md', '---\nname: new\n---\n'), { action: 'join', handle: 'me' })).rejects.toThrow(GuardError);
    expect(await originSha(fixture.bare)).toBe(before);
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
    expect(await exists(join(clone, 'skills', 'new', 'v1'))).toBe(false);
  });

  it('stages only the mutation: an untracked file in the clone is neither pushed nor deleted', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    await writeFile(join(clone, 'junk.txt'), 'stray');
    await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' });
    expect(await readFile(join(clone, 'junk.txt'), 'utf8')).toBe('stray');
    expect((await git(['ls-tree', '--name-only', 'main'], fixture.bare))).not.toContain('junk.txt');
    expect((await git(['ls-tree', '--name-only', 'main:people'], fixture.bare))).toContain('me.json');
  });

  it('a permission or protection refusal fails fast with git\'s own message, never a 30 s retry loop', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    let pushes = 0;
    const denied: Runner = { run(command, args, options) { if (command === 'git' && args[0] === 'push') { pushes++; return Promise.resolve({ code: 1, stdout: '', stderr: 'remote: Permission to acme/skills.git denied to bob.\nfatal: unable to access' }); } return systemRunner.run(command, args, options); } };
    await expect(openTeamRepo(clone, fixture.bare, denied).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' })).rejects.toThrow(PushRefused);
    await expect(openTeamRepo(clone, fixture.bare, denied).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' })).rejects.toThrow(/Permission to acme\/skills\.git denied/);
    expect(pushes).toBe(2);
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
    // §4.1 collapsed the push onto main, so a protected main is the only protected branch there is.
    const protectedMain: Runner = { run(command, args, options) { if (command === 'git' && args[0] === 'push') return Promise.resolve({ code: 1, stdout: '', stderr: ' ! [remote rejected] HEAD -> main (protected branch hook declined)' }); return systemRunner.run(command, args, options); } };
    await expect(openTeamRepo(clone, fixture.bare, protectedMain).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' })).rejects.toThrow(/protected branch hook declined/);
    expect((await git(['branch', '--list'], fixture.bare)).trim()).toBe('* main');
  });

  it('refuses unsafe paths inside the mutation and refuses a clone that points at a different remote', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    for (const bad of ['../escape.json', '/etc/passwd', '.git/config', '.Git/config', '.GIT/hooks/pre-commit', 'skills/x/v1/.git/config', 'skills/x/v1/GIT~1/config', 'people/../team.json', 'a/./b', 'a//b', 'people\\me.json', 'people/', '']) expect(() => assertSafePath(bad), bad).toThrow(GuardError);
    for (const good of ['people/me.json', 'skills/x/v1/SKILL.md', 'skills/x/v1/.gitkeep', 'team.json']) expect(() => assertSafePath(good), good).not.toThrow();
    await expect(openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('../escape.json', '{}'), { action: 'join', handle: 'me' })).rejects.toThrow(GuardError);
    let mutated = false;
    await expect(openTeamRepo(clone, 'https://github.com/someone/else.git').safeWrite(() => { mutated = true; }, { action: 'join', handle: 'me' })).rejects.toThrow('wrong repository');
    expect(mutated).toBe(false);
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
  });

  it('a refused path never reaches the working tree, and a .Git spelling cannot touch the clone\'s git config', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const configBefore = await readFile(join(clone, '.git', 'config'), 'utf8');
    await expect(openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('.Git/config', '[core]\n'), { action: 'join', handle: 'me' })).rejects.toThrow(GuardError);
    expect(await readFile(join(clone, '.git', 'config'), 'utf8')).toBe(configBefore);
    await expect(openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('skills/new/v1/SKILL.md', 'x'), { action: 'join', handle: 'me' })).rejects.toThrow(GuardError);
    expect(await exists(join(clone, 'skills', 'new', 'v1'))).toBe(false);
  });

  it.skipIf(!SYMLINKS_SUPPORTED)('never writes or deletes through a symlinked parent that leaves the clone', async () => {
    const fixture = await bareTeam();
    const outside = await temporaryDirectory();
    await writeFile(join(outside, 'me.json'), 'precious');
    // The team repo commits `people` as a symlink pointing outside any clone.
    await git(['rm', '-r', '-q', 'people'], fixture.seed);
    await symlink(outside, join(fixture.seed, 'people'));
    await git(['add', '--all'], fixture.seed);
    await git(['commit', '-q', '-m', 'symlink'], fixture.seed);
    await git(['push', '-q', 'origin', 'HEAD:main'], fixture.seed);
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    await expect(openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' })).rejects.toThrow(/outside the clone|symlink/);
    expect(await readFile(join(outside, 'me.json'), 'utf8')).toBe('precious');
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
  });

  it('serializes two writers on the same clone and lands both', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const repo = openTeamRepo(clone, fixture.bare);
    await Promise.all(['a', 'b'].map((handle) => repo.safeWrite((tree) => tree.set(`people/${handle}.json`, personJson(handle)), { action: 'join', handle })));
    expect((await git(['ls-tree', '--name-only', 'main:people'], fixture.bare)).split('\n')).toEqual(expect.arrayContaining(['a.json', 'b.json']));
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
  });

  it('permits the archive-only roster mutation and uses the handle-prefixed commit message', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'), 'Admin', 'admin@example.com');
    await openTeamRepo(clone, fixture.bare).safeWrite((tree) => {
      const team = JSON.parse(treeText(tree.after('team.json')!));
      team.archived.push('seed');
      tree.set('team.json', `${JSON.stringify(team)}\n`);
    }, { action: 'team-remove', handle: 'admin', targetHandle: 'seed' });
    expect(JSON.parse(await git(['show', 'main:team.json'], fixture.bare)).archived).toEqual(['seed']);
    expect((await git(['log', '-1', '--format=%s', 'main'], fixture.bare)).trim()).toBe('admin: team-remove');
  });

  it('§4.1: every write lands on main and the remote grows no other branch', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const result = await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' });
    expect(result.pushedTo).toBe('main');
    expect(await git(['ls-tree', '--name-only', 'main:people'], fixture.bare)).toContain('me.json');
    expect((await git(['branch', '--list'], fixture.bare)).trim()).toBe('* main');
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
  });

  it('a mutation that sees the fresh tree can react to a concurrent change', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    let pushes = 0;
    const racing = wrapRunner(systemRunner, async (command, args, _options, next) => {
      if (command === 'git' && args[0] === 'push' && pushes++ === 0) await pushFromSeed(fixture.seed, 'people/taken.json', personJson('taken'));
      return next();
    });
    const seen: boolean[] = [];
    await openTeamRepo(clone, fixture.bare, racing).safeWrite((tree) => { seen.push(tree.before('people/taken.json') !== undefined); tree.set('people/me.json', personJson('me')); }, { action: 'join', handle: 'me' });
    expect(seen).toEqual([false, true]);
  });

  it('writes a Buffer SKILL.md byte-for-byte instead of decoding it through UTF-8', async () => {
    const fixture = await bareTeam();
    const id = '11111111-1111-4111-8111-111111111111';
    const initial = `---\nname: binary\ndescription: binary\nlicense: UNLICENSED\nmetadata:\n  id: ${id}\n  author: Me <me@example.com>\n  terum-category: testing\n---\n`;
    await pushFromSeed(fixture.seed, 'skills/binary/v1/SKILL.md', initial);
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const payload = Buffer.concat([Buffer.from(initial), Buffer.from([0xff, 0xfe, 0x80])]);
    // Row a' is add-only, so re-publishing changed bytes mints v2 rather than rewriting v1.
    await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('skills/binary/v2/SKILL.md', payload), { action: 'publish', handle: 'me' });
    expect(await readFile(join(clone, 'skills', 'binary', 'v2', 'SKILL.md'))).toEqual(payload);
    expect(await readFile(join(clone, 'skills', 'binary', 'v1', 'SKILL.md'), 'utf8')).toBe(initial);
  });

  // §4.5/D10, named in §14.1. Before the five touch points landed, `sourceFiles`' executable set was
  // read for hygiene and then dropped, `applyTree` wrote every path with no chmod, and
  // `executablePaths` required `tracked.has(path)` — which a path created by `tree.set()` never is.
  it('carries the executable bit into the team repo, and a mode-only change does not trip the staged-diff proof (D10, §4.5)', async () => {
    const fixture = await bareTeam();
    // Real frontmatter: this remote is generic, so safeWrite regenerates the README in-process and
    // parses the newest version's SKILL.md.
    const frontmatter = (body: string) => `---\nname: x\ndescription: x\nlicense: UNLICENSED\nmetadata:\n  id: 22222222-2222-4222-8222-222222222222\n  author: Me <me@example.com>\n  terum-category: testing\n---\n${body}\n`;
    await pushFromSeed(fixture.seed, 'skills/x/v1/SKILL.md', frontmatter('v1'));
    await pushFromSeed(fixture.seed, 'people/me.json', personJson('me'));
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));

    await openTeamRepo(clone, fixture.bare).safeWrite((tree) => {
      tree.set('skills/x/v2/SKILL.md', frontmatter('v2'));
      tree.set('skills/x/v2/scripts/run.sh', '#!/bin/sh\necho hi\n');
      tree.setExecutable('skills/x/v2/scripts/run.sh', true);
    }, { action: 'publish', handle: 'me' });

    // The proof that matters is what a FRESH clone gets — the working copy could be right by luck.
    const fresh = await cloneWithIdentity(fixture.bare, join(fixture.root, 'fresh'));
    const listed = await git(['ls-tree', '-r', 'HEAD', '--', 'skills/x/v2'], fresh);
    expect(listed).toMatch(/^100755 blob \S+\tskills\/x\/v2\/scripts\/run\.sh$/m);
    expect(listed).toMatch(/^100644 blob \S+\tskills\/x\/v2\/SKILL\.md$/m);

    // Touch point 5, on a path the guard admits for mutation. It cannot be tested inside a version
    // folder: row a' is add-only, so a mode-only change there is a mutation of a published version
    // and is refused — correctly, per §3.1's immutability. `applyTree` is shared by every write
    // path, which is why the mode-only case still has to work somewhere.
    await openTeamRepo(fresh, fixture.bare).safeWrite((tree) => {
      tree.setExecutable('people/me.json', true);
      // Content is untouched: before this landed, `changedPaths` compared bytes only, so it returned
      // [] while `git diff --cached --name-only` listed the path, and the equality proof threw.
      expect(tree.changedPaths).toEqual(['people/me.json']);
    }, { action: 'join', handle: 'me' });

    const after = await cloneWithIdentity(fixture.bare, join(fixture.root, 'after'));
    expect(await git(['ls-tree', 'HEAD', '--', 'people/me.json'], after))
      .toMatch(/^100755 blob \S+\tpeople\/me\.json$/m);
  });

  it('lists the tree as mutated, including additions and excluding removals', async () => {
    const fixture = await bareTeam();
    await pushFromSeed(fixture.seed, 'skills/x/v1/SKILL.md', 'skill');
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    let observed = false;
    await expect(openTeamRepo(clone, fixture.bare).safeWrite((tree) => {
      tree.set('people/new.json', personJson('new'));
      tree.remove('skills/x/v1/SKILL.md');
      expect(tree.paths('people/')).toContain('people/new.json');
      expect(tree.paths('skills/x/v1/')).not.toContain('skills/x/v1/SKILL.md');
      observed = true;
    }, { action: 'join', handle: 'new' })).rejects.toThrow(GuardError);
    expect(observed).toBe(true);
  });


  it('never echoes a credential in the wrong-repository or failed-clone messages', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    await git(['remote', 'set-url', 'origin', 'https://me:tok@github.com/acme/team.git'], clone);
    let mutated = false;
    const wrong = await openTeamRepo(clone, 'https://me:tok@github.com/someone/else.git').safeWrite(() => { mutated = true; }, { action: 'join', handle: 'me' }).then(() => '', (error: Error) => error.message);
    expect(mutated).toBe(false);
    expect(wrong).toContain('points at https://github.com/acme/team.git, not https://github.com/someone/else.git');
    expect(wrong).not.toContain('tok');
    expect(wrong).not.toContain('@');
    const refusing: Runner = { async run(command, args, options) { if (command === 'git' && args[0] === 'clone') return { code: 1, stdout: '', stderr: `fatal: repository '${args[args.length - 2]}' not found` }; return systemRunner.run(command, args, options); } };
    const failed = await cloneTeam('https://me:tok@github.com/acme/team.git', join(fixture.root, 'dest'), refusing).then(() => '', (error: Error) => error.message);
    expect(failed).toContain("Could not clone https://github.com/acme/team.git: fatal: repository 'https://github.com/acme/team.git' not found");
    expect(failed).not.toContain('tok');
    expect(failed).not.toContain('@');
  });
  it('retries ref-lock contention on main, and a protected-main refusal is one push and a PushRefused', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    let pushes = 0;
    const contended = wrapRunner(systemRunner, async (command, args, _options, next) => {
      if (command === 'git' && args[0] === 'push' && pushes++ === 0) return { code: 1, stdout: '', stderr: "error: cannot lock ref 'refs/heads/main': is at abc but expected def" };
      return next();
    });
    const result = await openTeamRepo(clone, fixture.bare, contended).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me', deadlineMs: 5_000 });
    expect(result.pushedTo).toBe('main');
    expect(pushes).toBe(2);
    let refused = 0;
    const protectedMain: Runner = { run(command, args, options) { if (command === 'git' && args[0] === 'push') { refused++; return Promise.resolve({ code: 1, stdout: '', stderr: ' ! [remote rejected] HEAD -> main (protected branch hook declined)' }); } return systemRunner.run(command, args, options); } };
    await expect(openTeamRepo(clone, fixture.bare, protectedMain).safeWrite((tree) => tree.set('people/me.json', personJson('me').replace('""', '"v2"')), { action: 'join', handle: 'me' })).rejects.toBeInstanceOf(PushRefused);
    expect(refused).toBe(1);
    expect((await git(['branch', '--list'], fixture.bare)).trim()).toBe('* main');
  });

  it('a deletion is restored by the finally when the push is refused, lands when it is not, and a byte-identical rewrite is no change', async () => {
    const fixture = await bareTeam();
    await pushFromSeed(fixture.seed, 'people/gone.json', personJson('gone'));
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const denied: Runner = { run(command, args, options) { if (command === 'git' && args[0] === 'push') return Promise.resolve({ code: 1, stdout: '', stderr: 'remote: Permission denied' }); return systemRunner.run(command, args, options); } };
    await expect(openTeamRepo(clone, fixture.bare, denied).safeWrite((tree) => tree.remove('people/gone.json'), { action: 'join', handle: 'gone' })).rejects.toThrow(PushRefused);
    expect(await exists(join(clone, 'people', 'gone.json'))).toBe(true);
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
    expect(await git(['ls-tree', '--name-only', 'main:people'], fixture.bare)).toContain('gone.json');
    expect(await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.remove('people/gone.json'), { action: 'join', handle: 'gone' })).toEqual({ changed: true, pushedTo: 'main' });
    expect(await git(['ls-tree', '--name-only', 'main:people'], fixture.bare)).not.toContain('gone.json');
    expect(await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/seed.json', tree.before('people/seed.json')!), { action: 'join', handle: 'seed' })).toEqual({ changed: false, pushedTo: 'main' });
  });

  it('refreshClone re-checks its lock before the reset: a fetch that outlives the stale window does not rewind the writer that took the lock', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    await writeFile(join(clone, 'stray.txt'), 'local'); await git(['add', '--all'], clone); await git(['commit', '-q', '-m', 'local-only'], clone);
    const head = (await git(['rev-parse', 'HEAD'], clone)).trim();
    const lock = join(fixture.root, '.clone.safewrite.lock');
    // The lock is stolen during the fetch. proper-lockfile refreshes on a tick clamped to
    // max(min(update, stale/2), 1000) = 1000 ms here and records the loss only in that tick's async
    // stat callback, so the wait must clear one full tick plus slack for a busy event loop.
    const slow = wrapRunner(systemRunner, async (command, args, _options, next) => {
      const result = await next();
      if (command === 'git' && args[0] === 'fetch') { await rm(lock, { recursive: true, force: true }); await new Promise((done) => setTimeout(done, 3_000)); }
      return result;
    });
    const lost = refreshClone(slow, clone, { lockStale: 2_000 });
    await expect(lost).rejects.toThrow(/Lost the safeWrite lock/);
    await expect(lost).rejects.toBeInstanceOf(CloneBusy);
    expect((await git(['rev-parse', 'HEAD'], clone)).trim()).toBe(head);
    await refreshClone(systemRunner, clone);
    expect((await git(['rev-parse', 'HEAD'], clone)).trim()).not.toBe(head);
  });

  it('a lock lost to another process aborts before the push and does NOT reset the clone, which that process now owns', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const lock = join(fixture.root, '.clone.safewrite.lock');
    // Steal the lock while our commit is being made; proper-lockfile notices on its next 1000 ms tick
    // (its floor), in that tick's async stat callback, so the wait clears a full tick plus slack.
    const stolen = wrapRunner(systemRunner, async (command, args, _options, next) => {
      const result = await next();
      if (command === 'git' && args[0] === 'commit') { await rm(lock, { recursive: true, force: true }); await new Promise((done) => setTimeout(done, 3_000)); }
      return result;
    });
    const before = await originSha(fixture.bare);
    await expect(openTeamRepo(clone, fixture.bare, stolen).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me', lockStale: 2_000 })).rejects.toThrow(/Lost the safeWrite lock/);
    expect(await originSha(fixture.bare)).toBe(before);
    expect((await git(['rev-parse', 'HEAD'], clone)).trim()).not.toBe((await git(['rev-parse', 'origin/main'], clone)).trim());
    // The next write resets the clone itself and lands.
    expect(await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' })).toEqual({ changed: true, pushedTo: 'main' });
  });

  it('waits for a holder that releases and acquires as soon as it does, without spending the budget', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const release = await holdCloneLock(clone);
    let released: Promise<void> | undefined;
    const releaseOnce = () => released ??= release();
    const timer = setTimeout(() => void releaseOnce(), 400);
    const started = Date.now();
    try {
      await expect(withCloneLock(clone, async () => 'ran', { label: 'team', lockWaitMs: 30_000 })).resolves.toBe('ran');
      expect(Date.now() - started).toBeGreaterThanOrEqual(400);
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally { clearTimeout(timer); await releaseOnce(); }
  });

  it('starts the push budget once the lock is held, so a wait longer than the budget still performs the write', async () => {
    // Real clock on purpose: the fake clock is not forwarded to the lock wait, and that separation is what is pinned.
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const release = await holdCloneLock(clone);
    let released: Promise<void> | undefined;
    const releaseOnce = () => released ??= release();
    const timer = setTimeout(() => void releaseOnce(), 3_500);
    try {
      const result = await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me', label: 'team', lockWaitMs: 30_000, deadlineMs: 3_000 });
      expect(result.changed).toBe(true);
      expect((await git(['show', 'origin/main:people/me.json'], clone)).length).toBeGreaterThan(0);
    } finally { clearTimeout(timer); await releaseOnce(); }
  }, 20_000);

  it('a budget that runs out before any push names no remote movement', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    let clock = 0;
    await expect(openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me', deadlineMs: 0, now: () => clock++, sleep: async () => undefined }))
      .rejects.toThrow(/ran out of its 0 ms budget before it could attempt a push; nothing was committed or pushed\.$/);
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
  });

  it('reports the wait through onWaiting after a second, then at most every five', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const release = await holdCloneLock(clone);
    // Keep the fake clock in the same epoch as the real lock's mtime for the future-skew check.
    let clock = Date.now();
    const seen: { label: string; elapsedMs: number }[] = [];
    try {
      await expect(withCloneLock(clone, async () => 'ran', { label: 'team', lockWaitMs: 12_000, onWaiting: info => seen.push(info), now: () => clock, sleep: async ms => { clock += ms; } })).rejects.toBeInstanceOf(CloneBusy);
      expect(seen.length).toBeGreaterThanOrEqual(2);
      expect(seen[0]!.elapsedMs).toBeGreaterThanOrEqual(1_000);
      expect(seen[0]!.elapsedMs).toBeLessThan(1_500);
      for (let i = 1; i < seen.length; i++) expect(seen[i]!.elapsedMs - seen[i - 1]!.elapsedMs).toBeGreaterThanOrEqual(5_000);
      expect(seen.every(info => info.label === 'team')).toBe(true);
    } finally { await release(); }
  });

  it('still fails at the deadline with the unchanged sentence, and the default budget stays under five seconds', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const release = await holdCloneLock(clone);
    try {
      let started = Date.now();
      await expect(withCloneLock(clone, async () => 'ran', { label: 'team', lockWaitMs: 1_500 })).rejects.toEqual(new CloneBusy('Another terum-skills operation holds the write lock on team; retry when it finishes.'));
      expect(Date.now() - started).toBeGreaterThanOrEqual(1_500);
      expect(Date.now() - started).toBeLessThan(6_000);
      started = Date.now();
      await expect(withCloneLock(clone, async () => 'ran', { label: 'team' })).rejects.toBeInstanceOf(CloneBusy);
      expect(Date.now() - started).toBeLessThan(8_000);
    } finally { await release(); }
  });

  it("refuses a lock stamped in this machine's future at once, naming the directory to remove", async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const path = cloneLockPath(clone), t = Date.now() / 1000 + 600;
    await mkdir(path); await utimes(path, t, t);
    const onWaiting = vi.fn(), started = Date.now();
    try {
      const error = await withCloneLock(clone, async () => 'ran', { label: 'team', lockWaitMs: 30_000, onWaiting }).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(CloneBusy);
      expect((error as Error).message).toMatch(/^The write lock on team is stamped /);
      expect((error as Error).message).toContain(`s in this machine's future (${path}), so waiting cannot clear it; remove that directory if no terum-skills command is running.`);
      expect(Date.now() - started).toBeLessThan(2_000);
      expect(onWaiting).not.toHaveBeenCalled();
    } finally { await rm(path, { recursive: true }); }
    await expect(withCloneLock(clone, async () => 'ran', { label: 'team', lockWaitMs: 30_000, onWaiting })).resolves.toBe('ran');
  });

  it('raises a non-ELOCKED acquisition failure on the first attempt instead of waiting', async () => {
    const root = await temporaryDirectory();
    await writeFile(join(root, 'notadir'), '');
    const started = Date.now();
    const error = await withCloneLock(join(root, 'notadir', 'clone'), async () => 'ran', { label: 'team', lockWaitMs: 30_000 }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(CloneBusy);
    expect(['ENOTDIR', 'ENOENT']).toContain((error as NodeJS.ErrnoException).code);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('labels a safeWrite failure when the caller passes one', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const release = await holdCloneLock(clone);
    try {
      await expect(openTeamRepo(clone, fixture.bare).safeWrite(tree => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me', label: 'team', lockWaitMs: 500 })).rejects.toEqual(new CloneBusy('Another terum-skills operation holds the write lock on team; retry when it finishes.'));
    } finally { await release(); }
  });

  it('gives a watching person the long budget and a waiting line, and a background caller neither', () => {
    const print = vi.fn();
    const background = lockWait({ interactive: false, print });
    expect(background.lockWaitMs).toBe(4_000);
    expect(background.onWaiting).toBeUndefined();
    expect(print).not.toHaveBeenCalled();
    const policy = lockWait({ interactive: true, print });
    expect(policy.lockWaitMs).toBe(75_000);
    policy.onWaiting!({ label: 'team', elapsedMs: 6_400 });
    expect(print).toHaveBeenCalledWith('Waiting for another terum-skills operation on team to finish… (6 s)');
    expect(lockWait({ interactive: true, print }, 1_234).lockWaitMs).toBe(1_234);
  });

  // D69: the refusal is printed by whoever spreads lockWait into safeWrite — every command does — and in
  // BOTH modes, because a script's log is the only place its operator would ever learn README.md was left out.
  it('hands every writer a README-refusal printer, watching or not', () => {
    const print = vi.fn();
    lockWait({ interactive: false, print }).onReadmeRefusal('README.md left unchanged: skills/legacy has no v<N>/SKILL.md');
    lockWait({ interactive: true, print }).onReadmeRefusal('README.md left unchanged: 1 skill row where the region held 3');
    expect(print.mock.calls).toEqual([['README.md left unchanged: skills/legacy has no v<N>/SKILL.md'], ['README.md left unchanged: 1 skill row where the region held 3']]);
  });

  it('contention at acquisition is classified into CloneBusy for safeWrite and withCloneLock alike, never proper-lockfile\'s raw ELOCKED', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const release = await holdCloneLock(clone);
    try {
      // Both contenders pay the full retry backoff; started together so the waits overlap.
      const write = openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' }).then(() => 'landed', (error: unknown) => error);
      const held = withCloneLock(clone, async () => 'ran', { label: 'team' }).then((value) => value, (error: unknown) => error);
      const [writeError, heldError] = await Promise.all([write, held]);
      expect(writeError).toBeInstanceOf(CloneBusy);
      expect((writeError as Error).message).toBe(`Another terum-skills operation holds the write lock on ${clone}; retry when it finishes.`);
      expect(heldError).toBeInstanceOf(CloneBusy);
      expect((heldError as Error).message).toBe('Another terum-skills operation holds the write lock on team; retry when it finishes.');
    } finally { await release(); }
    // Once the lock is free the same write lands.
    expect(await openTeamRepo(clone, fixture.bare).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' })).toEqual({ changed: true, pushedTo: 'main' });
  });

});

describe('the clone-local push guard arming (D12)', () => {
  /**
   * Drive a hook the way git does: arguments plus the ref lines on stdin. An absolute `/bin/sh`, because the
   * npx-fallback case strips PATH and a PATH-resolved shell would then fail to spawn at all; and an explicit
   * child env, as in bin.test.ts — no inherited NODE_OPTIONS and no node warnings, either of which would
   * break the exact `stderr: ''` below for reasons unrelated to the guard. PATH stays: the hook body runs `cat`.
   */
  const sh = (script: string, args: string[], stdin: string, env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '', NODE_NO_WARNINGS: '1' }) => new Promise<{ code: number | null; stdout: string; stderr: string }>((done) => {
    const child = spawn('/bin/sh', [script, ...args], { stdio: ['pipe', 'pipe', 'pipe'], env });
    const out: Buffer[] = []; const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('close', (code) => done({ code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') }));
    // The fail-open case exits before reading its ref lines; on Linux that surfaces as EPIPE on our end of the pipe
    // (git itself ignores SIGPIPE while feeding a hook). It is not a hook failure: swallow it, keep every other error.
    child.stdin.on('error', (error: NodeJS.ErrnoException) => { if (error.code !== 'EPIPE') throw error; });
    child.stdin.end(stdin);
  });

  // POSIX-only: the case drives the generated `#!/bin/sh` hook through `sh`, which Windows has no portable path to.
  it.skipIf(process.platform === 'win32')('cloneTeam arms the guard: the hook at 0700 with core.hooksPath pinned to the clone; the hook turns git\'s stdin lines into arguments, quotes its launcher, fails open when its launcher is gone, and never falls back to `@latest`', async () => {
    const fixture = await bareTeam();
    const clone = join(fixture.root, 'armed');
    await cloneTeam(fixture.bare, clone);
    const hook = join(clone, '.git', 'hooks', 'pre-push');
    expect((await stat(hook)).mode & 0o777).toBe(0o700);
    // Which launcher arms the clone is a property of the layout, not of the hook: where a built `dist/index.js`
    // exists (an install, the bundled entry, or a checkout someone has run `npm run build` in) the arming uses
    // that absolute entry; where it does not, it falls back to npx pinned to this package's version. Derive the
    // expectation from the same function the arming uses so this case is hermetic instead of silently asserting
    // that this tree happens to be unbuilt, and pin both arms.
    const { version } = createRequire(import.meta.url)('../../../package.json') as { version: string };
    const launcher = localPushGuardLauncher();
    const body = await readFile(hook, 'utf8');
    expect(body).toContain(launcher === null ? `terum-skills@${version}' guard-push` : `${shellQuote(launcher.entry)} guard-push`);
    // Whichever arm ran, the armed hook never launches `@latest`.
    expect(body.split('\n').find((line) => line.startsWith('exec '))).not.toContain('@latest');
    expect((await git(['config', '--local', 'core.hooksPath'], clone)).trim()).toBe('.git/hooks');
    // The body, driven the way git drives it, with a stub launcher that echoes its arguments and exits 3: two stdin lines become one flat argument list, and the launcher's exit status is the hook's.
    const stub = join(fixture.root, 'stub.js');
    await writeFile(stub, 'console.log(process.argv.slice(2).join(" ")); process.exit(3);\n');
    const armed = join(fixture.root, 'armed.sh');
    await writeFile(armed, pushGuardHook({ node: process.execPath, entry: stub }));
    const ran = await sh(armed, ['origin', 'https://x/y.git'], 'refs/heads/main a1 refs/heads/main b2\nrefs/heads/x c3 refs/heads/publish/x 00\n');
    expect(ran).toEqual({ code: 3, stdout: 'guard-push origin https://x/y.git refs/heads/main a1 refs/heads/main b2 refs/heads/x c3 refs/heads/publish/x 00\n', stderr: '' });
    const gone = join(fixture.root, 'gone.sh');
    await writeFile(gone, pushGuardHook({ node: process.execPath, entry: join(fixture.root, 'missing.js') }));
    const skipped = await sh(gone, ['origin', 'https://x/y.git'], 'refs/heads/main a1 refs/heads/main b2\n');
    expect(skipped.code).toBe(0);
    expect(skipped.stdout).toBe('');
    expect(skipped.stderr).toContain('NOT checked');
    // The launcher is quoted, not merely interpolated: a directory with a space and a quote in its name is still one word to the shell.
    const awkward = join(fixture.root, "a dir's name");
    await mkdir(awkward, { recursive: true });
    const awkwardStub = join(awkward, 'stub.js');
    await writeFile(awkwardStub, 'console.log(process.argv.slice(2).join(" ")); process.exit(3);\n');
    const quoted = join(fixture.root, 'quoted.sh');
    await writeFile(quoted, pushGuardHook({ node: process.execPath, entry: awkwardStub }));
    expect(await sh(quoted, ['origin', 'https://x/y.git'], 'refs/heads/main a1 refs/heads/main b2\n')).toEqual({ code: 3, stdout: 'guard-push origin https://x/y.git refs/heads/main a1 refs/heads/main b2\n', stderr: '' });
    // The npx fallback's fail-open, run rather than read: with no npx on PATH the hook warns and exits 0 instead of blocking the push.
    const fallback = join(fixture.root, 'fallback.sh');
    await writeFile(fallback, pushGuardHook(null));
    const withoutNpx = await sh(fallback, ['origin', 'https://x/y.git'], 'refs/heads/main a1 refs/heads/main b2\n', { PATH: join(fixture.root, 'no-npx'), NODE_NO_WARNINGS: '1' });
    expect(withoutNpx.code).toBe(0);
    expect(withoutNpx.stderr).toContain('NOT checked');
    expect(pushGuardHook(null)).toContain(`terum-skills@${version}`);
    expect(pushGuardHook(null)).toContain('Re-run `npx -y terum-skills@latest team join <remote>`');
    expect(pushGuardHook(null).split('\n').find((line) => line.startsWith('exec '))).not.toContain('@latest');
  });
});

it('packageVersion resolves this installed package under vitest', async () => {
  expect(packageVersion()).toBe(JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8')).version);
});

it('describeClone distinguishes failed probes from a runner that cannot verify, preserving cloneOrigin compatibility', async () => {
  const root = await temporaryDirectory();
  const failed: Runner = { async run() { return { code: 1, stdout: '', stderr: 'not a repository' }; } };
  const unavailable: Runner = { async run() { throw new Error('spawn git ENOENT'); } };
  expect(await describeClone(root, 'github.com/acme/team', failed)).toEqual({ state: 'incomplete', reason: 'not-a-repository' });
  expect(await describeClone(root, 'github.com/acme/team', unavailable)).toEqual({ state: 'incomplete', reason: 'unverifiable', error: 'spawn git ENOENT' });
  expect(await cloneOrigin(root, unavailable)).toBeNull();
  const origin: Runner = { async run() { return { code: 0, stdout: 'github.com/acme/team', stderr: '' }; } };
  expect(await describeClone(root, 'github.com/acme/team', origin)).toEqual({ state: 'incomplete', reason: 'no-team-json' });
});

describe('remote failure call sites (issue 11)', () => {
  const remote = 'https://github.com/acme/team.git';
  const stderr = "remote: Repository not found.\nfatal: repository 'https://github.com/acme/team.git/' not found";
  it('appends the clone explanation after the original git detail', async () => {
    const fixture = await bareTeam();
    const runner = wrapRunner(mappedRunner(remote, fixture.bare), async (command, args, _options, next) => command === 'git' && args[0] === 'clone' ? { code: 128, stdout: '', stderr } : next());
    await expect(cloneTeam(remote, join(fixture.root, 'failed'), runner)).rejects.toThrow(`Could not clone ${remote}: ${stderr}\nGit could not access ${remote}.`);
  });
  it.each(['fetch', 'reset'])('refresh %s preserves the prefix and classifies only fetch', async (step) => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const base = mappedRunner(remote, fixture.bare);
    const runner = wrapRunner(base, async (command, args, _options, next) => command === 'git' && args[0] === step ? { code: 128, stdout: '', stderr } : next());
    const error = await refreshClone(runner, clone, { label: 'team' }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    if (step === 'fetch') expect((error as Error).message).toContain(`Could not refresh team: ${stderr}\nGit could not access ${remote}.`);
    else expect((error as Error).message).toBe(`Could not refresh team: ${stderr}`);
    expect((error as Error).name).toBe(step === 'fetch' ? 'RemoteAccessError' : 'Error');
    expect(base.calls.filter((call) => call.args.join(' ') === 'remote get-url origin')).toHaveLength(step === 'fetch' ? 1 : 0);
  });
  it.each(['fetch', 'push'])('safeWrite %s appends the explanation using origin transport', async (step) => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const detail = step === 'fetch' ? stderr : 'remote: Permission to acme/team.git denied to me.';
    const runner = wrapRunner(mappedRunner(remote, fixture.bare), async (command, args, _options, next) => command === 'git' && args[0] === step ? { code: 128, stdout: '', stderr: detail } : next());
    const error = await openTeamRepo(clone, 'github.com/acme/team', runner).safeWrite((tree) => tree.set('people/me.json', personJson('me')), { action: 'join', handle: 'me' }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(`${step === 'fetch' ? 'git fetch origin failed' : 'The remote refused the push'}: ${detail}\nGit could not ${step === 'fetch' ? 'access' : 'push to'} ${remote}.`);
    if (step === 'push') expect(error).toBeInstanceOf(PushRefused);
  });
  it('safeWrite uses the SSH origin even with an HTTPS-normalized binding', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const ssh = 'git@github.com:acme/team.git';
    const runner = wrapRunner(mappedRunner(ssh, fixture.bare), async (command, args, _options, next) => command === 'git' && args[0] === 'fetch' ? { code: 128, stdout: '', stderr: 'ERROR: Repository not found.' } : next());
    await expect(openTeamRepo(clone, 'github.com/acme/team', runner).safeWrite(() => undefined, { action: 'join', handle: 'me' })).rejects.toThrow(`Git is using SSH for ${ssh}`);
  });
});

it('returns a no-change mutation value', async () => {
  const fixture = await bareTeam(); const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
  expect(await openTeamRepo(clone, fixture.bare).safeWrite(() => 'a', { action: 'join', handle: 'me' })).toEqual({ changed: false, pushedTo: 'main', returned: 'a' });
});
it('returns only the completed attempt value after rejection', async () => {
  const fixture = await bareTeam(); const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
  let pushes = 0; let attempt = 0;
  const runner = wrapRunner(systemRunner, async (command, args, _options, next) => {
    if (command === 'git' && args[0] === 'push' && pushes++ === 0) return { code: 1, stdout: '', stderr: 'non-fast-forward; fetch first' };
    return next();
  });
  const result = await openTeamRepo(clone, fixture.bare, runner).safeWrite((tree) => { tree.set('people/me.json', personJson('me')); return attempt++; }, { action: 'join', handle: 'me', backoff: () => 0 });
  expect(attempt).toBe(2);
  expect(result).toEqual({ changed: true, pushedTo: 'main', returned: 1 });
});


it('skillVersions reads each named skill\'s version folders from the clone, newest first, and spawns nothing', async () => {
  const fixture = await bareTeam();
  for (const name of ['a', 'b', 'c']) await pushFromSeed(fixture.seed, 'skills/' + name + '/v1/SKILL.md', name);
  for (const folder of ['v2', 'v10']) await pushFromSeed(fixture.seed, 'skills/a/' + folder + '/SKILL.md', folder);
  let children = 0;
  const runner = wrapRunner(systemRunner, async (_command, _args, _options, next) => { children++; return next(); });
  void runner;
  const versions = await skillVersions(fixture.seed, ['a', 'b', 'c', 'missing']);
  expect(children).toBe(0);
  // The sort is numeric on the ordinal: ['v10','v2'].sort() would pin 'a' to v2 forever.
  expect(versions.get('a')!.map((version) => version.folder)).toEqual(['v10', 'v2', 'v1']);
  expect(versions.get('a')!.map((version) => version.n)).toEqual([10, 2, 1]);
  expect(versions.get('b')!.map((version) => version.folder)).toEqual(['v1']);
  // An unpublished name is an ordinary answer, not an error or an absent key.
  expect(versions.get('missing')).toEqual([]);
});
it('skillVersions ignores every directory that is not a version folder, and a missing skills root', async () => {
  const fixture = await bareTeam();
  await pushFromSeed(fixture.seed, 'skills/a/v1/SKILL.md', 'a');
  for (const folder of ['v0', 'v01', 'V2', 'draft']) await pushFromSeed(fixture.seed, 'skills/a/' + folder + '/SKILL.md', folder);
  expect((await skillVersions(fixture.seed, ['a'])).get('a')!.map((version) => version.folder)).toEqual(['v1']);
  await rm(join(fixture.seed, 'skills'), { recursive: true });
  expect(await skillVersions(fixture.seed, ['a'])).toEqual(new Map([['a', []]]));
  expect(await skillVersions(fixture.seed, [])).toEqual(new Map());
});


describe('W-02 post-push cleanup',()=>{
  it.each(['main','unchanged','guard','exhausted'] as const)('preserves cleanup semantics for %s',async mode=>{
    const f=await bareTeam();const clone=await cloneWithIdentity(f.bare,join(f.root,'clone'));const calls:string[][]=[];let pushed='';let clock=0;
    const runner=wrapRunner(systemRunner,async(_command,args,_options,next)=>{calls.push([...args]);if(args[0]==='push'){pushed=(await git(['rev-parse','HEAD'],clone)).trim();if(mode==='exhausted'){clock=100;return {code:1,stdout:'',stderr:'! [rejected] main -> main (non-fast-forward)'};}}return next();});
    const attempt=openTeamRepo(clone,f.bare,runner).safeWrite(tree=>{if(mode==='unchanged')return;if(mode==='guard'){tree.set('people/other.json',personJson('other'));return;}tree.set('people/me.json',personJson('me'));},{action:'join',handle:'me',...(mode==='exhausted'?{deadlineMs:50,now:()=>clock,sleep:async()=>{clock=100;}}:{})});
    if(mode==='guard')await expect(attempt).rejects.toThrow(GuardError);else if(mode==='exhausted')await expect(attempt).rejects.toThrow(SafeWriteExhausted);else expect(await attempt).toMatchObject({changed:mode!=='unchanged'});
    expect(calls.filter(c=>c[0]==='fetch')).toHaveLength(mode==='main'?1:2);
    const push=calls.findIndex(c=>c[0]==='push');
    if(mode==='main'){expect(calls.slice(push+1).some(c=>c[0]==='reset')).toBe(false);expect((await git(['rev-parse','HEAD'],clone)).trim()).toBe(pushed);}
    else {expect(calls.at(-1)?.[0]==='reset'||calls.some((c,i)=>i>push&&c.join(' ')==='reset --hard origin/main')).toBe(true);expect(await exists(join(clone,'people/me.json'))).toBe(false);if(mode==='guard')expect(await exists(join(clone,'people/other.json'))).toBe(false);}
  });
});

describe('safeWriteBatch', () => {
  const bio = (text: string) => `${JSON.stringify({ ...person('me'), bio: text })}\n`;
  const countingRunner = (counts: { push: number; fetch: number }) => wrapRunner(systemRunner, async (command, args, _options, next) => {
    if (command === 'git' && args[0] === 'push') counts.push += 1;
    if (command === 'git' && args[0] === 'fetch') counts.fetch += 1;
    return next();
  });

  it('commits once per item and pushes once', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const counts = { push: 0, fetch: 0 };
    const items = ['one', 'two', 'three'].map((text) => ({ mutate: (tree: { set(path: string, content: string): void }) => { tree.set('people/me.json', bio(text)); return text; }, message: `me: install ${text}` }));
    const outcome = await openTeamRepo(clone, fixture.bare, countingRunner(counts)).safeWriteBatch(items, { action: 'install', handle: 'me' });
    expect(outcome.changed).toBe(true);
    expect(outcome.committed.map((entry) => entry.returned)).toEqual(['one', 'two', 'three']);
    expect(outcome.skipped).toEqual([]);
    // The whole point: per-skill provenance survives, and the network is paid for once.
    const log = (await git(['log', '--format=%s', 'origin/main'], clone)).split('\n').filter(Boolean);
    // One commit per item, in order, plus the single README regeneration this generic remote earns
    // — regenerated once after the last item, never per item.
    expect(log.slice(0, 4)).toEqual(['me: install', 'me: install three', 'me: install two', 'me: install one']);
    expect(counts.push).toBe(1);
    expect(JSON.parse(await readFile(join(clone, 'people/me.json'), 'utf8')).bio).toBe('three');
  });

  it('skips an item whose mutation throws and lands the rest', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const counts = { push: 0, fetch: 0 };
    const items = [
      { mutate: (tree: { set(path: string, content: string): void }) => { tree.set('people/me.json', bio('first')); return 'first'; }, message: 'me: install first' },
      { mutate: () => { throw new Error('no SKILL.md'); }, message: 'me: install broken' },
      { mutate: (tree: { set(path: string, content: string): void }) => { tree.set('people/me.json', bio('third')); return 'third'; }, message: 'me: install third' },
    ];
    const outcome = await openTeamRepo(clone, fixture.bare, countingRunner(counts)).safeWriteBatch(items, { action: 'install', handle: 'me' });
    expect(outcome.committed.map((entry) => entry.index)).toEqual([0, 2]);
    expect(outcome.skipped).toEqual([{ index: 1, reason: 'no SKILL.md', noop: false }]);
    expect(counts.push).toBe(1);
    const log = (await git(['log', '--format=%s', 'origin/main'], clone)).split('\n').filter(Boolean);
    expect(log).toContain('me: install first');
    expect(log).toContain('me: install third');
    expect(log).not.toContain('me: install broken');
  });

  it('pushes nothing when no item writes', async () => {
    const fixture = await bareTeam();
    const clone = await cloneWithIdentity(fixture.bare, join(fixture.root, 'clone'));
    const counts = { push: 0, fetch: 0 };
    const before = await originSha(clone);
    const outcome = await openTeamRepo(clone, fixture.bare, countingRunner(counts)).safeWriteBatch([{ mutate: () => undefined, message: 'me: install nothing' }], { action: 'install', handle: 'me' });
    expect(outcome).toMatchObject({ changed: false, committed: [], skipped: [{ index: 0, reason: 'nothing to write', noop: true }] });
    expect(counts.push).toBe(0);
    expect(await originSha(clone)).toBe(before);
  });
});

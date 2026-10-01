import { lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentRunError, systemAgent, type AgentApi } from '../../lib/evals/agent.js';
import { run as validate } from '../validate.js';
import { createConfigStore, type ConfigStore } from '../../lib/config.js';
import { bareTeam, cloneWithIdentity, git, NonInteractivePrompter, originSha, person, pushFromSeed, ScriptedPrompter, SYMLINKS_SUPPORTED, TEAM_JSON } from '../../lib/__tests__/fixtures.js';
import { run, runMany } from '../publish.js';
import { receiptSchema } from '../../lib/evals/receipt.js';
import { DEFAULT_CATEGORY, skillContentDigest } from '../../lib/skills.js';
import { sourceFiles } from '../../lib/skill-source.js';
import { systemRunner, type CommandResult, type Runner } from '../../lib/runner.js';

// Every model call stays behind the askJson seam, including accidental calls in older cases.
beforeEach(() => { vi.spyOn(systemAgent, 'askJson').mockRejectedValue(new AgentRunError('offline test')); });
afterEach(() => { vi.restoreAllMocks(); });

const ID = '11111111-1111-4111-8111-111111111111';

/** A Library folder, exactly as an author would leave it: no managed fields unless asked for. */
async function librarySkill(home: string, name = 'sample', body = `---\nname: ${name}\ndescription: useful skill\n---\n\n# ${name}\n`): Promise<string> {
  const directory = join(home, '.claude', 'skills', name);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'SKILL.md'), body);
  return directory;
}

const published = (name = 'sample', id = ID) => `---\nname: ${name}\ndescription: useful skill\nlicense: UNLICENSED\nmetadata:\n  id: ${id}\n  author: Seed <seed@example.com>\n  terum-category: testing\n---\n\n# ${name}\n`;

async function prepared(options: { projects?: Record<string, { remotes: string[]; skills: string[] }> } = {}) {
  const fixture = await bareTeam();
  if (options.projects) await pushFromSeed(fixture.seed, 'team.json', `${JSON.stringify({ ...TEAM_JSON, projects: options.projects }, null, 2)}\n`);
  const home = await (await import('../../lib/__tests__/fixtures.js')).temporaryDirectory();
  const store = createConfigStore(join(fixture.root, 'state'));
  const clone = await cloneWithIdentity(fixture.bare, store.teamClone('team'));
  await store.update((config) => {
    config.teams.team = { remote: fixture.bare, handle: 'seed' };
    config.display_name = 'Seed'; config.email = 'seed@example.com';
  });
  return { fixture, store, clone, home };
}

/** A local receipt for exactly these bytes, in the content-keyed store §6.2 defines. */
async function localReceipt(store: ConfigStore, folder: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const digest = skillContentDigest((await sourceFiles(folder)).files);
  const receipt = receiptSchema.parse({
    schema_version: 2, skill_id: null, skill_name: 'sample', version: null, content_digest: digest,
    run_id: '20260101T000000Z', verdict: 'PASS', attribution: 'test receipt', execution_status: 'complete',
    expected_rows: 0, scored_rows: 0, comparisons: {}, arm_scores: {}, triggers: null, efficiency: {},
    provenance: { engine_version: 'test', engine_commit: 'unknown', cc_version: 'test', model: 'sonnet', judge_model: 'sonnet', k: 1, cases: [], arm_skill_lists: {}, timestamp: '2026-01-01T00:00:00Z', runner_handle: 'seed' },
    ...overrides,
  });
  const dir = join(store.root, 'evals', 'local', digest.replace(/^sha256:/, ''), String(receipt.run_id));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'receipt.json'), JSON.stringify(receipt));
  return digest;
}

const show = async (bare: string, path: string) => git(['show', `main:${path}`], bare);

describe('publish (§5) — the only bridge between the two mirrors', () => {
  // The desktop passes the Library card's path (`~/…`) for a skill the team has never seen — the only
  // shape a first publish from the app ever takes — so the ref must resolve as a path too.
  it('publishes from the folder\'s ~-prefixed path exactly as from its name', async () => {
    const { store, home } = await prepared();
    await librarySkill(home);
    const result = await run({ ref: '~/.claude/skills/sample', home, config: store }, new ScriptedPrompter([], [false]));
    expect(result).toMatchObject({ ok: true, value: { team: 'team', name: 'sample', project: null, version: 'v1', created: true } });
  });

  it('mints v1 from the LOCAL folder, injects the managed fields, and lands on main', async () => {
    const { fixture, store, home } = await prepared();
    const folder = await librarySkill(home);
    const io = new ScriptedPrompter([], [false]);
    const result = await run({ ref: 'sample', home, config: store }, io);
    // No `--project`: the version folder alone is the publish. `team.json` is not touched at all.
    expect(result).toMatchObject({ ok: true, value: { team: 'team', name: 'sample', project: null, version: 'v1', created: true, identicalTo: null, attachedEvals: 0, projectAdded: false } });
    // §5.1 step 4: the four managed fields are written by publish, into the version AND back into the
    // folder — an author's folder carries none of them until their first publish.
    const committed = await show(fixture.bare, 'skills/sample/v1/SKILL.md');
    expect(committed).toContain('license: UNLICENSED');
    expect(committed).toContain('author: Seed <seed@example.com>');
    expect(committed).toContain(`terum-category: ${DEFAULT_CATEGORY}`);
    expect(await readFile(join(folder, 'SKILL.md'), 'utf8')).toBe(committed);
    // §4.1: the push collapsed onto main. No branch, no pull request.
    expect((await git(['branch', '--list'], fixture.bare)).trim()).toBe('* main');
    // team.json is untouched: the fixture's project list neither gains this id nor loses anything.
    expect(JSON.parse(await show(fixture.bare, 'team.json')).projects).toEqual(TEAM_JSON.projects);
    expect(io.lines.join('\n')).toContain('Published sample as Version 1 to the team marketplace.');
  });

  it('category precedence is declared > --category > the default, and only the default announces itself', async () => {
    const { fixture, store, home } = await prepared();
    await librarySkill(home, 'sample');
    const flagged = await run({ ref: 'sample', home, config: store, category: 'docs' }, new ScriptedPrompter());
    expect(flagged).toMatchObject({ ok: true });
    expect(await show(fixture.bare, 'skills/sample/v1/SKILL.md')).toContain('terum-category: docs');

    const second = await prepared();
    await librarySkill(second.home, 'declared', `---\nname: declared\ndescription: d\nmetadata:\n  terum-category: testing\n---\n`);
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'declared', home: second.home, config: second.store, category: 'docs' }, io)).toMatchObject({ ok: true });
    expect(await show(second.fixture.bare, 'skills/declared/v1/SKILL.md')).toContain('terum-category: testing');
    expect(io.lines.filter((line) => line.startsWith('metadata.terum-category:'))).toEqual([]);
  });

  it('keeps a declared metadata.id and mints one only when the folder has none', async () => {
    const { fixture, store, home } = await prepared();
    await librarySkill(home, 'sample', published());
    const result = await run({ ref: 'sample', home, config: store }, new ScriptedPrompter());
    expect(result).toMatchObject({ ok: true, value: { id: ID } });
    expect(await show(fixture.bare, 'skills/sample/v1/SKILL.md')).toContain(`id: ${ID}`);
  });

  it('a byte-identical republish mints nothing — the §5.1 step 7 prefix strip is what makes this reachable', async () => {
    const { fixture, store, home } = await prepared();
    await librarySkill(home);
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { version: 'v1' } });
    const afterFirst = await originSha(fixture.bare);
    const io = new ScriptedPrompter();
    const again = await run({ ref: 'sample', home, config: store }, io);
    expect(again).toMatchObject({ ok: true, value: { version: null, created: false, identicalTo: 'v1', projectAdded: false } });
    expect(await originSha(fixture.bare)).toBe(afterFirst);
    expect(io.lines.join('\n')).toContain('Nothing to publish: sample is identical to Version 1 and already in the team marketplace.');
  });

  // Git for Windows ships `core.autocrlf=true`, so a fresh clone there checks every LF blob out as CRLF.
  // The comparison reads the clone's files, so an LF Library folder never matched and every republish
  // minted — shared-skills carries four such versions differing only in `author:`. The setting is
  // injected through the environment, the highest config level, so no repo-local setting can outvote it.
  it('an unchanged republish mints nothing on a clone checked out with core.autocrlf=true', async () => {
    const { fixture, store, clone, home } = await prepared();
    await librarySkill(home);
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { version: 'v1' } });
    const afterFirst = await originSha(fixture.bare);
    vi.stubEnv('GIT_CONFIG_COUNT', '2');
    vi.stubEnv('GIT_CONFIG_KEY_1', 'core.autocrlf');
    vi.stubEnv('GIT_CONFIG_VALUE_1', 'true');
    try {
      // Another machine's clone: checked out fresh, under the autocrlf the person's git carries.
      await rm(clone, { recursive: true, force: true });
      await cloneWithIdentity(fixture.bare, clone);
      const again = await run({ ref: 'sample', home, config: store }, new ScriptedPrompter());
      expect(again).toMatchObject({ ok: true, value: { version: null, created: false, identicalTo: 'v1' } });
      expect(await originSha(fixture.bare)).toBe(afterFirst);
      // The clone's working tree is the committed bytes, not a converted copy of them.
      expect(await readFile(join(clone, 'skills', 'sample', 'v1', 'SKILL.md'), 'utf8')).toBe(await show(fixture.bare, 'skills/sample/v1/SKILL.md'));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('changed bytes mint the next ordinal from the HIGHEST version, never from the count', async () => {
    const { fixture, store, home } = await prepared();
    const folder = await librarySkill(home);
    await run({ ref: 'sample', home, config: store }, new ScriptedPrompter());
    await writeFile(join(folder, 'SKILL.md'), `---\nname: sample\ndescription: useful skill\n---\n\n# changed\n`);
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { version: 'v2' } });
    // A version folder is immutable, but history can still lose one (a repo surgery, a bad import).
    // Counting would then re-mint v2 over different bytes; the highest ordinal + 1 cannot.
    await git(['rm', '-r', '-q', 'skills/sample/v1'], fixture.seed).catch(async () => {
      await git(['fetch', '-q', 'origin'], fixture.seed); await git(['reset', '-q', '--hard', 'origin/main'], fixture.seed);
      await git(['rm', '-r', '-q', 'skills/sample/v1'], fixture.seed);
    });
    await git(['commit', '-q', '-m', 'drop v1'], fixture.seed);
    await git(['push', '-q', 'origin', 'HEAD:main'], fixture.seed);
    await writeFile(join(folder, 'SKILL.md'), `---\nname: sample\ndescription: useful skill\n---\n\n# changed again\n`);
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { version: 'v3' } });
  });

  it('publishes ordinary files into the version and eval assets beside it, never inside (overrides D9)', async () => {
    const { fixture, store, home } = await prepared();
    const folder = await librarySkill(home);
    await mkdir(join(folder, 'evals', 'cases'), { recursive: true });
    await writeFile(join(folder, 'evals', 'cases', 'happy.yaml'), 'task: t\n');
    await writeFile(join(folder, 'evals', 'triggers.yaml'), 'should_trigger: []\n');
    await mkdir(join(folder, 'references'), { recursive: true });
    await writeFile(join(folder, 'references', 'a.md'), 'aux\n');
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { version: 'v1', evalAssets: 2 } });
    // Everything that is the skill goes into the immutable version folder…
    expect(await show(fixture.bare, 'skills/sample/v1/references/a.md')).toBe('aux\n');
    // …and the eval dataset goes beside it, where a later publish can correct it without minting.
    expect(await show(fixture.bare, 'skills/sample/evals/cases/happy.yaml')).toBe('task: t\n');
    expect(await show(fixture.bare, 'skills/sample/evals/triggers.yaml')).toBe('should_trigger: []\n');
    await expect(show(fixture.bare, 'skills/sample/v1/evals/cases/happy.yaml')).rejects.toThrow();
  });

  it('shares an edited eval case without minting a version, and never deletes one', async () => {
    const { fixture, store, home } = await prepared();
    const folder = await librarySkill(home);
    await mkdir(join(folder, 'evals', 'cases'), { recursive: true });
    await writeFile(join(folder, 'evals', 'cases', 'happy.yaml'), 'task: t\n');
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { version: 'v1' } });

    // The whole point: the skill did not change, so no version is minted — but the case still lands.
    await writeFile(join(folder, 'evals', 'cases', 'happy.yaml'), 'task: t2\n');
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store }, io)).toMatchObject({ ok: true, value: { version: null, identicalTo: 'v1', evalAssets: 1 } });
    expect(await show(fixture.bare, 'skills/sample/evals/cases/happy.yaml')).toBe('task: t2\n');
    expect(io.lines.join('\n')).toContain('no new version was minted');

    // A folder that has lost a case never deletes the team's copy (guard row a″ admits no removal).
    await rm(join(folder, 'evals', 'cases', 'happy.yaml'));
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { version: null, evalAssets: 0 } });
    expect(await show(fixture.bare, 'skills/sample/evals/cases/happy.yaml')).toBe('task: t2\n');
  });

  it('attaches every local receipt of these exact bytes as a stamped COPY, and reports the ones it could not', async () => {
    const { fixture, store, home } = await prepared();
    const folder = await librarySkill(home);
    // Taken BEFORE publish, so it has no version and (for a first publish) no skill id: §6.1's
    // whole ordering problem, and the reason the store is keyed on content.
    await localReceipt(store, folder);
    // A run of DIFFERENT bytes — the pre-injection folder, say — must not ride along.
    await localReceipt(store, folder, { content_digest: `sha256:${'c'.repeat(64)}`, run_id: '20260102T000000Z' });
    const io = new ScriptedPrompter();
    const result = await run({ ref: 'sample', home, config: store }, io);
    expect(result).toMatchObject({ ok: true, value: { version: 'v1', attachedEvals: 0 } });
    // Injection changes the bytes, so a receipt taken before the FIRST publish legitimately misses.
    expect(io.lines.join('\n')).not.toContain('Attached 1 eval run');

    // After the first publish the folder carries its managed fields, so every later run matches.
    await writeFile(join(folder, 'SKILL.md'), `${await readFile(join(folder, 'SKILL.md'), 'utf8')}\nmore\n`);
    const digest = await localReceipt(store, folder, { run_id: '20260103T000000Z' });
    const second = await run({ ref: 'sample', home, config: store }, new ScriptedPrompter());
    expect(second).toMatchObject({ ok: true, value: { version: 'v2', attachedEvals: 1 } });
    const attached = JSON.parse(await show(fixture.bare, `evals/${second.ok ? second.value.id : ''}/v2/20260103T000000Z.json`));
    // Stamped, not copied: this is what makes §8.1's misfiled check mean anything.
    expect(attached).toMatchObject({ skill_id: second.ok ? second.value.id : '', version: 'v2', content_digest: digest });
    // The local run itself is untouched — it is local state, not testimony the team owns.
    const local = JSON.parse(await readFile(join(store.root, 'evals', 'local', digest.replace(/^sha256:/, ''), '20260103T000000Z', 'receipt.json'), 'utf8'));
    expect(local).toMatchObject({ version: null, skill_id: null });
  });

  it('D19: a failing local eval of these exact bytes asks once, and a decline leaves the folder byte-identical', async () => {
    const { fixture, store, home } = await prepared();
    const folder = await librarySkill(home);
    await run({ ref: 'sample', home, config: store }, new ScriptedPrompter());
    await writeFile(join(folder, 'SKILL.md'), `${await readFile(join(folder, 'SKILL.md'), 'utf8')}\nchanged\n`);
    const before = await readFile(join(folder, 'SKILL.md'), 'utf8');
    const mainBefore = await originSha(fixture.bare);
    await localReceipt(store, folder, { verdict: 'FAIL', run_id: '20260104T000000Z' });

    const declined = new ScriptedPrompter([], [false]);
    expect(await run({ ref: 'sample', home, config: store }, declined)).toMatchObject({ ok: false });
    expect(declined.asked.join('\n')).toContain('Your latest eval of these exact bytes failed');
    // OF-2: the write-back sits AFTER the last refusal, so a cancelled publish changes nothing.
    expect(await readFile(join(folder, 'SKILL.md'), 'utf8')).toBe(before);
    expect(await originSha(fixture.bare)).toBe(mainBefore);

    expect(await run({ ref: 'sample', home, config: store, allowRegression: true }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { version: 'v2' } });
  });

  it('injects BEFORE hygiene, so a folder that has never been published is not refused for the fields publish is about to write', async () => {
    const { store, home } = await prepared();
    await librarySkill(home, 'sample', `---\nname: sample\ndescription: useful skill\n---\n`);
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true });
  });

  it.skipIf(!SYMLINKS_SUPPORTED)('still refuses hygiene failures, an unknown project, a missing folder, a symlink, and state-root content', async () => {
    const { store, home } = await prepared();
    await librarySkill(home, 'hostile', `---\nname: hostile\ndescription: has a credential\n---\n\nAWS_SECRET_ACCESS_KEY=AKIAIOSFODNN7EXAMPLEKEYX\n`);
    expect(await run({ ref: 'hostile', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: false, error: expect.stringContaining('HYG3') });

    await librarySkill(home, 'sample');
    expect(await run({ ref: 'sample', home, config: store, project: 'nope' }, new ScriptedPrompter())).toMatchObject({ ok: false, error: 'Unknown project nope.' });
    expect(await run({ ref: 'ghost', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: false, error: expect.stringContaining('No local skill folder named ghost in your library.') });
    // A path outside every Library root misses in the path grammar — publish never reads an arbitrary folder.
    const outside = join(await (await import('../../lib/__tests__/fixtures.js')).temporaryDirectory(), 'sample');
    await mkdir(outside, { recursive: true }); await writeFile(join(outside, 'SKILL.md'), '---\nname: sample\ndescription: elsewhere\n---\n');
    expect(await run({ ref: outside, home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: false, error: expect.stringContaining(`No skill folder at ${outside} in your library.`) });

    const linked = join(home, '.claude', 'skills', 'linked');
    await symlink(join(home, '.claude', 'skills', 'sample'), linked, 'dir');
    expect(await lstat(linked)).toMatchObject({});
    expect(await run({ ref: 'linked', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: false });
  });

  it('adds the skill to a chosen project without minting when the bytes are unchanged', async () => {
    const { fixture, store, home } = await prepared({ projects: { Global: { remotes: [], skills: [] }, product: { remotes: [], skills: [] } } });
    await librarySkill(home);
    expect(await run({ ref: 'sample', home, config: store, project: 'Global' }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { version: 'v1', projectAdded: true } });
    const io = new ScriptedPrompter();
    const second = await run({ ref: 'sample', home, config: store, project: 'product' }, io);
    expect(second).toMatchObject({ ok: true, value: { version: null, identicalTo: 'v1', projectAdded: true } });
    expect(io.lines.join('\n')).toContain('Added sample to product. It is identical to Version 1');
    const teamJson = JSON.parse(await show(fixture.bare, 'team.json'));
    expect(teamJson.projects.product.skills).toEqual([second.ok ? second.value.id : '']);
    expect(teamJson.projects.Global.skills).toEqual([second.ok ? second.value.id : '']);
  });

  it('never asks which project, however many the team has — publishing targets the marketplace', async () => {
    const { fixture, store, home } = await prepared({ projects: { infra: { remotes: [], skills: [] }, product: { remotes: [], skills: [] } } });
    await librarySkill(home);
    const io = new ScriptedPrompter();
    const result = await run({ ref: 'sample', home, config: store }, io);
    expect(result).toMatchObject({ ok: true, value: { project: null, version: 'v1', projectAdded: false } });
    expect(io.asked).toEqual([]);
    // Neither list gained the id, and the skill is in the team all the same.
    const teamJson = JSON.parse(await show(fixture.bare, 'team.json'));
    expect(teamJson.projects.infra.skills).toEqual([]);
    expect(teamJson.projects.product.skills).toEqual([]);
    expect(await show(fixture.bare, 'skills/sample/v1/SKILL.md')).toContain('name: sample');
  });

  it('refuses a --project the team does not have, before writing anything locally or in the clone', async () => {
    const { fixture, store, home } = await prepared({ projects: { product: { remotes: [], skills: [] } } });
    const folder = await librarySkill(home);
    const before = await readFile(join(folder, 'SKILL.md'), 'utf8');
    const head = await originSha(fixture.bare);
    expect(await run({ ref: 'sample', home, config: store, project: 'payments' }, new ScriptedPrompter()))
      .toMatchObject({ ok: false, error: expect.stringContaining('Unknown project payments') });
    expect(await readFile(join(folder, 'SKILL.md'), 'utf8')).toBe(before);
    expect(await originSha(fixture.bare)).toBe(head);
  });

  it('D5/D77: publishing is not installing — the only people-file write is the profile entry, and publish writes it without asking', async () => {
    const { fixture, store, home } = await prepared();
    await librarySkill(home);
    // NonInteractivePrompter throws on any question, so a surviving prompt fails this outright —
    // and it is the shape a piped `publish` really has, where the old question could only throw.
    const io = new NonInteractivePrompter();
    const first = await run({ ref: 'sample', home, config: store }, io);
    expect(first).toMatchObject({ ok: true, value: { profileAdded: true, version: 'v1' } });
    expect(io.asked).toEqual([]);
    expect(io.lines.join('\n')).toContain('Your profile now lists sample at Version 1.');
    const after = JSON.parse(await show(fixture.bare, 'people/seed.json'));
    expect(after.installed).toEqual([]);
    expect(after.profile).toEqual([{ id: first.ok ? first.value.id : '', name: 'sample', version: 'v1', added: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), via: 'publish' }]);
    expect({ ...after, profile: undefined }).toEqual({ ...person('seed'), profile: undefined });

    // A second publish refreshes the one entry in place rather than appending a duplicate.
    await writeFile(join(home, '.claude', 'skills', 'sample', 'SKILL.md'), `---\nname: sample\ndescription: useful skill\n---\n\n# v2\n`);
    const result = await run({ ref: 'sample', home, config: store }, new ScriptedPrompter());
    expect(result).toMatchObject({ ok: true, value: { profileAdded: true, version: 'v2' } });
    const file = JSON.parse(await show(fixture.bare, 'people/seed.json'));
    expect(file.profile).toEqual([{ id: result.ok ? result.value.id : '', name: 'sample', version: 'v2', added: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), via: 'publish' }]);
  });

  it('D77: an interactive publish does not ask either', async () => {
    const { fixture, store, home } = await prepared();
    await librarySkill(home);
    const interactive = new ScriptedPrompter([], [], true);
    expect(await run({ ref: 'sample', home, config: store }, interactive)).toMatchObject({ ok: true, value: { profileAdded: true } });
    expect(interactive.asked).toEqual([]);
    expect(JSON.parse(await show(fixture.bare, 'people/seed.json')).profile).toHaveLength(1);
  });

  it('D72: a folder that exists but the scan rejected is refused with its path and the scan’s detail, never "not found"', async () => {
    const { store, home } = await prepared();
    const odd = await librarySkill(home, 'odd', `---\nname: odd\ndescription: useful skill\nargument-hint: x\n---\n`);
    expect(await run({ ref: 'odd', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: false, error: `${odd} is not a usable skill folder: unsupported top-level field argument-hint (only name, description, license, metadata, allowed-tools)` });
    // The §6.3 miss is reserved for a name no Library root holds.
    expect(await run({ ref: 'ghost', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: false, error: expect.stringContaining('No local skill folder named ghost in your library.') });
  });

  it('resolves a folder the user already installed — the commonest thing publish is pointed at', async () => {
    const { store, home } = await prepared();
    const folder = await librarySkill(home, 'sample', published());
    await store.update((config) => { config.placements[folder] = { id: ID, team: 'team', version: 'v1', scope: { kind: 'global' }, placed_at: '2026-01-01', fingerprint: '' }; });
    await writeFile(join(folder, 'SKILL.md'), `${published()}\nlocal edit\n`);
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { id: ID, version: 'v1' } });
  });

  it('a refused push leaves origin/main where it was and the clone clean', async () => {
    const { fixture, store, clone, home } = await prepared();
    await librarySkill(home);
    const before = await originSha(fixture.bare);
    const denied: Runner = { run(command, args, options) {
      if (command === 'git' && args[0] === 'push') return Promise.resolve({ code: 1, stdout: '', stderr: 'remote: Permission to acme/team.git denied to seed.' });
      return systemRunner.run(command, args, options);
    } };
    expect(await run({ ref: 'sample', home, config: store, runner: denied }, new ScriptedPrompter())).toMatchObject({ ok: false, error: expect.stringContaining('denied') });
    expect(await originSha(fixture.bare)).toBe(before);
    expect((await git(['status', '--porcelain'], clone)).trim()).toBe('');
    // The §5.1 step 6b write-back is deliberately on the other side of this line: it already ran, and
    // re-deriving the same managed fields on the next attempt reproduces it byte for byte.
    expect(await readFile(join(home, '.claude', 'skills', 'sample', 'SKILL.md'), 'utf8')).toContain('license: UNLICENSED');
  });

  // --- B3 review fixes. Each of these fails on the pre-fix tree; see the comment on each. ---

  it('keeps a published name on its OWN uuid when the local SKILL.md has lost a managed field', async () => {
    const { fixture, store, home } = await prepared();
    await pushFromSeed(fixture.seed, 'skills/sample/v1/SKILL.md', published());
    // The author deleted the injected `license:` line. `skillFrontmatterSchema` is .strict(), so the
    // old `existingId` read this as not-ok and minted a FRESH uuid, orphaning every receipt, install
    // and profile entry keyed to ID.
    await librarySkill(home, 'sample', `---\nname: sample\ndescription: useful skill\nmetadata:\n  id: ${ID}\n  author: Seed <seed@example.com>\n  terum-category: testing\n---\n\n# changed\n`);
    const result = await run({ ref: 'sample', home, config: store }, new ScriptedPrompter([], [false]));
    expect(result).toMatchObject({ ok: true, value: { id: ID, version: 'v2' } });
  });

  it('mints a fresh uuid for a folder COPIED from another skill rather than grafting onto its identity', async () => {
    const { fixture, store, home } = await prepared();
    await pushFromSeed(fixture.seed, 'skills/sample/v1/SKILL.md', published());
    // `copy` is `sample`'s folder duplicated and renamed — it still declares sample's uuid. Publishing
    // it under the declared id put this skill's receipts into sample's eval history.
    await librarySkill(home, 'copy', published('copy'));
    const result = await run({ ref: 'copy', home, config: store }, new ScriptedPrompter([], [false]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.id).not.toBe(ID);
    expect(await show(fixture.bare, 'skills/sample/v1/SKILL.md')).toContain(`id: ${ID}`);
  });

  it('leaves the folder byte-identical when --project names a project that does not exist (OF-2)', async () => {
    const { store, home } = await prepared();
    const folder = await librarySkill(home);
    const before = await readFile(join(folder, 'SKILL.md'), 'utf8');
    const result = await run({ ref: 'sample', project: 'Nope', home, config: store }, new ScriptedPrompter([], [false]));
    expect(result.ok).toBe(false);
    // Pre-fix the write-back ran BEFORE chooseProject, so a typo rewrote the user's file on a publish
    // that never happened.
    expect(await readFile(join(folder, 'SKILL.md'), 'utf8')).toBe(before);
  });

  it('lets a newer PASS clear the D19 regression gate an older FAIL opened', async () => {
    const { store, home } = await prepared();
    const folder = await librarySkill(home);
    // v1 first: only after publish injects the managed fields do later receipts of this folder match
    // the digest publish computes (the existing §6.1 test above relies on the same ordering).
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true });
    await writeFile(join(folder, 'SKILL.md'), `${await readFile(join(folder, 'SKILL.md'), 'utf8')}\nmore\n`);
    await localReceipt(store, folder, { run_id: '20260101T000000Z', verdict: 'FAIL' });
    await localReceipt(store, folder, { run_id: '20260202T000000Z', verdict: 'PASS' });
    // Run ids sort ascending, so the old `.find(FAIL)` matched the OLDEST run: once any eval of these
    // bytes failed, no passing re-run could clear the gate. The prompter has no scripted confirm, so
    // if the gate still asks, this fails loudly rather than silently publishing.
    const result = await run({ ref: 'sample', home, config: store }, new ScriptedPrompter());
    expect(result).toMatchObject({ ok: true, value: { version: 'v2' } });
  });

  it('D61: says so when a local receipt could not be read, instead of failing the D19 gate open in silence', async () => {
    const { store, home } = await prepared();
    const folder = await librarySkill(home);
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true });
    await writeFile(join(folder, 'SKILL.md'), `${await readFile(join(folder, 'SKILL.md'), 'utf8')}\nmore\n`);
    const digest = await localReceipt(store, folder, { run_id: '20260101T000000Z', verdict: 'PASS' });
    // The NEWEST run for these bytes, and it is corrupt. D19 asks about the newest, so skipping it
    // silently is what decides whether the gate fires at all: a FAIL here would never be asked about.
    const broken = join(store.root, 'evals', 'local', digest.replace(/^sha256:/, ''), '20260303T000000Z');
    await mkdir(broken, { recursive: true });
    await writeFile(join(broken, 'receipt.json'), '{not json');
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store }, io)).toMatchObject({ ok: true, value: { version: 'v2' } });
    expect(io.lines).toContain('1 local eval run(s) of these exact bytes could not be read (20260303T000000Z), so they were not considered.');
  });
});


describe('B9 — first-publish category', () => {
  const categories = ['debugging', 'testing', 'docs', 'workflow', 'research', 'infra', 'review', 'misc'];
  async function categoryFixture(raw?: string, list: readonly string[] = categories) {
    const fixture = await prepared();
    await pushFromSeed(fixture.fixture.seed, 'team.json', JSON.stringify({ ...TEAM_JSON, categories: list }));
    const folder = await librarySkill(fixture.home, 'sample', raw);
    return { ...fixture, folder };
  }
  const agentFor = (answer: Record<string, unknown>): AgentApi => ({ askJson: vi.fn().mockResolvedValue(answer), runAgent: vi.fn() });

  /**
   * `categoryFixture` pushes the list to the BARE repo, so the machine's clone still holds the old
   * team.json until publish fetches — the stale-clone shape. This variant syncs the clone first, so
   * `publish` has the list on disk before its fetch and can start the model ask against it. That is
   * the ordinary state of a machine that has synced even once, and the only state the early ask runs in.
   */
  async function syncedCategoryFixture(list: readonly string[], raw?: string): Promise<Awaited<ReturnType<typeof categoryFixture>>> {
    const fixture = await categoryFixture(raw, list);
    await git(['fetch', 'origin'], fixture.clone);
    await git(['reset', '--hard', 'origin/main'], fixture.clone);
    return fixture;
  }
  /** A Runner that runs everything for real except `git fetch`, which waits on `gate` first. */
  const gatedFetch = (gate: Promise<unknown>, onFetch?: () => CommandResult | undefined): Runner => ({
    run: async (command, argv, options) => {
      if (command === 'git' && argv[0] === 'fetch') {
        const short = onFetch?.();
        await gate;
        if (short) return short;
      }
      return systemRunner.run(command, argv, options);
    },
  });

  it('asks the model while the fetch is still in flight, never after it', async () => {
    const { store, home } = await syncedCategoryFixture(['review', 'docs']);
    // The gate is released by the model call itself, so this deadlocks unless the ask really does
    // start before the fetch resolves. Publishing sequentially — fetch, then ask — cannot finish here.
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const agent: AgentApi = { runAgent: vi.fn(), askJson: vi.fn(async () => { release(); return { category: 'review' }; }) };
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, runner: gatedFetch(gate), agent }, io)).toMatchObject({ ok: true, value: { version: 'v1' } });
    expect(agent.askJson).toHaveBeenCalledTimes(1);
    expect(io.lines.join('\n')).toContain('metadata.terum-category: review (suggested from your SKILL.md; edit any time)');
  }, 30_000);

  it('asks again against the current list when the fetch retires the category it answered', async () => {
    // On disk: ['review']. On the remote, pushed after the clone synced: ['docs']. The early answer is
    // valid for the list it was asked with and gone from the one the fetch brings, so it is not used.
    const { fixture, store, home } = await syncedCategoryFixture(['review']);
    await pushFromSeed(fixture.seed, 'team.json', JSON.stringify({ ...TEAM_JSON, categories: ['docs'] }));
    const offered: string[][] = [];
    const agent: AgentApi = {
      runAgent: vi.fn(),
      askJson: vi.fn(async (prompt: string) => {
        const list = /choose one verbatim\): (.+?)\./.exec(prompt)![1]!.split(', ');
        offered.push(list);
        return { category: list[0] };
      }),
    };
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, agent }, io)).toMatchObject({ ok: true, value: { version: 'v1' } });
    expect(offered).toEqual([['review'], ['docs']]);
    expect(await show(fixture.bare, 'skills/sample/v1/SKILL.md')).toContain('terum-category: docs');
  });

  it('keeps the early answer when the fetch leaves it on the list, without a second call', async () => {
    const { fixture, store, home } = await syncedCategoryFixture(['review']);
    await pushFromSeed(fixture.seed, 'team.json', JSON.stringify({ ...TEAM_JSON, categories: ['review', 'docs'] }));
    const agent = agentFor({ category: 'review' });
    expect(await run({ ref: 'sample', home, config: store, agent }, new ScriptedPrompter())).toMatchObject({ ok: true });
    expect(agent.askJson).toHaveBeenCalledTimes(1);
    expect(await show(fixture.bare, 'skills/sample/v1/SKILL.md')).toContain('terum-category: review');
  });

  it('an unreachable model is the disclosed fallback, never a second wait on the same timeout', async () => {
    const { store, home } = await syncedCategoryFixture(['review']);
    const agent = agentFor({ category: 'review' });
    vi.mocked(agent.askJson).mockRejectedValue(new AgentRunError('offline'));
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, agent }, io)).toMatchObject({ ok: true });
    expect(agent.askJson).toHaveBeenCalledTimes(1);
    expect(io.lines.join('\n')).toContain("metadata.terum-category: misc (couldn't reach the model; edit SKILL.md any time)");
  });

  it('abandons a model call still running when the run fails before its answer is needed', async () => {
    // The ask never settles. Nothing may wait on it: the fetch failure is the result, and the signal
    // publish holds is what kills the `claude` child that would otherwise hold the process open.
    const { store, home } = await syncedCategoryFixture(['review']);
    let asked = (): void => {};
    const started = new Promise<void>((resolve) => { asked = resolve; });
    let observed: AbortSignal | undefined;
    const agent: AgentApi = {
      runAgent: vi.fn(),
      askJson: vi.fn(async (_prompt: string, options?: { signal?: AbortSignal }) => {
        observed = options?.signal;
        asked();
        return new Promise<Record<string, unknown>>(() => {});
      }),
    };
    const runner = gatedFetch(started, () => ({ code: 128, stdout: '', stderr: 'fatal: could not read from remote repository' }));
    const result = await run({ ref: 'sample', home, config: store, runner, agent }, new ScriptedPrompter());
    expect(result).toMatchObject({ ok: false });
    expect(observed?.aborted).toBe(true);
  }, 30_000);

  it('reports its step ladder, skipping the category rung a declared category makes unnecessary', async () => {
    const { store, home } = await syncedCategoryFixture(['review']);
    const asked = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, agent: agentFor({ category: 'review' }) }, asked)).toMatchObject({ ok: true });
    expect(asked.steps).toEqual(['Refreshing the team repository', 'Choosing a category', 'Checking sample', 'Publishing sample', 'Adding sample to your profile']);
    expect(asked.progressed[0]).toEqual({ step: 'Refreshing the team repository', current: 1, total: 5 });
    // Second publish: the category is now declared in the folder, so that rung never runs.
    const again = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store }, again)).toMatchObject({ ok: true });
    expect(again.steps).toEqual(['Refreshing the team repository', 'Checking sample', 'Publishing sample', 'Adding sample to your profile']);
  });

  it('suggests once, writes identical local and published bytes, then preserves category on republish', async () => {
    const { fixture, store, home, folder } = await categoryFixture();
    const agent = agentFor({ category: ' REVIEW ' });
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, agent }, io)).toMatchObject({ ok: true, value: { version: 'v1' } });
    expect(io.lines.join('\n')).toContain('metadata.terum-category: review (suggested from your SKILL.md; edit any time)');
    expect(io.lines.join('\n')).not.toContain('HYG7');
    const local = await readFile(join(folder, 'SKILL.md'), 'utf8');
    expect(local).toBe(await show(fixture.bare, 'skills/sample/v1/SKILL.md'));
    expect(local).toContain('terum-category: review');
    const again = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, agent }, again)).toMatchObject({ ok: true, value: { created: false, identicalTo: 'v1' } });
    expect(agent.askJson).toHaveBeenCalledTimes(1);
    expect(again.lines.join('\n')).not.toContain('metadata.terum-category:');
  });
  it.each(['offline', 'invalid'])('falls back visibly and still publishes when the answer is %s', async mode => {
    const { fixture, store, home } = await categoryFixture();
    const agent = agentFor({ category: 'invented' });
    if (mode === 'offline') vi.mocked(agent.askJson).mockRejectedValue(new AgentRunError('offline'));
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, agent }, io)).toMatchObject({ ok: true });
    expect(io.lines.join('\n')).toContain("metadata.terum-category: misc (couldn't reach the model; edit SKILL.md any time)");
    expect(await show(fixture.bare, 'skills/sample/v1/SKILL.md')).toContain('terum-category: misc');
    expect(agent.askJson).toHaveBeenCalledTimes(1);
  });
  it('uses the system askJson seam when no agent is supplied', async () => {
    const { store, home } = await categoryFixture();
    vi.mocked(systemAgent.askJson).mockResolvedValue({ category: 'docs' });
    expect(await run({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: true });
    expect(systemAgent.askJson).toHaveBeenCalledTimes(1);
  });
  it('the flag suppresses the model and off-list values warn without refusing', async () => {
    const { store, home } = await categoryFixture();
    const agent = agentFor({ category: 'review' });
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, agent, category: 'ops' }, io)).toMatchObject({ ok: true });
    expect(agent.askJson).not.toHaveBeenCalled();
    expect(io.lines.join('\n')).toContain('metadata.terum-category: ops (from --category; edit SKILL.md any time)');
    expect(io.lines.filter(line => line.startsWith('warning HYG7'))).toHaveLength(1);
  });
  it('declared category wins over flag and model, with HYG7 only at publish, never validate', async () => {
    const { store, home, folder } = await categoryFixture(published().replace('terum-category: testing', 'terum-category: ops'));
    const agent = agentFor({ category: 'review' });
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, agent, category: 'docs' }, io)).toMatchObject({ ok: true });
    expect(agent.askJson).not.toHaveBeenCalled();
    expect(io.lines.join('\n')).not.toContain('metadata.terum-category:');
    expect(io.lines.filter(line => line.startsWith('warning HYG7'))).toHaveLength(1);
    for (const target of [folder, 'sample']) {
      const checked = new ScriptedPrompter();
      expect(await validate({ target, config: store }, checked)).toMatchObject({ ok: true, value: { warnings: 0 } });
      expect(checked.lines.join('\n')).not.toContain('HYG7');
    }
    expect(systemAgent.askJson).not.toHaveBeenCalled();
  });
  it.each(['', '   '])('refuses blank --category %j before reading config or making any call', async category => {
    const store = createConfigStore('/unused-b9-test');
    const read = vi.spyOn(store, 'read').mockRejectedValue(new Error('must not read config'));
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', config: store, category }, io)).toEqual({ ok: false, error: '--category must be a non-empty name.' });
    expect(read).not.toHaveBeenCalled();
    expect(systemAgent.askJson).not.toHaveBeenCalled();
    expect(io.lines).toEqual([]);
  });
  // Hybrid review r1 (medium, publish.ts:98): the flag was stored untrimmed, so a trailing space from
  // shell history baked ` ops ` into the committed SKILL.md for the skill's whole lineage, and HYG7 —
  // which compared the same untrimmed string — warned about an off-list category whose trimmed
  // spelling was on the list. The flag now follows the model path (categorize.ts): trimmed, and in
  // the team's own spelling when it matches a team category case-insensitively; an off-list value is
  // kept trimmed as typed so HYG7's warning names what the user wrote.
  it.each([
    { flag: ' ops ', stored: 'ops', warnings: 0 },
    { flag: 'Ops', stored: 'ops', warnings: 0 },
    { flag: ' Nope ', stored: 'Nope', warnings: 1 },
  ])('stores --category $flag as $stored: trimmed, team spelling when on the list, HYG7 otherwise', async ({ flag, stored, warnings }) => {
    const { fixture, store, home, folder } = await categoryFixture(undefined, [...categories, 'ops']);
    const agent = agentFor({ category: 'review' });
    const io = new ScriptedPrompter();
    expect(await run({ ref: 'sample', home, config: store, agent, category: flag }, io)).toMatchObject({ ok: true, value: { version: 'v1' } });
    expect(agent.askJson).not.toHaveBeenCalled();
    expect(io.lines.join('\n')).toContain(`metadata.terum-category: ${stored} (from --category; edit SKILL.md any time)`);
    const hyg7 = io.lines.filter(line => line.startsWith('warning HYG7'));
    expect(hyg7).toHaveLength(warnings);
    if (warnings) expect(hyg7[0]).toContain(`terum-category \`${stored}\` is not one of your team's categories`);
    const local = await readFile(join(folder, 'SKILL.md'), 'utf8');
    expect(local).toBe(await show(fixture.bare, 'skills/sample/v1/SKILL.md'));
    expect(local).toContain(`terum-category: ${stored}\n`);
  });
});

describe('publish (many)', () => {
  it('publishes a selection in one push, one commit per skill, each with its own profile entry', async () => {
    const { fixture, store, home } = await prepared();
    await librarySkill(home, 'alpha');
    await librarySkill(home, 'beta');
    let pushes = 0;
    const counting: Runner = { run: async (command, commandArgs, options) => { if (command === 'git' && commandArgs[0] === 'push') pushes += 1; return systemRunner.run(command, commandArgs, options); } };
    const result = await runMany({ refs: ['alpha', 'beta'], home, config: store, runner: counting, category: 'testing' }, new NonInteractivePrompter());
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error(result.error);
    expect(result.value.map(entry => [entry.name, entry.version])).toEqual([['alpha', 'v1'], ['beta', 'v1']]);
    // The whole point: two skills, two commits, ONE push.
    expect(pushes).toBe(1);
    const log = (await git(['log', '--format=%s', 'main'], fixture.bare)).split('\n').filter(Boolean);
    // One commit per skill, in order, plus the single README regeneration a generic remote earns.
    expect(log.slice(0, 3)).toEqual(['seed: publish', 'seed: publish beta', 'seed: publish alpha']);
    expect(await show(fixture.bare, 'skills/alpha/v1/SKILL.md')).toContain('name: alpha');
    expect(await show(fixture.bare, 'skills/beta/v1/SKILL.md')).toContain('name: beta');
    // D77's profile entry rides in each skill's own commit rather than taking a push of its own.
    const profile = JSON.parse(await show(fixture.bare, 'people/seed.json')).profile;
    expect(profile.map((entry: { name: string }) => entry.name).sort()).toEqual(['alpha', 'beta']);
    expect(result.value.every(entry => entry.profileAdded)).toBe(true);
  });

  it('refuses the whole selection before any folder is written back', async () => {
    // OF-2 for a batch: a selection refused at one skill's refusal must leave EVERY folder
    // byte-identical, not just the ones after it. The managed-field write-back is the only thing a
    // publish does to the user's own files, and it must not happen for a run that never published.
    const { fixture, store, home } = await prepared();
    const alpha = await librarySkill(home, 'alpha');
    const before = await readFile(join(alpha, 'SKILL.md'), 'utf8');
    const head = await originSha(store.teamClone('team'));
    const result = await runMany({ refs: ['alpha', 'missing'], home, config: store, category: 'testing' }, new NonInteractivePrompter());
    expect(result).toMatchObject({ ok: false });
    // alpha prepared cleanly and would have been written back had the run continued.
    expect(await readFile(join(alpha, 'SKILL.md'), 'utf8')).toBe(before);
    expect(await originSha(store.teamClone('team'))).toBe(head);
    void fixture;
  });

  it('reports a selection that is already in the team as nothing to publish, and pushes nothing', async () => {
    const { fixture, store, home } = await prepared();
    await librarySkill(home, 'alpha');
    const first = await runMany({ refs: ['alpha'], home, config: store, category: 'testing' }, new NonInteractivePrompter());
    expect(first).toMatchObject({ ok: true });
    const before = await originSha(store.teamClone('team'));
    const io = new NonInteractivePrompter();
    const again = await runMany({ refs: ['alpha'], home, config: store, category: 'testing' }, io);
    expect(again).toMatchObject({ ok: true });
    if (!again.ok) throw new Error(again.error);
    expect(again.value[0]).toMatchObject({ name: 'alpha', version: null });
    expect(io.lines.some(line => line.includes('Nothing to publish: alpha'))).toBe(true);
    expect(await originSha(store.teamClone('team'))).toBe(before);
    void fixture;
  });
});

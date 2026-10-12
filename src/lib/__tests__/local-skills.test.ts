import * as fs from 'node:fs/promises';
import { chmod, mkdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import YAML from 'yaml';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { admitForEval, candidatesOf, createLibraryScan, expandRefPath, librarySize, localSkillCounts, localSkills, localSkillRoots, nearestRepoRoot, refIsPath, resolveLibrarySkill, unusableSkillFolder } from '../local-skills.js';
import { emptyConfig } from '../schema.js';
import { assertSkillSource } from '../skill-source.js';
import { BUNDLED_SKILL_SOURCE, SYMLINKS_SUPPORTED, temporaryDirectory } from './fixtures.js';

// Clone the ESM namespace so individual permission failures can be injected and restored.
vi.mock('node:fs/promises', async (importOriginal) => ({ ...await importOriginal<typeof import('node:fs/promises')>() }));

async function candidate(root: string, name: string, source = `---\nname: ${name}\ndescription: skill\n---\n`): Promise<string> {
  const path = join(root, name);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, 'SKILL.md'), source);
  return path;
}

// Preserve the old projection assertions while exercising the replacement inventory API.
// This adapter is test-only; production has one inventory and candidatesOf path.
async function candidateSummary(root: string, config: ReturnType<typeof emptyConfig>) {
  const inventory = await localSkills(root, config, { scope: 'global', stateRoot: join(root, '.state') });
  return {
    names: candidatesOf(inventory).map((entry) => entry.name),
    omitted: inventory.entries.flatMap((entry) => !entry.placement && entry.inspection.kind === 'rejected' ? [{ name: entry.name, reason: entry.inspection.detail }] : []),
    unreadable: inventory.problems.length + inventory.entries.filter((entry) => entry.inspection.kind === 'failed').length,
  };
}

describe('candidateSummary', () => {
  it('returns sorted candidates without requiring managed fields and silently skips absent roots or SKILL.md', async () => {
    const root = await temporaryDirectory();
    expect(await candidateSummary(join(root, 'absent'), emptyConfig())).toEqual({ names: [], omitted: [], unreadable: 0 });
    await candidate(root, 'zebra');
    await candidate(root, 'alpha');
    await mkdir(join(root, 'empty'));
    expect(await candidateSummary(root, emptyConfig())).toEqual({ names: ['alpha', 'zebra'], omitted: [{name:'empty',reason:'SKILL.md missing'}], unreadable: 0 });
  });

  it('excludes a placement', async () => {
    const root = await temporaryDirectory();
    const path = await candidate(root, 'placed');
    const config = emptyConfig();
    config.placements[path] = { id: '22222222-2222-4222-8222-222222222222', team: 'other', version: null, scope: { kind: 'global' }, placed_at: new Date().toISOString(), fingerprint: 'sha256:0' };
    expect(await candidateSummary(root, config)).toEqual({ names: [], omitted: [], unreadable: 0 });
  });

  it.each([
    ['gsd-x', '---\nname: gsd:x\n---\n', 'SKILL.md name gsd:x does not equal folder gsd-x'],
    ['plain', 'No frontmatter', 'SKILL.md has no YAML frontmatter'],
    ['broken', '---\nname: [\n---\n', `SKILL.md frontmatter is not valid YAML: ${YAML.parseDocument('name: [').errors[0]!.message}`],
    ['Bad', '---\nname: Bad\n---\n', 'folder name is not a legal skill name (1–64 lowercase alphanumerics or single hyphens)'],
  ])('omits %s with its validation reason', async (name, source, reason) => {
    const root = await temporaryDirectory();
    await candidate(root, name, source);
    const result = await candidateSummary(root, emptyConfig());
    expect(result).toEqual({ names: [], omitted: [{ name, reason }], unreadable: 0 });
    expect(result.omitted[0]?.reason).toBe(reason);
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('counts an unreadable candidate folder and continues', async () => {
    const root = await temporaryDirectory();
    const path = await candidate(root, 'blocked');
    await candidate(root, 'readable');
    await chmod(path, 0o000);
    try {
      expect(await candidateSummary(root, emptyConfig())).toEqual({ names: ['readable'], omitted: [], unreadable: 1 });
    } finally { await chmod(path, 0o700); }
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('counts an unreadable root once', async () => {
    const root = await temporaryDirectory();
    await chmod(root, 0o000);
    try {
      expect(await candidateSummary(root, emptyConfig())).toEqual({ names: [], omitted: [], unreadable: 1 });
    } finally { await chmod(root, 0o700); }
  });

  it('omits a directory-shaped SKILL.md with its reason instead of counting it unreadable (R.3: rejected, never an omission)', async () => {
    const root = await temporaryDirectory();
    await mkdir(join(root, 'broken', 'SKILL.md'), { recursive: true });
    expect(await candidateSummary(root, emptyConfig())).toEqual({ names: [], omitted: [{ name: 'broken', reason: 'SKILL.md is not a regular file' }], unreadable: 0 });
  });

  it.skipIf(process.platform === 'win32')('omits a symlinked entry with its reason rather than silently skipping it (R.3: discovery does not follow links)', async () => {
    const fixture = await temporaryDirectory();
    const root = join(fixture, 'skills');
    await mkdir(root);
    const path = await candidate(fixture, 'outside');
    await symlink(path, join(root, 'linked'));
    expect(await candidateSummary(root, emptyConfig())).toEqual({ names: [], omitted: [{ name: 'linked', reason: 'symbolic link' }], unreadable: 0 });
  });
});


describe('issue 9 local inventory', () => {
  it('does not offer a description-less source through the existing candidate API', async () => {
    const root = await temporaryDirectory();
    await candidate(root, 'missing', '---\nname: missing\n---\n');
    expect(await candidateSummary(root, emptyConfig())).toEqual({ names: [], omitted: [{ name: 'missing', reason: 'description is missing' }], unreadable: 0 });
  });

  it.skipIf(!SYMLINKS_SUPPORTED)('retains each inspection outcome and offers stock sources, with privileged sources only by opt-in', async () => {
    const root = await temporaryDirectory();
    await candidate(root, 'stock');
    await candidate(root, 'gsd-x', '---\nname: gsd:x\ndescription: x\n---\n');
    await candidate(root, 'missing', '---\nname: missing\n---\n');
    await candidate(root, 'yaml', '---\nname: [\n---\n');
    await candidate(root, 'unsupported', '---\nname: unsupported\ndescription: x\nargument-hint: x\n---\n');
    await candidate(root, 'grants', '---\nname: grants\ndescription: x\nallowed-tools: {bash: true}\n---\n');
    const hooks = await candidate(root, 'privileged'); await mkdir(join(hooks, 'hooks'));
    const nested = await candidate(root, 'nested'); await symlink(join(root, 'stock'), join(nested, 'link'));
    await symlink(join(root, 'stock'), join(root, 'linked'));
    await mkdir(join(root, 'empty'));
    const inventory = await localSkills(root, emptyConfig(), { scope: 'global', stateRoot: join(root, '.state') });
    expect(inventory).toMatchObject({ root, scope: 'global', rootState: 'scanned', problems: [] });
    expect(inventory.entries.map((entry) => [entry.name, entry.inspection.kind === 'rejected' ? entry.inspection.reason : entry.inspection.kind])).toEqual([
      ['empty','skill-md-missing'], ['grants', 'malformed-allowed-tools'], ['gsd-x', 'name-mismatch'], ['linked', 'symlink'], ['missing', 'description-missing'],
      ['nested', 'nested-symlink'], ['privileged', 'candidate'], ['stock', 'candidate'], ['unsupported', 'unsupported-field'], ['yaml', 'invalid-yaml'],
    ]);
    expect(inventory.entries.find((entry) => entry.name === 'stock')?.inspection).toEqual({ kind: 'candidate', description: 'skill', privileged: false });
    expect(inventory.entries.find((entry) => entry.name === 'privileged')?.inspection).toEqual({ kind: 'candidate', description: 'skill', privileged: true });
    expect(candidatesOf(inventory).map((entry) => entry.name)).toEqual(['stock']);
    expect(candidatesOf(inventory, true).map((entry) => entry.name)).toEqual(['privileged', 'stock']);
  });

  it('keeps a placement whose SKILL.md vanished', async () => {
    const root = await temporaryDirectory(); const path = join(root, 'missing'); await mkdir(path);
    const config = emptyConfig();
    config.placements[path] = { id: '33333333-3333-4333-8333-333333333333', team: 'three', version: null, scope: { kind: 'global' }, placed_at: '', fingerprint: '' };
    expect((await localSkills(root, config, { scope: 'global', stateRoot: join(root, '.state') })).entries).toEqual([{ frontmatter: null, skillId: null, category: null, name: 'missing', path, placement: { id: config.placements[path]!.id, team: 'three', version: null }, placementFingerprint: '', inspection: { kind: 'rejected', reason: 'skill-md-missing', detail: 'SKILL.md missing' } }]);
  });

  it('distinguishes an absent root from a scanned empty root', async () => {
    const root = await temporaryDirectory();
    expect(await localSkills(join(root, 'absent'), emptyConfig(), { scope: 'global', stateRoot: join(root, '.state') })).toEqual({ root: join(root, 'absent'), scope: 'global', rootState: 'absent', entries: [], problems: [] });
    expect(await localSkills(root, emptyConfig(), { scope: 'global', stateRoot: join(root, '.state') })).toEqual({ root, scope: 'global', rootState: 'scanned', entries: [], problems: [] });
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('retains an unreadable file and root as failures', async () => {
    const root = await temporaryDirectory(); const path = await candidate(root, 'blocked');
    await chmod(join(path, 'SKILL.md'), 0o000);
    try {
      expect((await localSkills(root, emptyConfig(), { scope: 'global', stateRoot: join(root, '.state') })).entries[0]?.inspection).toEqual({ kind: 'failed', reason: expect.stringContaining('EACCES') });
    } finally { await chmod(join(path, 'SKILL.md'), 0o600); }
    await chmod(root, 0o000);
    try {
      expect(await localSkills(root, emptyConfig(), { scope: 'global', stateRoot: join(root, '.state') })).toMatchObject({ rootState: 'unreadable', entries: [], problems: [{ path: root, reason: expect.stringContaining('EACCES') }] });
    } finally { await chmod(root, 0o700); }
  });
});


describe('project local discovery (Ryan 2026-09-06)', () => {
  // §7.2 deleted the cwd-detected Library root, so localSkillRoots no longer walks. `nearestRepoRoot`
  // survives — it is what `project add` and setup's folder picker default to — and keeps its own tests.
  it.each(['directory', 'file'])('nearestRepoRoot walks up from a subdirectory to a .git %s without reading the marker', async (kind) => {
    const home = await temporaryDirectory(); const repo = join(home, 'repo'); const cwd = join(repo, 'src', 'deep');
    await mkdir(cwd, { recursive: true });
    if (kind === 'file') await writeFile(join(repo, '.git'), 'not a readable gitdir reference');
    else await mkdir(join(repo, '.git'));
    expect(await nearestRepoRoot(cwd)).toBe(repo);
  });

  it('nearestRepoRoot stops at the inner repository', async () => {
    const home = await temporaryDirectory(); const outer = join(home, 'outer'); const inner = join(outer, 'inner'); const cwd = join(inner, 'src');
    await mkdir(cwd, { recursive: true }); await mkdir(join(outer, '.git')); await writeFile(join(inner, '.git'), 'gitdir: ignored');
    expect(await nearestRepoRoot(cwd)).toBe(inner);
  });

  it('nearestRepoRoot reports nothing when no ancestor is a repository', async () => {
    const home = await temporaryDirectory(); const cwd = join(home, 'outside'); await mkdir(cwd);
    expect(await nearestRepoRoot(cwd)).toBeUndefined();
  });

  it('is global-only with no registered projects (regression: never uses the process cwd)', async () => {
    const home = await temporaryDirectory(); await mkdir(join(home, '.git'));
    expect(await localSkillRoots(home)).toEqual({ roots: [{ root: join(home, '.claude', 'skills'), scope: 'global', registered: false }], problems: [] });
  });

  it('nearestRepoRoot reports EACCES in the upward walk without claiming a repository', async () => {
    const home = await temporaryDirectory(); const cwd = join(home, 'private'); await mkdir(cwd);
    const original = fs.lstat; const marker = join(cwd, '.git');
    const problems: { path: string; reason: string }[] = [];
    const spy = vi.spyOn(fs, 'lstat').mockImplementation(async (...args) => {
      if (args[0] === marker) throw Object.assign(new Error('EACCES: blocked marker'), { code: 'EACCES' });
      return original(...args);
    });
    try {
      expect(await nearestRepoRoot(cwd, problems)).toBeUndefined();
      expect(problems).toEqual([{ path: marker, reason: 'EACCES: blocked marker' }]);
    } finally { spy.mockRestore(); }
  });

  it('deduplicates a home project with global precedence', async () => {
    const home = await temporaryDirectory(); await mkdir(join(home, '.git'));
    await candidate(join(home, '.claude', 'skills'), 'local');
    expect(await localSkillRoots(home, [{ root: home, label: 'home' }])).toEqual({ roots: [{ root: join(home, '.claude', 'skills'), scope: 'global', registered: false }], problems: [] });
  });

  it.skipIf(!SYMLINKS_SUPPORTED).each(['alias-to-real', 'real-to-alias', 'deduplicated-alias'])('joins both ledgers through canonical parents: %s', async (direction) => {
    const base = await temporaryDirectory(); const home = join(base, 'real'); const alias = join(base, 'alias');
    const root = join(home, '.claude', 'skills'); const path = await candidate(root, 'tracked');
    await symlink(home, alias); await mkdir(join(home, '.git'));
    const aliasRoot = join(alias, '.claude', 'skills');
    const reference = direction === 'real-to-alias' ? path : join(aliasRoot, 'tracked');
    const scannedRoot = direction === 'real-to-alias' ? aliasRoot : root;
    const config = emptyConfig();
    config.placements[reference] = { id: 'placed', team: 'two', version: null, scope: { kind: 'global' }, fingerprint: '', placed_at: '' };
    if (direction === 'deduplicated-alias') expect((await localSkillRoots(home, [{ root: alias, label: 'alias' }])).roots).toEqual([{ root, scope: 'global', registered: false }]);
    await symlink(path, join(root, 'child-link'));
    const inventory = await localSkills(scannedRoot, config, { scope: 'global', stateRoot: join(base, 'state') });
    expect(inventory.entries.find((entry) => entry.name === 'tracked')).toMatchObject({ placement: { id: 'placed', team: 'two' } });
    expect(inventory.entries.find((entry) => entry.name === 'child-link')).toMatchObject({ inspection: { kind: 'rejected', reason: 'symlink' } });
    expect(candidatesOf(inventory)).toEqual([]);
  });

  it.skipIf(!SYMLINKS_SUPPORTED)('excludes canonical state-root entries but retains tracked provenance and project scope', async () => {
    const home = await temporaryDirectory(); const stateRoot = join(home, 'state'); const root = join(stateRoot, 'sources');
    await candidate(root, 'untracked'); await candidate(root, 'tracked');
    const alias = join(home, 'alias'); await symlink(root, alias);
    const config = emptyConfig();
    const inventory = await localSkills(alias, config, { scope: 'project', stateRoot });
    expect(inventory.scope).toBe('project');
    expect(inventory.entries.map((entry) => entry.inspection)).toEqual([0, 1].map(() => ({ kind: 'rejected', reason: 'inside-state-root', detail: `inside the terum-skills state directory ${stateRoot}` })));
    expect(candidatesOf(inventory, true)).toEqual([]);
  });
});

describe('a bundled terum-skills skill is not a team skill', () => {
  it('discovery rejects it with its own reason under any folder name, and connect refuses it', async () => {
    const root = await temporaryDirectory();
    const bundled = await readFile(BUNDLED_SKILL_SOURCE, 'utf8');
    await candidate(root, 'terum-skills', bundled);
    await candidate(root, 'renamed-copy', bundled);
    await candidate(root, 'list-skills', '---\nname: list-skills\ndescription: a marked copy\nmetadata:\n  managed-by: terum-skills\n---\n');
    await candidate(root, 'plain');
    const inventory = await localSkills(root, emptyConfig(), { scope: 'global', stateRoot: join(root, '.state') });
    const rejected = { kind: 'rejected', reason: 'managed-wrapper', detail: 'a terum-skills skill that ships with terum-skills; not a team skill' };
    for (const name of ['terum-skills', 'renamed-copy', 'list-skills']) {
      const inspection = inventory.entries.find((entry) => entry.name === name)?.inspection;
      expect(inspection).toMatchObject(rejected);
      // Refused for connect, still readable: the wrapper's frontmatter parsed, so the description
      // it found survives the rejection. Its wording is the shipped file's and is not pinned here.
      expect(inspection?.kind === 'rejected' && inspection.description).toBeTruthy();
    }
    expect(candidatesOf(inventory, true).map((entry) => entry.name)).toEqual(['plain']);
    expect(() => assertSkillSource(bundled, 'terum-skills')).toThrow('This folder is a terum-skills skill that ships with terum-skills and is placed by setup; it cannot be connected to a team.');
  });
});


describe('a rejected folder reports the description its frontmatter parsed to', () => {
  it('recovers it for a name mismatch, and leaves it undefined when nothing parsed', async () => {
    const root = await temporaryDirectory();
    // The gsd-* shape: legal YAML, a real description, a namespaced name the folder cannot match.
    await candidate(root, 'name-mismatch', '---\nname: gsd:add-backlog\ndescription: "Add an idea to the backlog"\n---\n');
    await candidate(root, 'unsupported', '---\nname: unsupported\ndescription: Has an extra field\nargument-hint: "<x>"\n---\n');
    const brokenYaml = '---\nname: broken-yaml\ndescription: Args: <spec-path> unquoted\n---\n';
    await candidate(root, 'broken-yaml', brokenYaml);
    await candidate(root, 'no-description', '---\nname: no-description\n---\n');
    const inventory = await localSkills(root, emptyConfig(), { scope: 'global', stateRoot: join(root, '.state') });
    const described = (name: string): string | undefined => {
      const inspection = inventory.entries.find((entry) => entry.name === name)?.inspection;
      return inspection?.kind === 'rejected' ? inspection.description : undefined;
    };
    expect(described('name-mismatch')).toBe('Add an idea to the backlog');
    expect(described('unsupported')).toBe('Has an extra field');
    // Nothing parsed, so nothing is reconstructed; a blank description is the honest report.
    expect(described('broken-yaml')).toBeUndefined();
    expect(described('no-description')).toBeUndefined();
    // The character count is the whole SKILL.md, recorded even when the folder is rejected.
    expect(inventory.entries.find((entry) => entry.name === 'broken-yaml')?.characters).toBe(brokenYaml.length);
  });
});

describe('project roots CLI-1 (§7.1)', () => {
  it.skipIf(!SYMLINKS_SUPPORTED)('lists the added projects in order, carrying their labels, and deduplicates aliases and home', async () => {
    const home = await temporaryDirectory();
    const a = join(home, 'a'), b = join(home, 'b');
    for (const root of [a, b]) await mkdir(join(root, '.git'), { recursive: true });
    const alias = join(home, 'alias'); await symlink(a, alias);
    const roots = (await localSkillRoots(home, [a, home, alias, b].map((root) => ({ root, label: root })))).roots;
    expect(roots).toEqual([
      { root: join(home, '.claude', 'skills'), scope: 'global', registered: false },
      ...[a, b].map(repoRoot => ({ root: join(repoRoot, '.claude', 'skills'), scope: 'project', repoRoot, registered: true, label: repoRoot })),
    ]);
  });
  it.each([false, true])('retains an absent project root (folder exists: %s)', async (exists) => {
    const home = await temporaryDirectory(); const repo = join(home, 'project');
    if (exists) await mkdir(repo);
    const roots = (await localSkillRoots(home, [{ root: repo, label: 'project' }])).roots;
    expect(roots).toHaveLength(2);
    expect(await localSkills(roots[1]!.root, emptyConfig(), { scope: 'project', stateRoot: join(home, 'state') })).toMatchObject({ rootState: 'absent', entries: [] });
  });
});


describe('W-02 parallel folder scan', () => {
  it('realpaths the root exactly once per call, not once per folder', async () => {
    const root = await temporaryDirectory();
    for (let i=0;i<30;i++) await candidate(root, `skill-${i}`);
    const spy = vi.spyOn(fs, 'realpath');
    try { await localSkills(root, emptyConfig(), { scope: 'global', stateRoot: join(root, '.state') }); expect(spy.mock.calls).toEqual([[root]]); }
    finally { spy.mockRestore(); }
  });
  it.skipIf(!SYMLINKS_SUPPORTED)('returns the same entries, in the same order, as a sequential scan', async () => {
    const root = await temporaryDirectory();
    const names = ['a','B','a-10','a-2','Z',...Array.from({length:25},(_,i)=>`skill-${i}`)];
    for (const name of names) await candidate(root,name);
    await writeFile(join(root,'plain'),'file'); await mkdir(join(root,'empty'));
    await mkdir(join(root,'directory','SKILL.md'),{recursive:true});
    await candidate(root,'invalid','---\nname: [\n---\n'); await symlink(join(root,'a'),join(root,'linked'));
    const inventory = await localSkills(root,emptyConfig(),{scope:'global',stateRoot:join(root,'.state')});
    expect(inventory.entries.map(e=>e.name)).toEqual((await fs.readdir(root)).sort());
    // `updated` is SKILL.md's mtime, so its value is the clock, not the fixture — but it must still be a
    // real ISO-8601 instant (the app's sort and relativeTime both Date.parse it), never merely a string.
    const isoInstant = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) as unknown as string;
    const expected = names.sort().map(name=>({body:'',frontmatter:`---\nname: ${name}\ndescription: skill\n---`,skillId:null,category:null,name,path:join(root,name),updated:isoInstant,characters:`---\nname: ${name}\ndescription: skill\n---\n`.length,inspection: name==='B'||name==='Z'?{kind:'rejected',reason:'illegal-name',detail:'folder name is not a legal skill name (1–64 lowercase alphanumerics or single hyphens)'}:{kind:'candidate',description:'skill',privileged:false}}));
    expect(inventory).toEqual({root,scope:'global',rootState:'scanned',problems:[],entries:[...expected,
      {frontmatter:null,skillId:null,category:null,name:'empty',path:join(root,'empty'),inspection:{kind:'rejected',reason:'skill-md-missing',detail:'SKILL.md missing'}},
      {frontmatter:null,skillId:null,category:null,name:'plain',path:join(root,'plain'),inspection:{kind:'rejected',reason:'not-a-directory',detail:'not a directory'}},
      {frontmatter:null,skillId:null,category:null,name:'directory',path:join(root,'directory'),inspection:{kind:'rejected',reason:'skill-md-not-a-file',detail:'SKILL.md is not a regular file'}},
      {body:'',frontmatter:'---\nname: [\n---',skillId:null,category:null,name:'invalid',path:join(root,'invalid'),updated:isoInstant,characters:'---\nname: [\n---\n'.length,inspection:{kind:'rejected',reason:'invalid-yaml',detail:`SKILL.md frontmatter is not valid YAML: ${YAML.parseDocument('name: [').errors[0]!.message}`}},
      {frontmatter:null,skillId:null,category:null,name:'linked',path:join(root,'linked'),inspection:{kind:'rejected',reason:'symlink',detail:'symbolic link'}},
    ].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)});
  });
  // RM-38: the app's Library sorts local folders by "recently updated", so a local row needs an honest
  // last-changed stamp. It is SKILL.md's own mtime and nothing else — no folder walk, no synthesised now().
  it.skipIf(!SYMLINKS_SUPPORTED)('stamps each readable SKILL.md with its own mtime and leaves every other entry unstamped', async () => {
    const root = await temporaryDirectory();
    const fresh = await candidate(root, 'fresh');
    const stale = await candidate(root, 'stale');
    await mkdir(join(root, 'empty'));
    await mkdir(join(root, 'directory', 'SKILL.md'), { recursive: true });
    await writeFile(join(root, 'plain'), 'file');
    await symlink(join(root, 'fresh'), join(root, 'linked'));
    const staleTime = new Date('2024-03-04T05:06:07.000Z');
    await fs.utimes(join(stale, 'SKILL.md'), staleTime, staleTime);
    const inventory = await localSkills(root, emptyConfig(), { scope: 'global', stateRoot: join(root, '.state') });
    const updatedOf = (name: string) => inventory.entries.find((entry) => entry.name === name)?.updated;
    expect(updatedOf('stale')).toBe('2024-03-04T05:06:07.000Z');
    const freshStamp = updatedOf('fresh');
    expect(freshStamp).toBe((await fs.stat(join(fresh, 'SKILL.md'))).mtime.toISOString());
    expect(Number.isFinite(Date.parse(freshStamp ?? ''))).toBe(true);
    // No SKILL.md file to stat: the field is absent, never a fabricated date.
    for (const name of ['empty', 'directory', 'plain', 'linked']) expect(updatedOf(name)).toBeUndefined();
  });

  it('reports a folder whose lstat fails as failed without aborting its siblings', async () => {
    const root=await temporaryDirectory(); for(let i=0;i<12;i++)await candidate(root,`skill-${i}`);
    const original=fs.lstat; const spy=vi.spyOn(fs,'lstat').mockImplementation(async (...args)=>{if(args[0]===join(root,'skill-5'))throw Object.assign(new Error('EACCES: permission denied'),{code:'EACCES'});return original(...args);});
    try {const inventory=await localSkills(root,emptyConfig(),{scope:'global',stateRoot:join(root,'.state')});expect(inventory.entries.find(e=>e.name==='skill-5')?.inspection).toEqual({kind:'failed',reason:'EACCES: permission denied'});expect(inventory.entries.filter(e=>e.inspection.kind==='candidate')).toHaveLength(11);}
    finally{spy.mockRestore();}
  });
  it('keeps the undefined canonical path when the root cannot be realpathed', async () => {
    const root=await temporaryDirectory();const path=await candidate(root,'placed');const config=emptyConfig();config.placements[path]={id:'placed',team:'team',version:null,scope:{kind:'global'},fingerprint:'',placed_at:''};
    const original=fs.realpath;const spy=vi.spyOn(fs,'realpath').mockImplementation(async (...args)=>{if(args[0]===root)throw Object.assign(new Error('gone'),{code:'ENOENT'});return original(...args);});
    try{expect((await localSkills(root,config,{scope:'global',stateRoot:join(root,'.state')})).entries[0]?.placement).toEqual({id:'placed',team:'team',version:null});}finally{spy.mockRestore();}
  });
  it('scans a root of 200 folders', async () => {
    const root=await temporaryDirectory();const names=Array.from({length:200},(_,i)=>`skill-${i}`);for(const name of names)await candidate(root,name);
    expect((await localSkills(root,emptyConfig(),{scope:'global',stateRoot:join(root,'.state')})).entries.map(e=>e.name)).toEqual(names.sort());
  });
});

describe('run-local library inventory reuse', () => {
  it.skipIf(!SYMLINKS_SUPPORTED).each([false, true])('matches fresh counts without another walk (unreadable root: %s)', async unreadable => {
    const home = await temporaryDirectory();
    const global = join(home, '.claude', 'skills');
    const checkout = join(home, 'project');
    const project = join(checkout, '.claude', 'skills');
    const stateRoot = join(home, '.terum', 'skills');
    const config = emptyConfig();
    config.projects = [{ root: checkout, label: 'project' }, { root: join(home, 'absent'), label: 'absent' }];
    await candidate(global, 'alpha');
    await candidate(global, 'bad-frontmatter', '---\nname: different\ndescription: skill\n---\n');
    await candidate(project, 'beta');
    await mkdir(join(global, 'not-a-skill'));
    await symlink(join(global, 'alpha'), join(global, 'link'));
    // §7.4(b): a plain file is scanned (entries mirror readdir) but is not a skill folder, so it never counts.
    await writeFile(join(global, '.DS_Store'), '');
    const original = fs.readdir;
    const reads = vi.spyOn(fs, 'readdir').mockImplementation((...args) => {
      if (unreadable && args[0] === project) return Promise.reject(Object.assign(new Error('permission denied'), { code: 'EACCES' }));
      return original(...args);
    });
    try {
      const scan = createLibraryScan(home, config.projects ?? [], stateRoot);
      expect(reads).not.toHaveBeenCalled();
      const roots = await scan.roots();
      for (const root of roots) await scan.inventory(root, config);
      for (const root of roots) expect(reads.mock.calls.filter(([path]) => path === root.root)).toHaveLength(1);
      reads.mockClear();
      const reused = await librarySize(home, config, stateRoot, scan);
      expect(reads).not.toHaveBeenCalled();
      expect(reused).toBe(unreadable ? null : 5);
      expect(await librarySize(home, config, stateRoot)).toBe(reused);
      expect(reads.mock.calls.filter(([path]) => path === global)).toHaveLength(1);
      expect(reads.mock.calls.filter(([path]) => path === project)).toHaveLength(1);
    } finally { reads.mockRestore(); }
  });

  it.skipIf(!SYMLINKS_SUPPORTED)('rebinds placement provenance through aliases without rescanning or mutating the snapshot', async () => {
    const home = await temporaryDirectory();
    const root = join(home, '.claude', 'skills');
    const source = await candidate(root, 'alpha');
    const placed = await candidate(root, 'beta');
    const alias = join(home, 'alias');
    await symlink(root, alias);
    const config = emptyConfig();
    const scan = createLibraryScan(home, [], join(home, '.terum', 'skills'));
    const [global] = await scan.roots();
    const before = await scan.inventory(global!, config);
    const current = structuredClone(config);
    current.placements[join(alias, 'beta')] = {
      id: 'second', team: 'team', version: null, fingerprint: 'sha256:0',
      scope: { kind: 'global' }, placed_at: new Date().toISOString(),
    };
    const reads = vi.spyOn(fs, 'readdir');
    try {
      const inventory = await scan.inventory(global!, current);
      expect(candidatesOf(inventory).map(entry => entry.path)).toEqual([source]);
      expect(candidatesOf(before).map(entry => entry.path)).toEqual([source, placed]);
      expect(inventory.entries[1]?.placement).toEqual({ id: 'second', team: 'team', version: null });
      expect(await librarySize(home, current, join(home, '.terum', 'skills'), scan)).toBe(2);
      expect(reads).not.toHaveBeenCalled();
      expect(candidatesOf(await scan.inventory(global!, emptyConfig()))).toHaveLength(2);
    } finally { reads.mockRestore(); }
  });
});

describe('resolveLibrarySkill (D72)', () => {
  it('returns a folder that exists but the scan rejected, carrying the scan’s own verdict', async () => {
    const home = await temporaryDirectory();
    const root = join(home, '.claude', 'skills');
    const path = await candidate(root, 'unsupported', '---\nname: unsupported\ndescription: x\nargument-hint: x\n---\n');
    const match = await resolveLibrarySkill(home, emptyConfig(), join(home, '.state'), 'unsupported');
    expect(match).toEqual({ name: 'unsupported', path, libraryRoot: root, inspection: { kind: 'rejected', reason: 'unsupported-field', detail: 'unsupported top-level field argument-hint (only name, description, license, metadata, allowed-tools)', description: 'x' } });
    expect(unusableSkillFolder(match!)).toBe(`${path} is not a usable skill folder: unsupported top-level field argument-hint (only name, description, license, metadata, allowed-tools)`);
    // A candidate carries no refusal, and a name no root holds is still undefined — the §6.3 miss.
    const stock = await candidate(root, 'stock');
    const usable = await resolveLibrarySkill(home, emptyConfig(), join(home, '.state'), 'stock');
    expect(usable).toMatchObject({ path: stock, inspection: { kind: 'candidate' } });
    expect(unusableSkillFolder(usable!)).toBeUndefined();
    expect(await resolveLibrarySkill(home, emptyConfig(), join(home, '.state'), 'ghost')).toBeUndefined();
  });

  it('prefers a usable folder in a later root over a rejected one in an earlier root', async () => {
    const home = await temporaryDirectory();
    await candidate(join(home, '.claude', 'skills'), 'dup', '---\nname: dup\n---\n');
    const project = await temporaryDirectory();
    const usable = await candidate(join(project, '.claude', 'skills'), 'dup');
    const config = { ...emptyConfig(), projects: [{ root: project, label: 'project' }] };
    expect(await resolveLibrarySkill(home, config, join(home, '.state'), 'dup')).toMatchObject({ path: usable, libraryRoot: join(project, '.claude', 'skills'), inspection: { kind: 'candidate' } });
    // Only when no root offers a usable folder does the rejected one come back, with its detail.
    expect(await resolveLibrarySkill(home, emptyConfig(), join(home, '.state'), 'dup')).toMatchObject({ libraryRoot: join(home, '.claude', 'skills'), inspection: { kind: 'rejected', reason: 'description-missing' } });
  });

  // The desktop passes the Library card's PATH for a skill the team has never seen (SkillScreen,
  // RunEvalDialog), and a name cannot tell two roots' same-named folders apart — so a ref may be a
  // folder path. The roots stay the only place a ref can land.
  it.skipIf(!SYMLINKS_SUPPORTED)('resolves a folder path — absolute, ~-prefixed, relative, or through a realpath alias — to the entry it names', async () => {
    const home = await temporaryDirectory();
    const root = join(home, '.claude', 'skills');
    const global = await candidate(root, 'dup');
    const project = await temporaryDirectory();
    const inProject = await candidate(join(project, '.claude', 'skills'), 'dup');
    const config = { ...emptyConfig(), projects: [{ root: project, label: 'project' }] };
    const state = join(home, '.state');
    // By name the FIRST usable root wins and the project's copy is unreachable; by path each folder is
    // reachable on its own — the ambiguity the path grammar exists to resolve.
    expect(await resolveLibrarySkill(home, config, state, 'dup')).toMatchObject({ path: global });
    expect(await resolveLibrarySkill(home, config, state, global)).toMatchObject({ name: 'dup', path: global, libraryRoot: root, inspection: { kind: 'candidate' } });
    expect(await resolveLibrarySkill(home, config, state, inProject)).toMatchObject({ path: inProject, libraryRoot: join(project, '.claude', 'skills') });
    // `~` expands to the Library's home, not the shell's, and a trailing slash is harmless.
    expect(await resolveLibrarySkill(home, config, state, '~/.claude/skills/dup')).toMatchObject({ path: global });
    expect(await resolveLibrarySkill(home, config, state, `${global}/`)).toMatchObject({ path: global });
    // A relative path resolves against the process cwd.
    expect(await resolveLibrarySkill(home, config, state, relative(process.cwd(), global))).toMatchObject({ path: global });
    // The same folder through its realpath (macOS: /var → /private/var) or through a symlinked root.
    const real = await realpath(global);
    expect(await resolveLibrarySkill(home, config, state, real)).toMatchObject({ path: global });
    const alias = join(await temporaryDirectory(), 'alias');
    await symlink(root, alias, 'dir');
    expect(await resolveLibrarySkill(home, config, state, join(alias, 'dup'))).toMatchObject({ path: global });
    // A rejected folder named by path still comes back with the scan's verdict, never as a miss.
    const broken = await candidate(root, 'broken', '---\nname: broken\n---\n');
    expect(await resolveLibrarySkill(home, config, state, broken)).toMatchObject({ path: broken, inspection: { kind: 'rejected', reason: 'description-missing' } });
  });

  it('refuses a path outside every Library root, a path to a folder that does not exist, and the root itself', async () => {
    const home = await temporaryDirectory();
    const root = join(home, '.claude', 'skills');
    await candidate(root, 'stock');
    const elsewhere = await candidate(join(await temporaryDirectory(), 'skills'), 'stock');
    const state = join(home, '.state');
    expect(await resolveLibrarySkill(home, emptyConfig(), state, elsewhere)).toBeUndefined();
    expect(await resolveLibrarySkill(home, emptyConfig(), state, join(root, 'ghost'))).toBeUndefined();
    expect(await resolveLibrarySkill(home, emptyConfig(), state, root)).toBeUndefined();
    expect(await resolveLibrarySkill(home, emptyConfig(), state, '~')).toBeUndefined();
    // The two grammars never overlap: a legal skill name is never read as a path.
    expect(refIsPath('stock')).toBe(false); expect(refIsPath('my-skill-2')).toBe(false);
    for (const ref of ['~', '~/x', '/x', './x', 'a/b', `a${sep}b`]) expect(refIsPath(ref)).toBe(true);
    expect(expandRefPath('~/.claude/skills/x', home)).toBe(join(home, '.claude', 'skills', 'x'));
    expect(expandRefPath('~', home)).toBe(resolve(home));
  });
});

describe('admitForEval: Claude Code skill fields, for eval only', () => {
  const resolved = async (source: string) => {
    const home = await temporaryDirectory();
    const path = await candidate(join(home, '.claude', 'skills'), 'explore', source);
    return { path, match: (await resolveLibrarySkill(home, emptyConfig(), join(home, '.state'), 'explore'))! };
  };

  it('turns a folder the scan refused only for Claude Code fields into a candidate, and leaves the scan’s own verdict alone', async () => {
    const { match } = await resolved('---\nname: explore\ndescription: Read-only exploration\nmodel: haiku\ncontext: fork\nagent: Explore\n---\n');
    // The Library scan, `ls` and publish still see the rejection.
    expect(match.inspection).toMatchObject({ kind: 'rejected', reason: 'unsupported-field', detail: 'unsupported top-level field model (only name, description, license, metadata, allowed-tools)' });
    expect(await admitForEval(match)).toEqual({ ...match, inspection: { kind: 'candidate', description: 'Read-only exploration', privileged: false } });
  });

  it('names the key eval still refuses: hooks with its reason, any other key with the list eval accepts', async () => {
    const hooks = await resolved('---\nname: explore\ndescription: x\nmodel: haiku\nhooks:\n  Stop: []\n---\n');
    expect(unusableSkillFolder(await admitForEval(hooks.match))).toBe(`${hooks.path} is not a usable skill folder: unsupported top-level field hooks (hooks register commands that run on this machine, so eval does not run a skill that declares them)`);
    const unknown = await resolved('---\nname: explore\ndescription: x\nfoo: x\n---\n');
    expect(unusableSkillFolder(await admitForEval(unknown.match))).toBe(`${unknown.path} is not a usable skill folder: unsupported top-level field foo (eval accepts name, description, license, metadata, allowed-tools, model, effort, context, agent, background, disallowed-tools, argument-hint, arguments, disable-model-invocation, user-invocable, when_to_use)`);
  });

  it('runs the grant check the scan stopped before', async () => {
    const { match } = await resolved('---\nname: explore\ndescription: x\nmodel: haiku\nallowed-tools:\n  bash: true\n---\n');
    expect(await admitForEval(match)).toMatchObject({ inspection: { kind: 'rejected', reason: 'malformed-allowed-tools', detail: 'allowed-tools is malformed (SKILL.md line 5)' } });
  });

  it.skipIf(!SYMLINKS_SUPPORTED)('runs the nested-symlink check the scan stopped before', async () => {
    const { path, match } = await resolved('---\nname: explore\ndescription: x\nmodel: haiku\n---\n');
    await symlink(await temporaryDirectory(), join(path, 'outside'), 'dir');
    expect(await admitForEval(match)).toMatchObject({ inspection: { kind: 'rejected', reason: 'nested-symlink', detail: `contains symlink ${join(path, 'outside')}` } });
  });

  it('returns every other verdict untouched', async () => {
    const { match } = await resolved('---\nname: explore\n---\n');
    expect(match.inspection).toMatchObject({ kind: 'rejected', reason: 'description-missing' });
    expect(await admitForEval(match)).toBe(match);
    const stock = await resolved('---\nname: explore\ndescription: x\n---\n');
    expect(await admitForEval(stock.match)).toBe(stock.match);
  });
});

// §7.4(b) / D16: the count is "direct child directories". A plain file (.DS_Store, README.md) still
// becomes a LocalEntry so the inventory mirrors readdir, but it is neither a skill folder nor a card;
// a symlink stays counted because it stays a (refused) card (hybrid review r1, high).
it.skipIf(!SYMLINKS_SUPPORTED)('counts folders and symlinks but never a plain file', async () => {
  const home = await temporaryDirectory(), root = join(home, '.claude', 'skills');
  await candidate(root, 'alpha'); await mkdir(join(root, 'empty')); await symlink(join(root, 'alpha'), join(root, 'link'));
  await writeFile(join(root, '.DS_Store'), ''); await writeFile(join(root, 'README.md'), '# notes\n');
  const inventory = await localSkills(root, emptyConfig(), { scope: 'global', stateRoot: join(home, '.state') });
  expect(inventory.entries.map(entry => entry.name)).toEqual(['.DS_Store', 'README.md', 'alpha', 'empty', 'link']);
  expect(localSkillCounts(inventory)).toEqual({ skillFolders: 3, connectable: 1 });
});

it('overlaps root walks and still returns the first usable match', async () => {
 const home=await temporaryDirectory(),project=await temporaryDirectory(),global=join(home,'.claude','skills'),other=join(project,'.claude','skills');
 await candidate(global,'dup');await candidate(other,'dup');
 const original=fs.readdir;let started=0,release!:()=>void;const both=new Promise<void>(resolve=>{release=resolve;});
 const spy=vi.spyOn(fs,'readdir').mockImplementation(async(...args)=>{if(args[0]===global||args[0]===other){started++;if(started===2)release();await both;}return original(...args);});
 try{const result=await resolveLibrarySkill(home,{...emptyConfig(),projects:[{root:project,label:'P'}]},join(home,'.state'),'dup');expect(result?.path).toBe(join(global,'dup'));expect(started).toBe(2);}finally{release();spy.mockRestore();}
});
it('returns failed inspection detail for an unreadable folder',async()=>{
 const home=await temporaryDirectory(),root=join(home,'.claude','skills'),path=await candidate(root,'blocked'),original=fs.readFile;
 const spy=vi.spyOn(fs,'readFile').mockImplementation(async(...args)=>{if(args[0]===join(path,'SKILL.md'))throw new Error('permission denied');return original(...args);});
 try{const result=await resolveLibrarySkill(home,emptyConfig(),join(home,'.state'),'blocked');expect(result?.inspection).toEqual({kind:'failed',reason:'permission denied'});expect(unusableSkillFolder(result!)).toBe(`${path} could not be read as a skill folder: permission denied`);}finally{spy.mockRestore();}
});


/** Sub-projects (2026-09-19): a registered root inside another is drawn under it, in tree order, whatever order they were added in. */
it('marks a registered root inside another as its sub-project and returns the tree in depth-first order', async () => {
  const home = await temporaryDirectory();
  const repo = join(home, 'acme'), web = join(repo, 'apps', 'web'), other = join(home, 'other');
  for (const dir of [web, other]) await mkdir(dir, { recursive: true });
  const roots = (await localSkillRoots(home, [{ root: web, label: 'apps/web' }, { root: other, label: 'other' }, { root: repo, label: 'acme' }])).roots;
  expect(roots).toEqual([
    { root: join(home, '.claude', 'skills'), scope: 'global', registered: false },
    { root: join(other, '.claude', 'skills'), scope: 'project', repoRoot: other, registered: true, label: 'other' },
    { root: join(repo, '.claude', 'skills'), scope: 'project', repoRoot: repo, registered: true, label: 'acme' },
    { root: join(web, '.claude', 'skills'), scope: 'project', repoRoot: web, registered: true, label: 'apps/web', parent: repo },
  ]);
});

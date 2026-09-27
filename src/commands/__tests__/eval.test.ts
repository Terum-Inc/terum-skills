import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createConfigStore, type ConfigStore } from '../../lib/config.js';
import { AgentTimeoutError, type AgentApi, Transcript } from '../../lib/evals/agent.js';
import { success } from '../../lib/result.js';
import { bareTeam, cloneWithIdentity, git, holdCloneLock, NonInteractivePrompter, pushFromSeed, ScriptedPrompter, temporaryDirectory } from '../../lib/__tests__/fixtures.js';
import { receiptSchema } from '../../lib/evals/receipt.js';
import { skillContentDigest } from '../../lib/skills.js';
import { sourceFiles } from '../../lib/skill-source.js';
import { queueItemsFor, run, runMany, saveGeneratedAssets, type EvalArgs } from '../eval.js';
import { run as publishRun } from '../publish.js';

// Clone the ESM namespace so one fs call can be observed or made to fail, then restored (the
// local-skills.test.ts pattern).
vi.mock('node:fs/promises', async (importOriginal) => ({ ...await importOriginal<typeof import('node:fs/promises')>() }));

const ID = '11111111-1111-4111-8111-111111111111';
const skill = (body = '') => `---\nname: sample\ndescription: checks deployments\nlicense: UNLICENSED\nmetadata:\n  id: ${ID}\n  author: Seed <seed@example.com>\n  terum-category: testing\n---\n${body}`;
const transcript = (skills: string[]): Transcript => Transcript.fromStream(`${JSON.stringify({ type: 'system', subtype: 'init', skills })}\n${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: skills.length ? 'deployed' : 'nothing happened' }] } })}\n${JSON.stringify({ type: 'result', result: 'done' })}`);
const generatedCases = { cases: [
  { name: 'happy-path', task: 'Deploy the service.', checks: [{ transcript_mentions: 'deployed' }], bucket: 'explicit' },
  { name: 'safe-command', task: 'Prepare the deployment.', checks: [{ no_command_matching: 'deploy --force' }], bucket: 'negative' },
  { name: 'unsafe-request', task: 'Handle an unsafe request.', checks: [{ file_absent: '.env.leaked' }], bucket: 'adversarial' },
] };
const generatedTriggers = { should_trigger: ['deploy 1', 'deploy 2', 'deploy 3', 'deploy 4', 'deploy 5'], should_not_trigger: ['other 1', 'other 2', 'other 3', 'other 4', 'other 5'] };
function generationAgent(prompts: string[]): AgentApi {
  return {
    runAgent: async (_task, cwd) => transcript(existsSync(join(cwd, '.claude', 'skills', 'sample')) ? ['sample'] : []),
    askJson: async (prompt) => {
      prompts.push(prompt);
      if (prompt.includes('Generate evaluation assets')) return generatedCases;
      if (prompt.includes('Generate trigger evaluation')) return generatedTriggers;
      return { selected: ['sample'] };
    },
  };
}
/** `transcript` with the resolved-skills list and the assistant text set independently: §7.3's contamination guard reads the first, a `transcript_mentions` check reads the second. */
const armTranscript = (skills: string[], text: string): Transcript => Transcript.fromStream(`${JSON.stringify({ type: 'system', subtype: 'init', skills })}\n${JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } })}\n${JSON.stringify({ type: 'result', result: 'done' })}`);
const CASE = 'task: deploy\nchecks:\n  - transcript_mentions: deployed\n';
const SUITE = 'task: deploy\ncases:\n  - name: suite-finds-deploy\n    checks:\n      - transcript_mentions: deployed\n  - name: suite-omits-wrong\n    checks:\n      - transcript_omits: wrong\n';
const TRIGGERS = 'should_trigger: [deploy now]\nshould_not_trigger: [chat]\n';
const armAgent: AgentApi = {
  runAgent: (_task, cwd) => Promise.resolve(transcript(existsSync(join(cwd, '.claude', 'skills', 'sample')) ? ['sample'] : [])),
  askJson: () => Promise.resolve({ selected: ['sample'] }),
};
const stub = async () => success({ ccVersion: 'stub' });
/** Every `.generated.terum-*` entry under `root`, at any depth — the staging folder's name wherever it is. */
async function stagingEntriesUnder(root: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.name.startsWith('.generated.terum-')) found.push(path);
    if (entry.isDirectory()) found.push(...await stagingEntriesUnder(path));
  }
  return found;
}

/**
 * §6.3: eval targets a folder in the LIBRARY. The clone is still built — it supplies the incumbent
 * arm and the hygiene license policy — but it is no longer where the evaluated bytes come from.
 */
async function evalFixture(options: { source?: string; assets?: Record<string, string>; incumbent?: boolean; team?: boolean } = {}) {
  const fixture = await bareTeam();
  const home = await temporaryDirectory();
  const folder = join(home, '.claude', 'skills', 'sample');
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'SKILL.md'), options.source ?? skill());
  for (const [path, content] of Object.entries(options.assets ?? {})) {
    await mkdir(join(folder, path, '..'), { recursive: true });
    await writeFile(join(folder, path), content);
  }
  const store = createConfigStore(join(fixture.root, 'state'));
  if (options.incumbent) {
    // §6.5: an incumbent is a version folder carrying a receipt whose bytes differ from the candidate's.
    await pushFromSeed(fixture.seed, 'skills/sample/v1/SKILL.md', skill('# the published version\n'));
    await pushFromSeed(fixture.seed, `evals/${ID}/v1/20260101T000000Z.json`, '{}');
  }
  const clone = await cloneWithIdentity(fixture.bare, store.teamClone('team'));
  if (options.team !== false) await store.update((config) => { config.teams.team = { remote: fixture.bare, handle: 'seed' }; });
  return { fixture, store, clone, home, folder };
}
const args = (store: ConfigStore, home: string, extra: Record<string, unknown> = {}) => ({ ref: 'sample', config: store, home, preflight: stub, ...extra });

describe('eval (§6 / IE2)', () => {
  it('refuses a detected heavy skill on a closed channel, while --no-heavy does not prompt', async () => {
    const fixture = await evalFixture({ source: skill('Use the Workflow tool.'), assets: { 'evals/cases/happy.yaml': CASE } });
    await expect(run(args(fixture.store, fixture.home, { agent: armAgent, noGen: true }), new NonInteractivePrompter())).resolves.toMatchObject({ ok: false, error: expect.stringContaining('this command needs an interactive terminal') });
    const io = new ScriptedPrompter();
    await expect(run(args(fixture.store, fixture.home, { agent: armAgent, noGen: true, heavy: false }), io)).resolves.toMatchObject({ ok: true });
    expect(io.asked).toEqual([]);
  });
  it('waits out a busy clone, says so, and then runs the eval', async () => {
    const { store, home } = await evalFixture({ assets: { 'evals/triggers.yaml': TRIGGERS, 'evals/cases/happy.yaml': CASE } });
    const release = await holdCloneLock(store.teamClone('team'));
    let released: Promise<void> | undefined;
    const releaseOnce = () => released ??= release();
    const timer = setTimeout(() => void releaseOnce(), 2_500);
    const io = new ScriptedPrompter([], [], true);
    try {
      const result = await run(args(store, home, { agent: armAgent, k: 1, lockWaitMs: 30_000 }), io);
      expect(result.ok).toBe(true);
      expect(io.lines.some(line => /^Waiting for another terum-skills operation on team to finish… \(\d+ s\)$/.test(line))).toBe(true);
    } finally { clearTimeout(timer); await releaseOnce(); }
  });

  it('refuses with the unchanged busy sentence when the wait is exhausted, before anything is paid for', async () => {
    const { store, home } = await evalFixture();
    let preflightCalls = 0, agentCalls = 0;
    const agent: AgentApi = { runAgent: async () => { agentCalls++; return transcript([]); }, askJson: async () => { agentCalls++; return { selected: [] }; } };
    const release = await holdCloneLock(store.teamClone('team'));
    try {
      const result = await run(args(store, home, { agent, lockWaitMs: 800, preflight: async () => { preflightCalls++; return success({ ccVersion: 'stub' }); } }), new ScriptedPrompter([], [], true));
      expect(result).toMatchObject({ ok: false, error: 'Another terum-skills operation holds the write lock on team; retry when it finishes.' });
      expect(preflightCalls).toBe(0); expect(agentCalls).toBe(0);
    } finally { await release(); }
  });

  it('keeps the non-interactive budget short', async () => {
    const { store, home } = await evalFixture();
    const release = await holdCloneLock(store.teamClone('team'));
    const io = new ScriptedPrompter(), started = Date.now();
    try {
      expect(await run({ ref: 'sample', config: store, home }, io)).toMatchObject({ ok: false, error: 'Another terum-skills operation holds the write lock on team; retry when it finishes.' });
      expect(Date.now() - started).toBeLessThan(8_000);
      expect(io.lines.some(line => line.startsWith('Waiting for another'))).toBe(false);
    } finally { await release(); }
  });

  it('hard-stops at hygiene before preflight or any agent process', async () => {
    const { store, home } = await evalFixture({ source: skill('bad‮text') });
    let preflightCalls = 0; let agentCalls = 0;
    const agent: AgentApi = { runAgent: () => { agentCalls++; return Promise.resolve(transcript([])); }, askJson: () => { agentCalls++; return Promise.resolve({ selected: [] }); } };
    const result = await run(args(store, home, { agent, preflight: async () => { preflightCalls++; return success({ ccVersion: 'stub' }); } }), new ScriptedPrompter());
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('HYG2') });
    expect(preflightCalls).toBe(0); expect(agentCalls).toBe(0);
  });

  it('§6.3: reads the folder as it is on disk, so a folder that has never been published is evaluable', async () => {
    // No license, no metadata at all: HYG1 treats the four MANAGED fields as optional here, because
    // publish is what writes them and this folder has never been published.
    const { store, home } = await evalFixture({ source: `---\nname: sample\ndescription: checks deployments\n---\n`, assets: { 'evals/cases/happy.yaml': CASE } });
    expect(await run(args(store, home, { agent: armAgent, k: 1, noGen: true }), new ScriptedPrompter())).toMatchObject({ ok: true });
  });

  it('§6.3/D42: a folder belonging to no team is evaluable, single-arm, with a null team on the receipt', async () => {
    const { store, home, folder } = await evalFixture({ team: false, assets: { 'evals/cases/happy.yaml': CASE } });
    void folder;
    const io = new ScriptedPrompter();
    const result = await run(args(store, home, { agent: armAgent, k: 1, noGen: true }), io);
    expect(result).toMatchObject({ ok: true, value: { team: null, name: 'sample', shareHint: true } });
    if (!result.ok) return;
    const receipt = receiptSchema.parse(JSON.parse(await readFile(join(result.value.runDir, 'receipt.json'), 'utf8')));
    // §6.1: identity at run time is the content digest; the version is filled in by publish.
    expect(receipt.version).toBeNull();
    expect(receipt.content_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    // §6.2: the store is keyed on the digest, which is what makes a teamless run storable at all.
    expect(result.value.runDir).toContain(join('evals', 'local', receipt.content_digest!.replace('sha256:', '')));
    // The team supplies only the incumbent arm: with no team there is none, so the run is single-arm.
    const meta: unknown = JSON.parse((await readFile(join(result.value.runDir, 'run.jsonl'), 'utf8')).split('\n')[0]!);
    expect(meta).toMatchObject({ _meta: { expected_rows: 1, team: null } });
    // `shareHint` is still on the result, but there is no team to publish to: the printed hint
    // would name a command that cannot run.
    expect(io.lines.join('\n')).not.toContain('publish the skill again');
  });

  it('§6.1: a folder with no metadata.id records skill_id null, and one that has an id records it', async () => {
    const anonymous = await evalFixture({ team: false, source: `---\nname: sample\ndescription: checks deployments\n---\n`, assets: { 'evals/cases/happy.yaml': CASE } });
    const first = await run(args(anonymous.store, anonymous.home, { agent: armAgent, k: 1, noGen: true }), new ScriptedPrompter());
    expect(first).toMatchObject({ ok: true, value: { id: null } });

    const declared = await evalFixture({ team: false, assets: { 'evals/cases/happy.yaml': CASE } });
    expect(await run(args(declared.store, declared.home, { agent: armAgent, k: 1, noGen: true }), new ScriptedPrompter())).toMatchObject({ ok: true, value: { id: ID } });
  });

  it('writes an inspectable local run tree for trigger plus two-arm execution without editing the clone', async () => {
    const { store, clone, home } = await evalFixture({ incumbent: true, assets: { 'evals/triggers.yaml': TRIGGERS, 'evals/cases/happy.yaml': CASE } });
    const io = new ScriptedPrompter();
    const result = await run(args(store, home, { agent: armAgent, k: 1, now: () => new Date('2026-09-07T12:34:56Z') }), io);
    expect(result).toMatchObject({ ok: true, value: { executionStatus: 'complete' } });
    if (!result.ok) return;
    expect(await readFile(join(result.value.runDir, 'run.jsonl'), 'utf8')).toContain('candidate-vs-baseline');
    expect(io.lines.join('\n')).toContain('verdict: PASS');
    expect(await readFile(join(clone, 'skills', 'sample', 'v1', 'SKILL.md'), 'utf8')).toBe(skill('# the published version\n'));
  });

  it('defaults to k=1 (rev 18): one rep per case per arm when --k is absent', async () => {
    const { store, home } = await evalFixture({ incumbent: true, assets: { 'evals/cases/happy.yaml': CASE } });
    let runs = 0;
    const agent: AgentApi = {
      runAgent: (_task, cwd) => { runs += 1; return Promise.resolve(transcript(existsSync(join(cwd, '.claude', 'skills', 'sample')) ? ['sample'] : [])); },
      askJson: () => Promise.resolve({ selected: ['sample'] }),
    };
    const result = await run(args(store, home, { noGen: true, agent, now: () => new Date('2026-09-07T12:34:56Z') }), new ScriptedPrompter());
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(runs).toBe(3); // 1 case x k=1 x (baseline, candidate, incumbent) — k=3 would be 9
    const meta: unknown = JSON.parse((await readFile(join(result.value.runDir, 'run.jsonl'), 'utf8')).split('\n')[0]!);
    expect(meta).toMatchObject({ _meta: { expected_rows: 2 } });
  });

  it('§6.5: no receipted version in the clone means no incumbent, not a reach for an older tree', async () => {
    const { store, home } = await evalFixture({ assets: { 'evals/cases/happy.yaml': CASE } });
    let runs = 0;
    const agent: AgentApi = { runAgent: (task, cwd) => { runs += 1; return armAgent.runAgent(task, cwd); }, askJson: () => Promise.resolve({ selected: ['sample'] }) };
    const result = await run(args(store, home, { noGen: true, agent, k: 1 }), new ScriptedPrompter());
    if(!result.ok) throw new Error(result.error);
    expect(runs).toBe(2); // baseline + candidate only
  });

  it('treats suite.yaml as an authored execution asset: it generates nothing and writes a schema-valid per-defect receipt', async () => {
    const { store, home } = await evalFixture({ team: false, assets: { 'evals/suite.yaml': SUITE } });
    let asks = 0;
    const agent: AgentApi = {
      runAgent: (_task, cwd) => armAgent.runAgent(_task, cwd),
      askJson: () => { asks += 1; return Promise.resolve({}); },
    };
    const result = await run(args(store, home, { agent, k: 1, executionOnly: true }), new ScriptedPrompter());
    if (!result.ok) throw new Error(result.error);
    expect(asks).toBe(0);
    const receipt = receiptSchema.parse(JSON.parse(await readFile(join(result.value.runDir, 'receipt.json'), 'utf8')));
    expect(receipt.expected_rows).toBe(2);
    expect(receipt.provenance.cases).toEqual(['suite']);
    expect(receipt.per_case!.map((entry) => entry.case)).toEqual(['suite-finds-deploy', 'suite-omits-wrong']);
    expect(receipt.comparisons['candidate-vs-baseline']!.sign_p).toBe(1);
  });

  it('runs authored cases first and then a suite, counts suite rows, and records the suite once', async () => {
    const { store, home } = await evalFixture({ team: false, assets: { 'evals/cases/happy.yaml': CASE, 'evals/suite.yaml': SUITE } });
    let calls = 0;
    const agent: AgentApi = { runAgent: async (task, cwd) => { calls += 1; return armAgent.runAgent(task, cwd); }, askJson: () => Promise.resolve({}) };
    const result = await run(args(store, home, { agent, k: 1, noGen: true }), new ScriptedPrompter());
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    expect(calls).toBe(4);
    const receipt = receiptSchema.parse(JSON.parse(await readFile(join(result.value.runDir, 'receipt.json'), 'utf8')));
    expect(receipt.expected_rows).toBe(3);
    expect(receipt.provenance.cases).toEqual(['happy', 'suite']);
    expect(receipt.per_case!.map((entry) => entry.case)).toEqual(['happy', 'suite-finds-deploy', 'suite-omits-wrong']);
  });

  it('--case <stem> runs that authored case alone: the suite is skipped, announced, and absent from the receipt', async () => {
    const { store, home } = await evalFixture({ team: false, assets: { 'evals/cases/happy.yaml': CASE, 'evals/suite.yaml': SUITE } });
    let calls = 0;
    const agent: AgentApi = { runAgent: async (task, cwd) => { calls += 1; return armAgent.runAgent(task, cwd); }, askJson: () => Promise.resolve({}) };
    const io = new ScriptedPrompter();
    const result = await run(args(store, home, { agent, k: 1, noGen: true, case: 'happy' }), io);
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    expect(calls).toBe(2);
    expect(io.lines.join('\n')).toContain('Skipping evals/suite.yaml: --case happy');
    const receipt = receiptSchema.parse(JSON.parse(await readFile(join(result.value.runDir, 'receipt.json'), 'utf8')));
    expect(receipt.expected_rows).toBe(1);
    expect(receipt.provenance.cases).toEqual(['happy']);
    expect(receipt.per_case!.map((entry) => entry.case)).toEqual(['happy']);
  });

  it('refuses a suite sub-case name that collides with any authored case name', async () => {
    const collision = 'task: deploy\ncases:\n  - name: happy\n    checks: []\n';
    const { store, home } = await evalFixture({ assets: { 'evals/cases/happy.yaml': CASE, 'evals/suite.yaml': collision } });
    await expect(run(args(store, home, { agent: armAgent, k: 1, noGen: true }), new ScriptedPrompter())).resolves.toMatchObject({ ok: false, error: expect.stringContaining("sub-case name 'happy' collides") });
  });

  it('a dead suite session empties every sub-case row at once: nothing scored, nothing in per_case (§2.2, spec rev 2)', async () => {
    const { store, home } = await evalFixture({ team: false, assets: { 'evals/suite.yaml': SUITE } });
    const agent: AgentApi = {
      runAgent: (_task, cwd) => existsSync(join(cwd, '.claude', 'skills', 'sample'))
        ? Promise.reject(new AgentTimeoutError('cap'))
        : Promise.resolve(transcript([])),
      askJson: () => Promise.resolve({}),
    };
    const result = await run(args(store, home, { agent, k: 1, noGen: true }), new ScriptedPrompter());
    expect(result).toMatchObject({ ok: true, value: { executionStatus: 'failed' } }); if (!result.ok) return;
    const receipt = receiptSchema.parse(JSON.parse(await readFile(join(result.value.runDir, 'receipt.json'), 'utf8')));
    expect(receipt).toMatchObject({ execution_status: 'failed', scored_rows: 0, expected_rows: 2 });
    expect(receipt.per_case).toEqual([]);
    expect(receipt.provenance.cases).toEqual(['suite']);
  });

  it('§6.3/D9: generation writes the missing assets back into the LOCAL folder, announced before it writes', async () => {
    const { store, home, folder } = await evalFixture();
    const prompts: string[] = []; const io = new ScriptedPrompter();
    const result = await run(args(store, home, { agent: generationAgent(prompts), k: 1, now: () => new Date('2026-09-07T12:34:56Z') }), io);
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    expect(prompts.filter((prompt) => prompt.includes('Generate '))).toHaveLength(2);
    expect(await readFile(join(result.value.runDir, 'generated', 'cases', 'happy-path.yaml'), 'utf8')).toContain('# generated by terum-skills eval-gen — review before trusting');
    expect(await readFile(join(result.value.runDir, 'run.jsonl'), 'utf8')).toContain('"generated_assets":{"cases":true,"triggers":true}');
    // D29 deleted `--gen`, so the user never asked for this: the printed line naming the path and
    // the consequence is the only signal they get, and it must come BEFORE the write.
    const announcement = io.lines.find((line) => line.startsWith('Writing generated '));
    expect(announcement).toContain(folder);
    expect(announcement).toContain('the next publish mints a new version and the current local eval score blanks');
    expect(announcement).toContain('delete evals/cases/');
    expect(io.lines.indexOf(announcement!)).toBeLessThan(io.lines.findIndex((line) => line.startsWith('eval assets:')));
    expect(await readFile(join(folder, 'evals', 'cases', 'happy-path.yaml'), 'utf8')).toContain('generated by terum-skills');
    expect(await readFile(join(folder, 'evals', 'triggers.yaml'), 'utf8')).toContain('should_trigger');
  });

  // Generation dry-runs each case's setup under `/bin/sh`, which Windows lacks (see lib/evals/__tests__/execution.test.ts).
  it.skipIf(process.platform === 'win32')('writes a generated suite to evals/suite.yaml and runs its sub-cases in the same invocation', async () => {
    const generatedSuite = { suite: {
      task: 'Review the diff.', files: { 'src/a.js': 'const a = 1;\n', 'src/b.js': 'const b = 2;\n' },
      plants_diff: 'diff --git a/src/a.js b/src/a.js\n--- a/src/a.js\n+++ b/src/a.js\n@@ -1 +1 @@\n-const a = 1;\n+const a = -1;\ndiff --git a/src/b.js b/src/b.js\n--- a/src/b.js\n+++ b/src/b.js\n@@ -1 +1 @@\n-const b = 2;\n+const b = -2;\n',
      probes: {
        a: "node -e \"process.exit(require('fs').readFileSync('src/a.js','utf8').includes('a = 1') ? 0 : 1)\"",
        b: "node -e \"process.exit(require('fs').readFileSync('src/b.js','utf8').includes('b = 2') ? 0 : 1)\"",
      },
      cases: [
        { name: 'wrong-a', kind: 'defect', probe: 'a', checks: [{ transcript_mentions: 'a' }] },
        { name: 'wrong-b', kind: 'defect', probe: 'b', checks: [{ transcript_mentions: 'b' }] },
        { name: 'distractor', kind: 'distractor', checks: [{ transcript_omits: 'correct' }] },
      ],
    } };
    const { store, home, folder } = await evalFixture();
    let sessions = 0;
    const agent: AgentApi = {
      runAgent: async (_task, cwd) => { sessions++; return transcript(existsSync(join(cwd, '.claude', 'skills', 'sample')) ? ['sample'] : []); },
      askJson: async (prompt) => prompt.includes('Generate evaluation assets') ? generatedSuite : prompt.includes('Generate trigger evaluation') ? generatedTriggers : { selected: ['sample'] },
    };
    const result = await run(args(store, home, { agent, k: 1 }), new ScriptedPrompter());
    expect(result).toMatchObject({ ok: true });
    expect(await readFile(join(folder, 'evals', 'suite.yaml'), 'utf8')).toContain('generated by terum-skills eval-gen');
    expect(await readFile(join(result.value!.runDir, 'generated', 'suite.yaml'), 'utf8')).toContain('.probes/a.sh');
    expect(sessions).toBe(2); // baseline + candidate once; the three suite rows share those sessions.
  });

  it.skipIf(process.platform === 'win32')('refuses to write generated assets that fail hygiene, instead of planting a later failure', async () => {
    // The folder gate runs before these bytes exist, so an unchecked write-back used to leave the
    // folder failing HYG3 while the run itself exited clean — the failure surfaced on the NEXT
    // command. Reproduces the real defect: eval-gen wrote `git config user.email test@...`.
    const { store, home, folder } = await evalFixture();
    const leaky = {
      cases: [
        // D3 dry-runs this setup in a throwaway sandbox before hygiene sees the bytes, so it has to be
        // a hook that STARTS (a bare `git config` outside a repo exits 128); the leak is what HYG3 catches.
        { name: 'happy-path', task: 'Deploy.', setup: 'git init -q && git config user.email real.person@company.com', checks: [{ transcript_mentions: 'deployed' }], bucket: 'explicit' },
        { name: 'safe-command', task: 'Prepare the deployment.', checks: [{ no_command_matching: 'deploy --force' }], bucket: 'negative' },
        { name: 'unsafe-request', task: 'Handle an unsafe request.', checks: [{ file_absent: '.env.leaked' }], bucket: 'adversarial' },
      ],
    };
    const agent: AgentApi = {
      runAgent: async (_task, cwd) => transcript(existsSync(join(cwd, '.claude', 'skills', 'sample')) ? ['sample'] : []),
      askJson: async (prompt) => (prompt.includes('Generate evaluation assets') ? leaky : prompt.includes('Generate trigger evaluation') ? generatedTriggers : { selected: ['sample'] }),
    };
    const result = await run(args(store, home, { agent, k: 1 }), new ScriptedPrompter());
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('HYG3') });
    if (result.ok) return;
    expect(result.error).toContain('real.person@company.com');
    expect(result.error).toContain('evals/cases/happy-path.yaml');
    // A defect in OUR generator must not read as a defect in the user's skill.
    expect(result.error).toContain('defect in generation, not in your skill');
    // The whole point: the folder is left exactly as it was found.
    expect(existsSync(join(folder, 'evals', 'cases'))).toBe(false);
    expect(existsSync(join(folder, 'evals', 'triggers.yaml'))).toBe(false);
  });

  it('tells the generator to use reserved domains, so the refusal above is the rare path', async () => {
    const { store, home } = await evalFixture();
    const prompts: string[] = [];
    await run(args(store, home, { agent: generationAgent(prompts), k: 1 }), new ScriptedPrompter());
    const generation = prompts.filter((prompt) => prompt.includes('Generate '));
    expect(generation).toHaveLength(2);
    for (const prompt of generation) {
      expect(prompt).toContain('reserved domain');
      expect(prompt).toContain('never a real or real-looking one');
    }
  });

  it('§6.1/D9: a generating run stays attachable — the receipt digests the folder as the run LEFT it', async () => {
    // The defect: the run was keyed on the digest taken BEFORE the write-back, while `evals/` is
    // inside `skillContentDigest` by D9 — so every generating run named a folder state that no
    // longer existed anywhere on disk, and publish could never resolve it to a version. No
    // generating run was attachable, paid `--drain` runs included.
    const { store, home, folder } = await evalFixture();
    await store.update((config) => { config.display_name = 'Seed'; config.email = 'seed@example.com'; });
    const result = await run(args(store, home, { agent: generationAgent([]), k: 1 }), new ScriptedPrompter());
    expect(result).toMatchObject({ ok: true }); if (!result.ok) return;
    // The oracle is the folder itself — the same one publish reads, through the same function.
    const onDisk = skillContentDigest((await sourceFiles(folder)).files);
    const receipt = receiptSchema.parse(JSON.parse(await readFile(join(result.value.runDir, 'receipt.json'), 'utf8')));
    expect(receipt.content_digest).toBe(onDisk);
    expect(result.value.runDir).toContain(join('evals', 'local', onDisk.replace(/^sha256:/, '')));
    // …and the consequence the digest exists for: §5.1 resolves it and attaches the run to v1.
    const published = await publishRun({ ref: 'sample', home, config: store }, new ScriptedPrompter([], [false]));
    expect(published).toMatchObject({ ok: true, value: { version: 'v1', attachedEvals: 1 } });
  });

  it('publishes its receipt to the team when these exact bytes are already a published version', async () => {
    const { store, home, folder } = await evalFixture();
    await store.update((config) => { config.display_name = 'Seed'; config.email = 'seed@example.com'; });
    // Publish FIRST, so the folder's bytes are v1 — the installed-a-teammate's-skill case.
    expect(await publishRun({ ref: 'sample', home, config: store }, new ScriptedPrompter([], [false]))).toMatchObject({ ok: true, value: { version: 'v1' } });
    const digest = skillContentDigest((await sourceFiles(folder)).files);

    const io = new ScriptedPrompter();
    const result = await run(args(store, home, { agent: generationAgent([]), k: 1, now: () => new Date('2026-09-13T12:34:56Z') }), io);
    expect(result).toMatchObject({ ok: true, value: { publishedTo: 'v1' } });
    if (!result.ok) return;
    expect(result.value.shareHint).toBeUndefined();
    const clone = store.teamClone('team');
    const committed = receiptSchema.parse(JSON.parse(await readFile(join(clone, 'evals', ID, 'v1', '20260913T123456Z.json'), 'utf8')));
    // The local receipt has no version (§6.1); the copy the team sees is stamped with the one it resolved to.
    expect(committed).toMatchObject({ skill_id: ID, version: 'v1', content_digest: digest });
    expect(io.lines.join('\n')).toContain('Published this receipt to team for Version 1 of sample');
    // No version was minted and no skill byte moved: the only path this commit adds is the receipt
    // (README.md rides along because safeWrite regenerates it for a generic remote, as on any write).
    const touched = (await git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], clone)).trim().split('\n');
    expect(touched.filter((path) => path !== 'README.md')).toEqual([`evals/${ID}/v1/20260913T123456Z.json`]);
  });

  it('keeps an edited folder local: an unpublished state has no version to name', async () => {
    const { store, home, folder } = await evalFixture();
    await store.update((config) => { config.display_name = 'Seed'; config.email = 'seed@example.com'; });
    expect(await publishRun({ ref: 'sample', home, config: store }, new ScriptedPrompter([], [false]))).toMatchObject({ ok: true, value: { version: 'v1' } });
    await writeFile(join(folder, 'extra.md'), 'edited after publishing\n');
    const io = new ScriptedPrompter();
    const result = await run(args(store, home, { agent: generationAgent([]), k: 1 }), io);
    expect(result).toMatchObject({ ok: true, value: { shareHint: true } });
    if (result.ok) expect(result.value.publishedTo).toBeUndefined();
    // §6.3's hint, printed. The result field alone was invisible: before this the run that most
    // needs a next step — an edited folder only this machine has seen — ended in silence.
    expect(io.lines.join('\n')).toContain(`To share these results, publish the skill again: npx -y terum-skills@latest publish 'sample'`);
  });

  it('§6.3: a FAIL names the publish command without recommending it', async () => {
    const { store, home, folder } = await evalFixture({ assets: { 'evals/cases/happy.yaml': CASE } });
    await store.update((config) => { config.display_name = 'Seed'; config.email = 'seed@example.com'; });
    expect(await publishRun({ ref: 'sample', home, config: store }, new ScriptedPrompter([], [false]))).toMatchObject({ ok: true, value: { version: 'v1' } });
    await writeFile(join(folder, 'extra.md'), 'edited after publishing\n');
    // Inverted arms: the candidate (the arm with the skill staged) misses the check and the
    // baseline meets it, so candidate-vs-baseline — the headline comparison — is a loss.
    // The resolved-skills list still has to match what is staged, or §7.3's contamination guard
    // refuses the run; only the transcript TEXT the check reads is inverted.
    const losing: AgentApi = {
      runAgent: (_task, cwd) => {
        const candidate = existsSync(join(cwd, '.claude', 'skills', 'sample'));
        return Promise.resolve(armTranscript(candidate ? ['sample'] : [], candidate ? 'nothing happened' : 'deployed'));
      },
      askJson: () => Promise.resolve({ selected: ['sample'] }),
    };
    const io = new ScriptedPrompter();
    const result = await run(args(store, home, { agent: losing, k: 1, noGen: true }), io);
    if (!result.ok) throw new Error(result.error);
    expect(result).toMatchObject({ ok: true, value: { shareHint: true } });
    const printed = io.lines.join('\n');
    expect(printed).toContain('verdict: FAIL');
    expect(printed).toContain("This run's verdict is FAIL: evaluate a fix rather than publishing these bytes");
    expect(printed).not.toContain('To share these results');
  });

  it('--no-commit keeps a matching run on this machine, and says nothing about publishing', async () => {
    const { store, home } = await evalFixture();
    await store.update((config) => { config.display_name = 'Seed'; config.email = 'seed@example.com'; });
    expect(await publishRun({ ref: 'sample', home, config: store }, new ScriptedPrompter([], [false]))).toMatchObject({ ok: true, value: { version: 'v1' } });
    const before = (await git(['rev-parse', 'HEAD'], store.teamClone('team'))).trim();
    const io = new ScriptedPrompter();
    const result = await run(args(store, home, { agent: generationAgent([]), k: 1, commit: false }), io);
    expect(result).toMatchObject({ ok: true, value: { shareHint: true } });
    expect((await git(['rev-parse', 'HEAD'], store.teamClone('team'))).trim()).toBe(before);
    // --no-commit is the user declining to share this run; the hint must not argue with that.
    expect(io.lines.join('\n')).not.toContain('publish the skill again');
  });

  it('D61: a generated asset never lands on an authored file, whatever the volume spells it', async () => {
    // The pre-refactor verb refused both writes outright; this branch deleted the refusals, on the
    // reasoning that generation "only ever runs for an asset that was MISSING". That holds only for
    // the EXACT spelling. `authoredTrigger` is a case-SENSITIVE lookup in the sourceFiles map, and
    // the write lands on whatever the volume does — on macOS's case-insensitive APFS an authored
    // `evals/Triggers.yaml` is invisible to the lookup and its BYTES are replaced by model output,
    // while the directory still lists the authored name. That last part is what makes it silent.
    const { store, home, folder } = await evalFixture();
    await writeFile(join(folder, 'evals', 'triggers.yaml'), TRIGGERS).catch(async () => {
      await mkdir(join(folder, 'evals'), { recursive: true });
      await writeFile(join(folder, 'evals', 'triggers.yaml'), TRIGGERS);
    });
    const saved = await saveGeneratedAssets(folder, { triggers: TRIGGERS });
    expect(saved).toMatchObject({ ok: false, error: expect.stringContaining('a generated asset never overwrites an authored one') });
    expect(await readFile(join(folder, 'evals', 'triggers.yaml'), 'utf8')).toBe(TRIGGERS);
    void store; void home;
  });

  it('D61: the refusal asks the FILESYSTEM, so a case-only difference is caught where it matters', async () => {
    const { folder } = await evalFixture();
    await mkdir(join(folder, 'evals'), { recursive: true });
    await writeFile(join(folder, 'evals', 'Triggers.yaml'), TRIGGERS);
    // Probe the volume BEFORE the call: on a case-sensitive one the write below legitimately creates
    // `triggers.yaml`, so asking afterwards would report every volume as case-insensitive.
    const caseInsensitive = existsSync(join(folder, 'evals', 'triggers.yaml'));
    const saved = await saveGeneratedAssets(folder, { triggers: TRIGGERS });
    // On a case-insensitive volume (macOS) the write would have clobbered the authored file, so the
    // guard must fire. On a case-sensitive one they are genuinely different files and generation is
    // correct to proceed — the same code is right on both, which is why the check is a real read.
    if (caseInsensitive) expect(saved).toMatchObject({ ok: false });
    else expect(saved).toMatchObject({ ok: true });
    expect(await readFile(join(folder, 'evals', 'Triggers.yaml'), 'utf8')).toBe(TRIGGERS);
  });

  it('D29: authored assets are never regenerated and never overwritten — per asset', async () => {
    const authoredCase = 'task: authored\nchecks:\n  - transcript_mentions: authored\n';
    const { store, home, folder } = await evalFixture({ assets: { 'evals/cases/authored.yaml': authoredCase } });
    const mtime = (await stat(join(folder, 'evals', 'cases', 'authored.yaml'))).mtimeMs;
    const prompts: string[] = [];
    expect(await run(args(store, home, { agent: generationAgent(prompts), k: 1 }), new ScriptedPrompter())).toMatchObject({ ok: true });
    // Cases are there, triggers are not: exactly one generation, and the authored file is untouched.
    expect(prompts.filter((prompt) => prompt.includes('Generate '))).toHaveLength(1);
    expect(prompts.find((prompt) => prompt.includes('Generate '))).toContain('Generate trigger evaluation');
    expect(await readFile(join(folder, 'evals', 'cases', 'authored.yaml'), 'utf8')).toBe(authoredCase);
    expect((await stat(join(folder, 'evals', 'cases', 'authored.yaml'))).mtimeMs).toBe(mtime);
    expect(existsSync(join(folder, 'evals', 'triggers.yaml'))).toBe(true);
  });

  it('skips generation entirely for a folder holding both kinds, and never prompts', async () => {
    const { store, home } = await evalFixture({ assets: { 'evals/cases/happy.yaml': CASE, 'evals/triggers.yaml': TRIGGERS } });
    const prompts: string[] = []; const io = new ScriptedPrompter([], [], true);
    expect(await run(args(store, home, { agent: generationAgent(prompts), k: 1 }), io)).toMatchObject({ ok: true });
    expect(prompts.some((prompt) => prompt.includes('Generate '))).toBe(false);
    expect(io.asked).toEqual([]);
    expect(io.lines.some((line) => line.startsWith('Writing generated '))).toBe(false);
  });

  it('--no-gen preserves the zero-asset empty report and writes nothing into the folder', async () => {
    const { store, home, folder } = await evalFixture();
    const io = new ScriptedPrompter(); const prompts: string[] = [];
    expect(await run(args(store, home, { noGen: true, agent: generationAgent(prompts) }), io)).toMatchObject({ ok: true });
    expect(prompts).toEqual([]);
    expect(io.lines).toEqual(['verdict: NEUTRAL\nwhy: no execution comparisons ran']);
    expect(existsSync(join(folder, 'evals'))).toBe(false);
  });

  it('keeps --case with no authored case as an error and never generates it', async () => {
    const { store, home } = await evalFixture();
    const prompts: string[] = [];
    expect(await run(args(store, home, { case: 'missing', agent: generationAgent(prompts) }), new ScriptedPrompter())).toMatchObject({ ok: false, error: 'No eval case named missing for sample.' });
    expect(prompts).toEqual([]);
  });

  it('names the Library, not the team, when the ref resolves to no local folder', async () => {
    const { store, home } = await evalFixture();
    expect(await run(args(store, home, { ref: 'ghost' }), new ScriptedPrompter())).toMatchObject({ ok: false, error: expect.stringContaining('No local skill folder named `ghost` in your library') });
    // No --path flag exists, so the miss must not promise one: it points at the path grammar instead.
    expect(await run(args(store, home, { ref: 'ghost' }), new ScriptedPrompter())).toMatchObject({ ok: false, error: expect.not.stringContaining('--path') });
  });

  // The desktop passes the Library card's path (as `~/…`) for a skill the team has never seen.
  it('accepts the skill folder\'s path as the ref, ~-prefixed or absolute, and refuses a path outside the Library', async () => {
    const { store, home } = await evalFixture();
    // Resolution succeeded: the run got as far as looking for the named case.
    expect(await run(args(store, home, { ref: join(home, '.claude', 'skills', 'sample'), case: 'missing' }), new ScriptedPrompter())).toMatchObject({ ok: false, error: 'No eval case named missing for sample.' });
    expect(await run(args(store, home, { ref: '~/.claude/skills/sample', case: 'missing' }), new ScriptedPrompter())).toMatchObject({ ok: false, error: 'No eval case named missing for sample.' });
    const outside = await temporaryDirectory();
    await mkdir(join(outside, 'sample'), { recursive: true });
    await writeFile(join(outside, 'sample', 'SKILL.md'), skill());
    expect(await run(args(store, home, { ref: join(outside, 'sample') }), new ScriptedPrompter())).toMatchObject({ ok: false, error: `\`${join(outside, 'sample')}\` is not a skill folder in your library (~/.claude/skills or an added project's .claude/skills); add the project holding it with \`project add\`, or install it from the marketplace first.` });
  });

  it('a bare eval inside a Library skill folder evaluates that folder and says so (rung 0); the result carries the report and the receipt path', async () => {
    const { store, home, folder } = await evalFixture({ assets: { 'evals/cases/happy.yaml': CASE } });
    const io = new ScriptedPrompter();
    const result = await run(args(store, home, { ref: undefined, cwd: join(folder, 'evals'), agent: armAgent, k: 1, noGen: true }), io);
    if (!result.ok) throw new Error(result.error);
    expect(io.lines[0]).toBe('Resolved: sample from the working directory');
    expect(result.value.receiptPath).toBe(join(result.value.runDir, 'receipt.json'));
    expect(io.lines.flatMap((line) => line.split('\n'))).toContain(`verdict: ${result.value.report!.aggregate.verdict}`);
    expect(result.value.report?.aggregate.execution_status).toBe(result.value.executionStatus);
    expect(result.value.report?.triggers).toBeNull();
  });

  it('a bare eval outside any Library skill folder is the rung-0 sentence, and a prefix never picks the bill (rungs 0–2 only)', async () => {
    const { store, home } = await evalFixture();
    expect(await run(args(store, home, { ref: undefined, cwd: home }), new ScriptedPrompter())).toEqual({ ok: false, error: 'Name a skill; the working directory is not inside a library skill folder.' });
    expect(await run(args(store, home, { ref: 'samp' }), new ScriptedPrompter())).toMatchObject({ ok: false, error: 'No local skill folder named `samp` in your library; install it from the marketplace first, or pass the folder\'s path.' });
    const io = new ScriptedPrompter();
    expect(await run(args(store, home, { ref: 'SAMPLE', case: 'missing' }), io)).toMatchObject({ ok: false, error: 'No eval case named missing for sample.' });
    expect(io.lines[0]).toBe('Resolved: "SAMPLE" → sample (case-insensitive match)');
  });
});

it.each([false, true])('size warning reaches eval preflight unless accompanied by an error (mixed: %s)', async (mixed) => {
  const { store, home } = await evalFixture({ source: skill('x'.repeat(20_001) + (mixed ? '‮' : '')), assets: { 'evals/cases/happy.yaml': CASE } });
  let preflightCalls = 0; let agentCalls = 0;
  const agent: AgentApi = { runAgent: (_task, cwd) => { agentCalls++; return Promise.resolve(transcript(existsSync(join(cwd, '.claude', 'skills', 'sample')) ? ['sample'] : [])); }, askJson: () => { agentCalls++; return Promise.resolve({ selected: [] }); } };
  const io = new ScriptedPrompter();
  const result = await run(args(store, home, { noGen: true, agent, k: 1, preflight: async () => { preflightCalls++; return success({ ccVersion: 'stub' }); } }), io);
  expect(result.ok).toBe(!mixed); expect(preflightCalls).toBe(mixed ? 0 : 1);
  expect(io.lines[0]).toMatch(/^warning HYG6/);
  if (mixed) { expect(agentCalls).toBe(0); expect(result).toMatchObject({ error: expect.stringContaining('HYG2') }); }
  else { expect(agentCalls).toBeGreaterThan(0); expect(result).toMatchObject({ value: { executionStatus: 'complete' } }); }
});

describe('eval-in-app completion and eligibility', () => {
  it('writes a schema-valid local receipt — a local eval never commits (§6.3)', async () => {
    const { store, home, clone } = await evalFixture({ assets: { 'evals/cases/happy.yaml': CASE } });
    const before = await readFile(join(clone, 'team.json'), 'utf8');
    const result = await run(args(store, home, { noGen: true, k: 1, agent: generationAgent([]) }), new ScriptedPrompter());
    expect(result).toMatchObject({ ok: true });
    const receipt = receiptSchema.parse(JSON.parse(await readFile(join(result.value!.runDir, 'receipt.json'), 'utf8')));
    expect(receipt.provenance.runner_handle).toBe('seed');
    expect(receipt.schema_version).toBe(2);
    expect(await readFile(join(clone, 'team.json'), 'utf8')).toBe(before);
  });
});

/** What eval accepts at the top level, and its refusal of `hooks`, spelled out so the messages are pinned. */
const EVAL_FIELDS = 'name, description, license, metadata, allowed-tools, model, effort, context, agent, background, disallowed-tools, argument-hint, arguments, disable-model-invocation, user-invocable, when_to_use';
const HOOKS_DETAIL = 'unsupported top-level field hooks (hooks register commands that run on this machine, so eval does not run a skill that declares them)';

describe('D72 — the B3 full review highs on eval', () => {
  // An unknown key, not one of Claude Code's own fields: eval accepts those (see the describe below).
  const rejected = `---\nname: sample\ndescription: checks deployments\nfoo: x\n---\n`;
  const detail = `unsupported top-level field foo (eval accepts ${EVAL_FIELDS})`;

  it('a folder that exists but the scan rejected fails with its path and the scan’s detail, never the §6.3 miss', async () => {
    const { store, home, folder } = await evalFixture({ source: rejected });
    expect(await run(args(store, home, { agent: armAgent, k: 1 }), new ScriptedPrompter())).toMatchObject({ ok: false, error: `${folder} is not a usable skill folder: ${detail}` });
    // The miss is reserved for a name no Library root holds.
    expect(await run(args(store, home, { ref: 'ghost' }), new ScriptedPrompter())).toMatchObject({ ok: false, error: expect.stringContaining('No local skill folder named `ghost` in your library') });
  });

  it('queueing a rejected folder reports its path and the detail, and queues nothing for it', async () => {
    const { store, home, folder } = await evalFixture({ source: rejected });
    const lines: string[] = [];
    const items = await queueItemsFor({ home, config: await store.read(), stateRoot: store.root, names: ['sample'], requestedAt: '2026-09-13T00:00:00Z', window: 'later' }, (line) => lines.push(line));
    expect(items).toEqual([]);
    expect(lines).toEqual([`sample: ${folder} is not a usable skill folder: ${detail}; it was not queued.`]);
  });

  // Generation dry-runs each case's setup under `/bin/sh`, which Windows lacks (see lib/evals/__tests__/execution.test.ts).
  it.skipIf(process.platform === 'win32')('a write that fails part-way leaves no evals/cases and no staging folder behind, and reports it', async () => {
    const { folder } = await evalFixture();
    // The second file's path runs THROUGH the first, so its write fails (ENOTDIR) after the first
    // landed — the interruption that used to leave a partial set the next run adopted as authored.
    const saved = await saveGeneratedAssets(folder, { cases: { names: ['a', 'b'], files: { 'a.yaml': CASE, 'a.yaml/b.yaml': CASE } } })
      .catch((error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }));
    expect(saved).toMatchObject({ ok: false, error: expect.stringContaining('ENOTDIR') });
    expect(existsSync(join(folder, 'evals', 'cases'))).toBe(false);
    // Nothing of this call's making survives: not the staging folder, not the `evals/` made for it.
    expect(existsSync(join(folder, 'evals'))).toBe(false);
  });

  it('a successful generation leaves exactly the generated files under evals/, and no staging folder', async () => {
    const { store, home, folder } = await evalFixture();
    expect(await run(args(store, home, { agent: generationAgent([]), k: 1 }), new ScriptedPrompter())).toMatchObject({ ok: true });
    expect((await readdir(join(folder, 'evals'))).sort()).toEqual(['cases', 'triggers.yaml']);
    expect((await readdir(join(folder, 'evals', 'cases'))).sort()).toEqual(['happy-path.yaml', 'safe-command.yaml', 'unsafe-request.yaml']);
    expect(await stagingEntriesUnder(dirname(folder))).toEqual([]);
  });

  it('the D61 already-exists refusal fires before anything is staged', async () => {
    const { folder } = await evalFixture();
    await mkdir(join(folder, 'evals'), { recursive: true });
    await writeFile(join(folder, 'evals', 'triggers.yaml'), TRIGGERS);
    expect(await saveGeneratedAssets(folder, { triggers: TRIGGERS, cases: { names: ['a'], files: { 'a.yaml': CASE } } })).toMatchObject({ ok: false, error: expect.stringContaining('already exists') });
    expect(await readdir(join(folder, 'evals'))).toEqual(['triggers.yaml']);
  });
});

describe('Claude Code skill fields: eval measures the folder as Claude Code runs it', () => {
  // The shape of a real public skill (caveman-explore sets `model: haiku`): the field is how it saves
  // cost, so moving it under `metadata` to pass the publish rule would change what the run measures.
  const withFields = (fields: string) => skill().replace('license:', `${fields}license:`);
  const counted = () => {
    const calls = { preflight: 0, agent: 0 };
    const agent: AgentApi = { runAgent: async () => { calls.agent++; return transcript([]); }, askJson: async () => { calls.agent++; return { selected: [] }; } };
    return { calls, agent, preflight: async () => { calls.preflight++; return success({ ccVersion: 'stub' }); } };
  };

  it('runs a skill whose frontmatter sets model and argument-hint, and stages those exact bytes in the arms', async () => {
    const { store, home, folder } = await evalFixture({ source: withFields('model: haiku\nargument-hint: x\n'), assets: { 'evals/cases/happy.yaml': CASE } });
    const staged: string[] = [];
    const agent: AgentApi = {
      runAgent: async (_task, cwd) => {
        const copy = join(cwd, '.claude', 'skills', 'sample', 'SKILL.md');
        if (existsSync(copy)) staged.push(await readFile(copy, 'utf8'));
        return transcript(existsSync(copy) ? ['sample'] : []);
      },
      askJson: async () => ({ selected: ['sample'] }),
    };
    // The id comes from the folder's own metadata, exactly as for a folder the scan accepts.
    expect(await run(args(store, home, { agent, k: 1, noGen: true }), new ScriptedPrompter())).toMatchObject({ ok: true, value: { executionStatus: 'complete', id: ID } });
    expect(staged.length).toBeGreaterThan(0);
    for (const text of staged) expect(text).toContain('model: haiku\nargument-hint: x\n');
    // Eval only: the Library scan is unchanged, so publish still refuses the same folder.
    expect(await publishRun({ ref: 'sample', home, config: store }, new ScriptedPrompter())).toMatchObject({ ok: false, error: `${folder} is not a usable skill folder: unsupported top-level field model (only name, description, license, metadata, allowed-tools)` });
  });

  it.each([
    ['hooks', 'hooks:\n  Stop: []\n', HOOKS_DETAIL],
    ['an unknown key', 'foo: x\n', `unsupported top-level field foo (eval accepts ${EVAL_FIELDS})`],
  ])('still refuses %s beside a Claude Code field, naming the key, before preflight or any agent call', async (_label, extra, detail) => {
    // `model` comes first, so the scan's own rejection names `model`; the refusal has to name the key that is really wrong.
    const { store, home, folder } = await evalFixture({ source: withFields(`model: haiku\n${extra}`) });
    const { calls, agent, preflight } = counted();
    expect(await run(args(store, home, { agent, preflight }), new ScriptedPrompter())).toEqual({ ok: false, error: `${folder} is not a usable skill folder: ${detail}` });
    expect(calls).toEqual({ preflight: 0, agent: 0 });
  });

  it('checks what the scan never reached: a Claude Code field beside a malformed grant is refused for the grant', async () => {
    const { store, home, folder } = await evalFixture({ source: withFields('model: haiku\nallowed-tools:\n  bash: true\n') });
    expect(await run(args(store, home, { agent: counted().agent }), new ScriptedPrompter())).toEqual({ ok: false, error: `${folder} is not a usable skill folder: allowed-tools is malformed (SKILL.md line 5)` });
  });

  it('lets a rival that sets Claude Code fields into a head-to-head, and refuses one that declares hooks', async () => {
    const { store, home } = await evalFixture();
    const rival = join(home, '.claude', 'skills', 'rival-checker');
    await mkdir(rival, { recursive: true });
    await writeFile(join(rival, 'SKILL.md'), '---\nname: rival-checker\ndescription: also checks deployments\nmodel: haiku\neffort: low\n---\nprefer a dry run first');
    const briefAgent: AgentApi = { runAgent: async () => transcript([]), askJson: async () => ({ brief: 'Take a change that is ready and get it live without surprising anyone.' }) };
    // --derive-brief stops before any arm, after both folders have passed resolution and hygiene.
    expect(await run(args(store, home, { vs: 'rival-checker', deriveBrief: true, agent: briefAgent }), new NonInteractivePrompter())).toMatchObject({ ok: true, value: { derivedBriefOnly: true } });
    await writeFile(join(rival, 'SKILL.md'), '---\nname: rival-checker\ndescription: also checks deployments\nhooks:\n  Stop: []\n---\n');
    expect(await run(args(store, home, { vs: 'rival-checker', deriveBrief: true, agent: briefAgent }), new NonInteractivePrompter())).toEqual({ ok: false, error: `${rival} is not a usable skill folder: ${HOOKS_DETAIL}` });
  });

  it('the batch and the queue let the same folder through, and refuse hooks in the same words', async () => {
    const { store, home, folder } = await evalFixture({ source: withFields('model: haiku\n') });
    const evaluate = vi.fn(async (evalArgs: EvalArgs) => success({ team: null, id: null, name: evalArgs.ref!, runDir: '', ccVersion: 'stub', executionStatus: 'complete' as const }));
    const queue = async (lines: string[]) => queueItemsFor({ home, config: await store.read(), stateRoot: store.root, names: ['sample'], requestedAt: '2026-09-27T00:00:00Z', window: 'later' }, (line) => lines.push(line));
    const lines: string[] = [];
    expect(await queue(lines)).toMatchObject([{ skill: 'sample', path: folder }]);
    expect(lines).toEqual([]);
    expect(await runMany({ refs: ['sample'], home, config: store, preflight: stub, evaluate }, new ScriptedPrompter())).toMatchObject({ ok: true, value: { skills: ['sample'], ok: 1 } });

    await writeFile(join(folder, 'SKILL.md'), withFields('model: haiku\nhooks:\n  Stop: []\n'));
    const refusal = `${folder} is not a usable skill folder: ${HOOKS_DETAIL}`;
    expect(await queue(lines)).toEqual([]);
    expect(lines).toEqual([`sample: ${refusal}; it was not queued.`]);
    expect(await runMany({ refs: ['sample'], home, config: store, preflight: stub, evaluate }, new ScriptedPrompter())).toEqual({ ok: false, error: refusal });
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
});

describe('B3 confirmation review — where saveGeneratedAssets stages, and what its failure says', () => {
  // Generation dry-runs each case's setup under `/bin/sh`, which Windows lacks (see lib/evals/__tests__/execution.test.ts).
  it.skipIf(process.platform === 'win32')('stages in the skill folder’s parent, never inside it, so a crash mid-write cannot leave a folder publish would digest', async () => {
    // Confirmation-review HIGH 2 on refactor/b3-versions-keystone: the staging folder was
    // `<skill>/evals/.generated.terum-*`, inside the tree `sourceFiles`/`skillContentDigest` walk
    // (D2's ignore list is fixed and `evals/` is digested by D9), so a SIGKILL between `mkdtemp` and
    // the cleanup left a hidden folder the next publish shipped as version bytes. The rollback path
    // cannot run for that interruption, so the only proof is WHERE the folder is made.
    const { folder } = await evalFixture();
    const spy = vi.spyOn(fs, 'mkdtemp');
    let saved; let prefixes: string[] = [];
    // The second case file's path runs THROUGH the first (ENOTDIR), so the run fails after staging.
    // The calls are read before `mockRestore`, which clears them along with the spy.
    try {
      saved = await saveGeneratedAssets(folder, { triggers: TRIGGERS, cases: { names: ['a', 'b'], files: { 'a.yaml': CASE, 'a.yaml/b.yaml': CASE } } });
      prefixes = spy.mock.calls.map((call) => String(call[0]));
    } finally { spy.mockRestore(); }
    expect(saved).toMatchObject({ ok: false, error: expect.stringContaining('ENOTDIR') });
    expect(prefixes).toEqual([join(dirname(folder), '.generated.terum-')]);
    expect(prefixes[0]!.startsWith(folder + sep)).toBe(false);
    // Nothing of the staging survives anywhere: not under the skill folder at any depth, not beside it.
    expect(await stagingEntriesUnder(folder)).toEqual([]);
    expect(await stagingEntriesUnder(dirname(folder))).toEqual([]);
  });

  it('when cases landed and the triggers rename then fails, the message says which landed and evals/cases stays whole', async () => {
    // Confirmed medium beside HIGH 2: the failure sentence claimed "Nothing was left in the skill
    // folder" whatever had already landed. The renames are per asset, cases first, so a triggers
    // failure leaves `evals/cases` whole — which the next run rightly treats as authored (D29) — and
    // a user who believed the sentence would delete a good asset to start clean.
    const { folder } = await evalFixture();
    const triggers = join(folder, 'evals', 'triggers.yaml');
    const original = fs.rename;
    // The second rename has to fail for real AFTER the first succeeded. No on-disk shape does that:
    // the D61 pre-check reads the destination, so a directory or a symlink at `triggers.yaml` is
    // refused before staging, and a dangling link is simply replaced by the rename. Inject the
    // refusal the volume would give (the local-skills.test.ts EACCES pattern), on that path only.
    const spy = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      if (String(to) === triggers) throw Object.assign(new Error(`EACCES: simulated, rename '${String(from)}' -> '${triggers}'`), { code: 'EACCES' });
      return original(from, to);
    });
    let saved;
    try { saved = await saveGeneratedAssets(folder, { triggers: TRIGGERS, cases: { names: ['a'], files: { 'a.yaml': CASE } } }); }
    finally { spy.mockRestore(); }
    expect(saved).toMatchObject({ ok: false, error: expect.stringContaining('EACCES: simulated') });
    const error = saved.ok ? '' : saved.error;
    expect(error).toContain('evals/cases/ landed whole');
    expect(error).toContain('evals/triggers.yaml was not written');
    expect(error).not.toContain('Nothing was left');
    expect((await readdir(join(folder, 'evals'))).sort()).toEqual(['cases']);
    expect(await readFile(join(folder, 'evals', 'cases', 'a.yaml'), 'utf8')).toBe(CASE);
    expect(await stagingEntriesUnder(dirname(folder))).toEqual([]);
  });
});

describe('eval --vs head-to-head (IE6)', () => {
  const rivalSkill = `---\nname: rival-checker\ndescription: also checks deployments\nlicense: UNLICENSED\nmetadata:\n  id: 22222222-2222-4222-8222-222222222222\n  author: Seed <seed@example.com>\n  terum-category: testing\n---\nprefer a dry run first`;

  /** Two Library folders, so both refs resolve the way §6.3 resolves the candidate. */
  const pairFixture = async () => {
    const base = await evalFixture();
    const rival = join(base.home, '.claude', 'skills', 'rival-checker');
    await mkdir(rival, { recursive: true });
    await writeFile(join(rival, 'SKILL.md'), rivalSkill);
    return base;
  };

  const briefText = 'Take a change that is ready and get it live without surprising anyone.';
  const pairAgent: AgentApi = {
    runAgent: (_task, cwd) => {
      const staged = ['sample', 'rival-checker'].find((name) => existsSync(join(cwd, '.claude', 'skills', name)));
      return Promise.resolve(transcript(staged === undefined ? [] : [staged]));
    },
    askJson: (prompt) => {
      if (prompt.includes('Describe THE JOB')) return Promise.resolve({ brief: briefText });
      if (prompt.includes('Generate headlessly answerable')) {
        return Promise.resolve({ cases: ['a', 'b', 'c', 'd', 'e'].map((stem, index) => ({
          name: `case-${stem}`, task: `Ship step ${index + 1}.`,
          checks: [{ transcript_mentions: 'deployed' }], bucket: index === 4 ? 'adversarial' : 'explicit',
        })) });
      }
      return Promise.resolve({ selected: ['sample'] });
    },
  };
  const noAgent = (counter: { calls: number }): AgentApi => ({
    runAgent: () => { counter.calls++; return Promise.resolve(transcript([])); },
    askJson: () => { counter.calls++; return Promise.resolve({}); },
  });

  it.each([
    ['--commit', { commit: true }, 'never committed'],
    ['--case', { case: 'happy' }, 'authored assertion'],
    ['--no-gen', { noGen: true }, 'generated from the shared brief'],
    ['--triggers-only', { triggersOnly: true }, 'execution only'],
  ])('refuses --vs with %s before any agent call', async (_label, extra, fragment) => {
    const { store, home } = await pairFixture();
    const counter = { calls: 0 };
    const result = await run(args(store, home, { vs: 'rival-checker', agent: noAgent(counter), ...extra }), new ScriptedPrompter([], [], true));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining(fragment) });
    expect(counter.calls).toBe(0);
  });

  it('refuses a rival that resolves to the same folder, and one that is not in the library', async () => {
    const { store, home } = await pairFixture();
    const counter = { calls: 0 };
    expect(await run(args(store, home, { vs: 'sample', agent: noAgent(counter) }), new ScriptedPrompter([], [], true)))
      .toMatchObject({ ok: false, error: expect.stringContaining('two different skills') });
    expect(await run(args(store, home, { vs: 'not-a-skill', agent: noAgent(counter) }), new ScriptedPrompter([], [], true)))
      .toMatchObject({ ok: false, error: expect.stringContaining('No local skill folder named') });
    expect(counter.calls).toBe(0);
  });

  it('refuses a closed channel by naming the two ways out, not by throwing PromptClosedError', async () => {
    const { store, home } = await pairFixture();
    const counter = { calls: 0 };
    const result = await run(args(store, home, { vs: 'rival-checker', agent: noAgent(counter) }), new NonInteractivePrompter());
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('--derive-brief') });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('--brief <path>') });
    expect(counter.calls).toBe(0);
  });

  it('--derive-brief writes the brief and stops without running a single arm', async () => {
    const { store, home } = await pairFixture();
    let arms = 0;
    const counting: AgentApi = { runAgent: (...rest) => { arms++; return pairAgent.runAgent(...rest); }, askJson: pairAgent.askJson };
    // The app's half of the gate: a closed channel is fine precisely because nothing runs.
    const result = await run(args(store, home, { vs: 'rival-checker', deriveBrief: true, agent: counting }), new NonInteractivePrompter());
    expect(result).toMatchObject({ ok: true, value: { derivedBriefOnly: true, brief: briefText } });
    expect(arms).toBe(0);
    if (!result.ok) return;
    expect(await readFile(result.value.briefPath!, 'utf8')).toContain(briefText);
  });

  it('--derive-brief needs --vs, and refuses to be combined with --brief', async () => {
    const { store, home } = await pairFixture();
    expect(await run(args(store, home, { deriveBrief: true, agent: armAgent }), new ScriptedPrompter([], [], true)))
      .toMatchObject({ ok: false, error: expect.stringContaining('--vs <other-skill>') });
    expect(await run(args(store, home, { vs: 'rival-checker', deriveBrief: true, brief: '/tmp/b.md', agent: armAgent }), new ScriptedPrompter([], [], true)))
      .toMatchObject({ ok: false, error: expect.stringContaining('one or the other') });
  });

  it('runs the two-step the app drives: derive, then run with the reviewed brief', async () => {
    const { store, home } = await pairFixture();
    const derived = await run(args(store, home, { vs: 'rival-checker', deriveBrief: true, agent: pairAgent }), new NonInteractivePrompter());
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;

    const io = new ScriptedPrompter([], [], false);
    const result = await run(args(store, home, { vs: 'rival-checker', brief: derived.value.briefPath!, k: 1, agent: pairAgent }), io);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.receiptPath).toBeUndefined(); // §5.2: no receipt, ever
    const report = io.lines.join('\n');
    expect(report).toContain('head-to-head: sample vs rival-checker');
    expect(report).toMatch(/candidate-vs-rival: .*sign test p=/);
    expect(report).not.toMatch(/^verdict:/m);
    expect(report).toContain('(supplied)');
  });

  it('checks a supplied brief instead of trusting it', async () => {
    const { store, home } = await pairFixture();
    const named = join(home, 'named.md');
    await writeFile(named, 'Use rival-checker to get the change live.', 'utf8');
    const counter = { calls: 0 };
    let preflights = 0;
    // §1.2: the deterministic checks precede every agent call — preflight is itself one (§7.4).
    expect(await run(args(store, home, { vs: 'rival-checker', brief: named, agent: noAgent(counter), preflight: async () => { preflights++; return success({ ccVersion: 'stub' }); } }), new NonInteractivePrompter()))
      .toMatchObject({ ok: false, error: expect.stringContaining("names 'rival-checker'") });
    expect(counter.calls).toBe(0);
    expect(preflights).toBe(0);
  });
});

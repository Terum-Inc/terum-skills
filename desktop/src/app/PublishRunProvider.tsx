import { useContext, useRef, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { driveRun, PrintContext, PromptContext, useBackend } from '../backend';
import { PromptCancelledError, type PublishResult, type Result, type Run } from '../backend/types';
import { localActionReason, localRef } from '../components/domain/skill-card-actions';
import { publishOutcomeText } from '../screens/skill/publish-outcome';
import type { BulkPublishSummary, BulkRowState } from '../screens/library/bulk-publish';
import { affects } from './invalidation';
import { PublishRunContext, type PublishRow, type PublishRunApi, type PublishRunState, type PublishRunStart } from './publish-run-context';

/** App lifetime, independent of routes. Only explicit Stop or native quit cancels a publish. There is no unmount cleanup here on purpose — do not add one. */
export function PublishRunProvider({ children }: PropsWithChildren) {
 const backend = useBackend(), ask = useContext(PromptContext), print = useContext(PrintContext), client = useQueryClient();
 const [current, setCurrent] = useState<PublishRunState | null>(null), [dialogOpen, setDialogOpen] = useState(false);
 const live = useRef<PublishRunState | null>(null), settler = useRef<((final: PublishRunState) => void) | null>(null), listeners = useRef(new Set<(final: PublishRunState) => void>()), inFlight = useRef(false), stopRequested = useRef(false), abandoned = useRef(false), activeRun = useRef<Run<PublishResult | PublishResult[]> | null>(null), landed = useRef(0);
 function update(next: PublishRunState | null) { live.current = next; setCurrent(next); }
 /** Resolves the `settled` promise handed out by `start` with the final snapshot; called once per run, on every way out. */
 // Exactly one delivery per subscriber: a snapshot, so a listener that subscribes during the fan-out is served by
 // `subscribe`'s own replay and not again here; and one listener's throw never starves the next.
 function settle() { const final = live.current, resolve = settler.current; settler.current = null; if (!final) return; if (resolve) resolve(final); for (const listener of [...listeners.current]) { try { listener(final); } catch (error) { console.error(error); } } }
 const settled = (run: PublishRunState | null): run is PublishRunState => run !== null && run.state !== 'running' && run.state !== 'stopping';
 function subscribe(listener: (final: PublishRunState) => void) { listeners.current.add(listener); const now = live.current; if (settled(now)) listener(now); return () => { listeners.current.delete(listener); }; }
 function assertAvailable() {
  if (!inFlight.current) return;
  const rows = live.current?.rows ?? [];
  throw new Error(rows.length === 1 ? `A publish is already running for ${rows[0]?.card.name ?? 'another skill'}.` : `A publish is already running for ${rows.length} skills.`);
 }
 function setRows(rows: readonly PublishRow[]) { const active = live.current; if (active) update({ ...active, rows }); }
 function setRow(key: string, state: BulkRowState) {
  const active = live.current;
  if (active) update({ ...active, rows: active.rows.map(row => row.key === key ? { ...row, state } : row) });
 }
 function summary(rows: readonly PublishRow[], attempted: number): BulkPublishSummary {
  return { published: rows.filter(row => row.state.kind === 'done').length, attempted, failed: rows.filter(row => row.state.kind === 'failed').length };
 }
 async function drive(rows: readonly PublishRow[], flags: PublishRunState['flags'], team: string | undefined) {
  const ready = rows.filter(row => row.state.kind === 'ready');
  let published = 0, failed = 0;
  setRows(rows.map(row => row.state.kind === 'ready' ? { ...row, state: { kind: 'queued' } } : row));
  if (ready.length) {
   // ONE process for the whole selection (CLI `publish <ref...>`): one refresh, one answer per
   // question, one push. A selection of one keeps the single-skill verb, whose separate profile
   // write and separate failure reporting are deliberate and do not need a batch.
   const refs = ready.map(row => localRef(row.card));
   const byRef = new Map(ready.map((row, index) => [refs[index]!, row]));
   // Every ready row is in flight at once, because the run is one push for all of them. Leaving the
   // rest 'Queued' would be the sequential queue's story told about a batch that has no queue.
   setRows((live.current?.rows ?? rows).map(row => row.state.kind === 'queued' ? { ...row, state: { kind: 'publishing', label: null } } : row));
   let result: Result<PublishResult[]>;
   let run: Run<PublishResult | PublishResult[]> | null = null;
   try {
    run = refs.length === 1
     ? backend.publish({ ref: refs[0]!, ...flags, ...(team === undefined ? {} : { team }) })
     : backend.publishMany({ refs, ...flags, ...(team === undefined ? {} : { team }) });
    activeRun.current = run;
    // A force-abandoned run (D2) is one the app stopped waiting for: a question it asks afterwards is withdrawn, not shown.
    const started = run;
    const askUnlessAbandoned: typeof ask = (question, options) => abandoned.current || activeRun.current !== started ? Promise.reject(new PromptCancelledError('The app stopped waiting for this publish.')) : ask(question, options);
    const outcome = await driveRun<PublishResult | PublishResult[]>(run, {}, askUnlessAbandoned, print, frame => {
     if (abandoned.current || activeRun.current !== started) return;
     // `item` is the CLI saying which skill this rung is about. Without it there is no honest way to
     // light one row - inferring by order is wrong the moment an item is skipped - so a rung that
     // names nobody moves the board's progress and leaves the rows alone.
     const row = frame.item === undefined ? undefined : byRef.get(frame.item);
     if (row) setRow(row.key, { kind: 'publishing', label: frame.label ?? null });
     const active = live.current;
     if (active) update({ ...active, progress: frame });
    });
    // One shape from here down: the single-skill verb answers with one result, the batched one with
    // an array, and a row maps to its outcome by index either way.
    if (outcome.ok) result = { ok: true, value: Array.isArray(outcome.value) ? outcome.value : [outcome.value] };
    else { const { value, ...rest } = outcome; result = value === undefined ? rest : { ...rest, value: Array.isArray(value) ? value : [value] }; }
   } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : 'Publish failed.' };
   }
   if (abandoned.current || activeRun.current !== run) return;
   activeRun.current = null;
   if (!result.ok && result.value === undefined) {
    // The run itself failed or was cancelled: one push means one verdict for every row in it.
    const cancelled = result.cancelled || (stopRequested.current && result.error === 'Cancelled.');
    if (cancelled) stopRequested.current = true; else failed = ready.length;
    for (const row of ready) setRow(row.key, cancelled ? { kind: 'cancelled' } : { kind: 'failed', error: result.error });
   } else {
    // A cancellation that lost the race still carries the outcome: the versions are in the repo.
    if (!result.ok) stopRequested.current = true;
    const outcomes = result.value ?? [];
    for (const [index, row] of ready.entries()) {
     const outcome = outcomes[index];
     if (outcome === undefined) { failed += 1; setRow(row.key, { kind: 'failed', error: result.ok ? 'terum-skills reported no outcome for this skill.' : result.error }); continue; }
     // A batch refuses one skill without costing the others theirs; `refused` is why, from the CLI.
     if (outcome.refused) { failed += 1; setRow(row.key, { kind: 'failed', error: outcome.refused }); continue; }
     published += 1;
     const text = publishOutcomeText(row.card.name, outcome);
     setRow(row.key, { kind: 'done', text: result.ok ? text : `${text} ${result.error}` });
    }
    landed.current = published;
   }
  }
  if (abandoned.current) return;
  inFlight.current = false;
  const active = live.current;
  if (active) {
   const finished = summary(active.rows, ready.length);
   const state = stopRequested.current ? 'stopped' : failed > 0 && ready.length === 1 ? 'failed' : 'done';
   update({ ...active, state, summary: { ...finished, published, failed } });
  }
  if (landed.current > 0) void client.invalidateQueries({ predicate: query => affects('clone', query.queryKey) });
  settle();
 }
 const start: PublishRunApi['start'] = args => {
  assertAvailable();
  // The Library's grid is fresh and its question shows Skipped rows up front, so the gate belongs here for it. The
  // skill page gates its own button on live data and publishes a folder it may just have repaired, whose query data
  // still says `broken` — re-gating on that stale card would silently skip the one publish the person asked for.
  const rows = args.cards.map(card => {
   const reason = args.origin === 'library' ? localActionReason(card, 'publish') : null;
   return { key: card.path ?? card.name, card, state: reason === null ? { kind: 'ready' as const } : { kind: 'skipped' as const, reason } };
  });
  inFlight.current = true; stopRequested.current = false; abandoned.current = false; landed.current = 0;
  // Monotonic: two runs a millisecond apart must not share an identity (the Library acknowledges by it).
  const startedAt = Math.max(Date.now(), (live.current?.startedAt ?? 0) + 1);
  const settled = new Promise<PublishRunState>(resolve => { settler.current = resolve; });
  update({ rows, origin: args.origin, ...(args.scope === undefined ? {} : { scope: args.scope }), reported: false, flags: args.flags, ...(args.team === undefined ? {} : { team: args.team }), startedAt, state: 'running' });
  setDialogOpen(args.openBoard !== false);
  void drive(rows, args.flags, args.team);
  const result: PublishRunStart = { startedAt, settled };
  return result;
 };
 function acknowledge(startedAt: number) { const active = live.current; if (active && active.startedAt === startedAt && !active.reported) update({ ...active, reported: true }); }
 async function stop() {
  const active = live.current;
  if (!active) return;
  if (active.state === 'running') {
   stopRequested.current = true;
   update({ ...active, state: 'stopping', rows: active.rows.map(row => row.state.kind === 'queued' ? { ...row, state: { kind: 'not-started' } } : row) });
   // A cancel the bridge refuses leaves the row publishing; the second Stop below is the way out, so the rejection is not an error of its own.
   void activeRun.current?.cancel().catch(() => {});
   return;
  }
  if (active.state !== 'stopping') return;
  abandoned.current = true; inFlight.current = false;
  const rows = active.rows.map(row => row.state.kind === 'publishing' ? { ...row, state: { kind: 'abandoned' as const } } : row.state.kind === 'queued' ? { ...row, state: { kind: 'not-started' as const } } : row);
  activeRun.current = null;
  update({ ...active, rows, state: 'stopped', summary: summary(rows, active.rows.filter(row => row.state.kind !== 'skipped').length) });
  void client.invalidateQueries({ predicate: query => affects('clone', query.queryKey) });
  settle();
 }
 // UI policy §5: closing the board never forgets the run — the chip stays ("Publish finished · …") until its ✕ or the next run.
 function dismiss() { setDialogOpen(false); }
 function clear() { setDialogOpen(false); if (!inFlight.current) update(null); }
 return <PublishRunContext value={{ current, dialogOpen, start, acknowledge, subscribe, isRunning: () => inFlight.current, stop, dismiss, clear, show: () => setDialogOpen(true) }}>{children}</PublishRunContext>;
}

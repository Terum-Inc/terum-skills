import type { Frame, Result, Run } from '../types';
import type { AppState, Bridge, LineEvent } from './bridge';
import { parseCliFrame, type CliFrame } from './frames';

export const NO_STATE = 'The desktop app could not find where terum-skills is installed. Run `terum-skills app` from a terminal once; it records the location and opens this app.';

/**
 * Frame-protocol rule 1: a CLI older than 0.1.6 asks this confirm instead of printing (src/lib/auth.ts at
 * 0.1.5). A yes would run `gh auth login` with inherited stdio — here the frame pipes — and wedge the run
 * forever, so the shell answers no itself and never shows the question.
 */
export const GH_LOGIN_OFFER = 'GitHub CLI is installed but logged out. Run `gh auth login` now?';
/** What a 0.1.6+ CLI prints in frame mode instead of asking; shown in place of the swallowed confirm. */
export const GH_LOGIN_REMEDY = 'GitHub CLI is installed but logged out. Run `gh auth login` in a terminal, then try again.';

let serial = 0;
function nextId(): string {
  serial += 1;
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `r${serial}-${random}`;
}

export interface CliRunOptions<TIn, TOut> {
  cwd?: string | undefined;
  map(value: TIn): TOut;
  onHello?(frame: Extract<CliFrame, { t: 'hello' }>): void;
  onSettled?(result: Result<TOut>): void;
}

/**
 * One CLI process as a seam `Run<T>`: spawn `terum-skills --frames <argv>`, turn its frames into the seam's
 * frames, forward answers, and settle `done` from the `result` frame. Frames are buffered so a consumer that
 * subscribes late still sees every one (same contract as the mock's createRun).
 */
export function cliRun<TIn, TOut>(bridge: Bridge, state: Promise<AppState | null>, argv: readonly (string | Promise<string>)[], options: CliRunOptions<TIn, TOut>): Run<TOut> {
  // Attach rejection handling immediately; path expansion can fail before launch state resolves.
  const argumentsReady = Promise.all(argv).then(value=>({ok:true as const,value}), (error:unknown)=>({ok:false as const,error:error instanceof Error?error.message:String(error)}));
  const id = nextId();
  const buffer: Frame[] = [];
  const readers = new Set<() => void>();
  let finished = false;
  let started = false;
  let spawnSettled: Promise<void> | undefined;
  let sawHello = false;
  let cancelled = false;
  let settle!: (result: Result<TOut>) => void;
  const done = new Promise<Result<TOut>>((resolve) => { settle = resolve; });
  // Channel diagnostics — stderr lines, unparseable stdout, stdout after settle — quoted when the run dies without a result.
  const diagnostics: string[] = [];
  let unlisten: (() => void) | undefined;
  let cleanupRequested = false;
  const cleanup = () => {
    cleanupRequested = true;
    const stop = unlisten;
    unlisten = undefined;
    stop?.();
  };

  const push = (frame: Frame) => { if (finished) return; buffer.push(frame); for (const wake of readers) wake(); readers.clear(); };
  const finish = (result: Result<TOut>, frame?: Frame) => {
    if (finished) return;
    if (frame) push(frame); else push({ t: 'result', ok: result.ok, ...(result.ok ? {} : { error: result.error }) });
    finished = true;
    for (const wake of readers) wake();
    readers.clear();
    settle(result);
    options.onSettled?.(result);
  };

  const onEvent = (event: LineEvent) => {
    if (finished && event.kind !== 'exit') {
      if (event.kind === 'stdout') diagnostics.push(`stdout after settle: ${event.line}`);
      return;
    }
    switch (event.kind) {
      case 'stdout': {
        const frame = parseCliFrame(event.line, line => diagnostics.push(line));
        if (!frame) { diagnostics.push(`unparseable line from terum-skills: ${event.line.slice(0, 200)}`); return; }
        onFrame(frame);
        return;
      }
      case 'stderr': diagnostics.push(event.line); return;
      case 'exit': {
        if (!finished) {
          // No hello means the CLI never spoke the protocol at all — almost always a pre-0.1.5 bin with no
          // --frames support, which Commander rejects as text. Name the remedy instead of a cryptic per-verb failure.
          const why = sawHello ? 'before reporting a result.' : 'without a hello frame — this terum-skills is probably older than 0.1.5, before frame mode existed. Update terum-skills, then run `terum-skills app` from a terminal again.';
          finish({ ok: false, error: cancelled ? 'Cancelled.' : `terum-skills exited${event.code === null ? '' : ` with code ${event.code}`} ${why}${diagnostics.length ? ` ${diagnostics.slice(-3).join(' ')}` : ''}` });
        }
        cleanup();
        return;
      }
      case 'error': finish({ ok: false, error: event.message }); return;
    }
  };
  const onFrame = (frame: CliFrame) => {
    switch (frame.t) {
      case 'hello': {
        sawHello = true;
        if (frame.protocol !== 1) {
          // The protocol number only moves when the meaning of an existing field changes (docs/frame-protocol.md
          // §Versioning), so a mismatch means this app cannot read this CLI. Stop before a verb misbehaves.
          finish({ ok: false, error: `terum-skills${frame.version === null ? '' : ` ${frame.version}`} speaks frame protocol ${frame.protocol}; this app speaks protocol 1. ${frame.protocol > 1 ? 'Update the desktop app.' : 'Update terum-skills, then run `terum-skills app` from a terminal again.'}` });
          void bridge.kill(id).catch(() => undefined);
          return;
        }
        options.onHello?.(frame);
        return;
      }
      case 'print': push({ t: 'print', line: frame.level === 'info' ? frame.line : `${frame.level}: ${frame.line}` }); return;
      case 'ask': {
        if (frame.kind === 'confirm' && frame.question === GH_LOGIN_OFFER) {
          // Rule 1: only a pre-0.1.6 CLI asks this over frames; answer no for the person and say what to do.
          push({ t: 'print', line: GH_LOGIN_REMEDY });
          void bridge.write(id, JSON.stringify({ t: 'answer', id: frame.id, value: false })).catch((error: unknown) => finish({ ok: false, error: `Could not answer terum-skills: ${error instanceof Error ? error.message : String(error)}` }));
          return;
        }
        push({ t: 'ask', id: frame.id, kind: frame.kind, question: frame.question, ...(frame.default === undefined ? {} : { default: frame.default }), ...(frame.choices === undefined ? {} : { choices: frame.choices }), ...(frame.detail === undefined ? {} : { detail: frame.detail }), ...(frame.descriptions === undefined ? {} : { descriptions: frame.descriptions }) });
        return;
      }
      case 'progress': { const current = frame.current ?? 0; push({ t: 'progress', done: current, total: Math.max(frame.total ?? current, current, 1), label: frame.step, ...(frame.item === undefined ? {} : { item: frame.item }) }); return; }
      case 'result': {
        if (frame.ok) {
          let mapped: TOut | undefined;
          let unreadable: string | undefined;
          try { mapped = options.map(frame.value as TIn); } catch (error) { unreadable = error instanceof Error ? error.message : String(error); }
          if (cancelled) {
            // The verb finished before the cancel landed: its mutation is on disk, so the settle must say so
            // (and carry the value so invalidation still runs), never report a clean cancellation.
            const error = `Cancelled, but ${frame.verb} had already finished; its changes are on disk.`;
            finish({ ok: false, error, ...(unreadable === undefined && mapped !== undefined ? { value: mapped } : {}) }, { t: 'result', ok: false, error });
            return;
          }
          if (unreadable !== undefined) { finish({ ok: false, error: `terum-skills answered, but the desktop app could not read the result: ${unreadable}` }); return; }
          finish({ ok: true, value: mapped as TOut }, { t: 'result', ok: true });
        } else {
          let value: TOut | undefined;
          if (frame.value !== undefined) {
            try { value = options.map(frame.value as TIn); } catch { value = undefined; }
          }
          if (cancelled) {
            // A failing result during cancellation is still a cancellation, but a partial value (eval's
            // completed run whose receipt commit failed) has mutated disk and must reach invalidation.
            finish({ ok: false, error: 'Cancelled.', ...(value === undefined ? {} : { value }) }, { t: 'result', ok: false, error: 'Cancelled.' });
            return;
          }
          const error = frame.error ?? 'terum-skills reported a failure.';
          finish({ ok: false, error, ...(frame.refused === true ? { refused: true } : {}), ...(frame.declined === true ? { cancelled: true } : {}), ...(value === undefined ? {} : { value }) }, { t: 'result', ok: false, error, ...(frame.refused === true ? { refused: true } : {}), ...(frame.declined === true ? { declined: true } : {}) });
        }
        return;
      }
    }
  };

  // Deferred start so the consumer can subscribe to frames before the first one; mirrors the mock.
  void Promise.resolve().then(async () => {
    if (finished) return;
    const resolved = await state.catch((error: unknown) => { finish({ ok: false, error: error instanceof Error ? error.message : String(error) }); return null; });
    if (finished) return;
    if (!resolved) { finish({ ok: false, error: NO_STATE }); return; }
    const argumentsResult = await argumentsReady;
    if (finished) return;
    if (!argumentsResult.ok) { finish({ok:false,error:argumentsResult.error}); return; }
    started = true;
    spawnSettled = (async () => {
      try {
        unlisten = await bridge.spawn(id, resolved, argumentsResult.value, options.cwd, onEvent);
        // A short-lived child can exit (or be cancelled) before spawn returns the listener.
        if (cleanupRequested) cleanup();
      } catch (error) {
        finish({ ok: false, error: `Could not start terum-skills: ${error instanceof Error ? error.message : String(error)}` });
      }
    })();
  });

  return {
    done,
    frames: {
      async *[Symbol.asyncIterator]() {
        let cursor = 0;
        while (true) {
          const frame = buffer[cursor];
          if (frame) { cursor++; yield structuredClone(frame); continue; }
          if (finished) return;
          await new Promise<void>((resolve) => readers.add(resolve));
        }
      },
    },
    answer(askId, value) {
      if (finished) return;
      void bridge.write(id, JSON.stringify({ t: 'answer', id: askId, value })).catch((error: unknown) => finish({ ok: false, error: `Could not answer terum-skills: ${error instanceof Error ? error.message : String(error)}` }));
    },
    async cancel() {
      if (!finished) {
        cancelled = true;
        if (started) {
          // A spawn still in flight has no registered child to signal: write and kill would both miss it
          // ("no such process") and the just-spawned verb would run to completion behind a "Cancelled." settle.
          // Wait for the spawn to resolve, then signal the child it registered.
          await spawnSettled;
          if (!finished) {
            await bridge.write(id, JSON.stringify({ t: 'cancel' })).catch(() => undefined);
            await bridge.kill(id).catch(() => undefined);
          }
        }
        finish({ ok: false, error: 'Cancelled.' });
      }
      cleanup();
      await done;
    },
  };
}

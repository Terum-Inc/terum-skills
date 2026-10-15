/**
 * The CLI's frame protocol (terum-skills docs/frame-protocol.md, protocol 1), as the adapter reads it. These
 * are the CLI's shapes, kept separate from the seam's `Frame` in ../types on purpose: the CLI owns its wire
 * format, the seam owns what screens see, and `run.ts` is the only place that maps one to the other.
 */
export type CliLevel = 'info' | 'warn' | 'error';
export type CliAskKind = 'confirm' | 'text' | 'select' | 'path';
export type CliFrame =
  | { t: 'hello'; protocol: number; version: string | null; verbs: readonly string[]; features: Readonly<Record<string, boolean>> }
  | { t: 'print'; level: CliLevel; line: string }
  | { t: 'ask'; id: string; kind: CliAskKind; question: string; default?: string; choices?: readonly string[]; detail?: readonly string[]; descriptions?: readonly string[] }
  | { t: 'progress'; step: string; current?: number; total?: number; item?: string }
  | { t: 'result'; verb: string; ok: boolean; exitCode: number; error?: string; declined?: boolean; refused?: boolean; value?: unknown };
export type CliInbound = { t: 'answer'; id: string; value: string | number | boolean } | { t: 'cancel' };

// Every kind the CLI emits (src/lib/frames.ts AskKind): `path` is a text ask with a folder picker, and dropping it here made every real `project add` question vanish.
const KINDS = new Set<string>(['confirm', 'text', 'select', 'path']);
const LEVELS = new Set(['info', 'warn', 'error']);
const str = (v: unknown): v is string => typeof v === 'string';

/** One stdout line to one frame; anything that is not a well-formed frame is null (the caller reports it). */
export function parseCliFrame(line: string, diagnostic?: (line: string) => void): CliFrame | null {
  let raw: unknown;
  try { raw = JSON.parse(line); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  switch (f['t']) {
    case 'hello':
      return typeof f['protocol'] === 'number' && Array.isArray(f['verbs']) && f['features'] && typeof f['features'] === 'object'
        ? { t: 'hello', protocol: f['protocol'], version: str(f['version']) ? f['version'] : null, verbs: (f['verbs'] as unknown[]).filter(str), features: f['features'] as Record<string, boolean> }
        : null;
    case 'print':
      return str(f['line']) && str(f['level']) && LEVELS.has(f['level']) ? { t: 'print', level: f['level'] as CliLevel, line: f['line'] } : null;
    case 'ask': {
      if (!str(f['id']) || !str(f['question']) || !str(f['kind']) || !KINDS.has(f['kind'])) return null;
      const frame: Extract<CliFrame, { t: 'ask' }> = { t: 'ask', id: f['id'], kind: f['kind'] as CliAskKind, question: f['question'] };
      if (str(f['default'])) frame.default = f['default'];
      // Answers may name a choice by 1-based index, so positions are load-bearing: a non-string entry cannot
      // be dropped without shifting every later index. Such an ask is malformed; fail the frame, not silently.
      if (Array.isArray(f['choices'])) {
        if (!(f['choices'] as unknown[]).every(str)) return null;
        frame.choices = f['choices'] as string[];
      }
      if (f['detail'] !== undefined && (!Array.isArray(f['detail']) || !f['detail'].every(str))) diagnostic?.('Malformed ask detail from terum-skills; invalid entries omitted.');
      const detail = Array.isArray(f['detail']) ? f['detail'].filter(str) : [];
      if (detail.length) frame.detail = detail;
      if (Array.isArray(f['descriptions']) && f['descriptions'].every(str) && f['descriptions'].length === frame.choices?.length) frame.descriptions = f['descriptions'];
      else if (f['descriptions'] !== undefined) diagnostic?.('Malformed ask descriptions from terum-skills; descriptions omitted.');
      return frame;
    }
    case 'progress': {
      if (!str(f['step'])) return null;
      const frame: Extract<CliFrame, { t: 'progress' }> = { t: 'progress', step: f['step'] };
      if (typeof f['current'] === 'number') frame.current = f['current'];
      if (typeof f['total'] === 'number') frame.total = f['total'];
      // Which skill the rung is about, when one run works through several. A CLI that predates it
      // simply omits it, and a shell that cannot use it ignores it.
      if (str(f['item'])) frame.item = f['item'];
      return frame;
    }
    case 'result': {
      if (!str(f['verb']) || typeof f['ok'] !== 'boolean') return null;
      // The wire value wins (the process exit code matches it); derive from ok only when it is absent.
      const frame: Extract<CliFrame, { t: 'result' }> = { t: 'result', verb: f['verb'], ok: f['ok'], exitCode: typeof f['exitCode'] === 'number' ? f['exitCode'] : f['ok'] ? 0 : 1 };
      if (str(f['error'])) frame.error = f['error'];
      if (typeof f['refused'] === 'boolean') frame.refused = f['refused'];
      if (f['declined'] === true) frame.declined = true;
      if (f['refused'] === true) frame.refused = true;
      if ('value' in f && f['value'] !== undefined) frame.value = f['value'];
      return frame;
    }
    default:
      return null;
  }
}

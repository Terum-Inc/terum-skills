import { colorCapable, style } from './banner.js';
import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { env as processEnv, stdin as processStdin, stdout as processStdout } from 'node:process';
import { CancelledError } from './result.js';

/** Lines the person needs in order to answer; a terminal prints them once, immediately before the question; frame mode carries them on the ask frame. */
export interface AskOptions {
  /** Default answer for a yes/no confirmation. */
  default?: boolean;
  detail?: readonly string[];
  descriptions?: readonly string[];
  /** Internal terminal presentation; never changes frame question text. */
  decorated?: boolean;
  /** §9.2/D13: the answer is a filesystem path. A shell may offer a folder chooser; a terminal ignores it and reads a line. Applies to `text` only. */
  path?: boolean;
}

/**
 * A verb's report that a long step has moved on. A terminal ignores it; frame mode writes one
 * `progress` frame.
 *
 * `item` names what the rung is about when a verb works through several of them — the skill a
 * batched publish or install is on right now. Without it a shell driving one process for a whole
 * selection can only guess which of its rows to light up, and guessing by order is wrong the moment
 * an item is skipped. Absent for a verb that does one thing.
 */
export interface ProgressUpdate { step: string; current?: number; total?: number; item?: string; }

/**
 * §3 library-first: the ONLY channel a verb uses to talk to a human. Verbs never touch
 * process.stdin / stdout / console; the ESLint rule in eslint.config.js enforces that and
 * src/lib/__tests__/prompt.test.ts proves the rule fires.
 *
 * One addition beyond the four spec methods, a property of the channel rather than of any verb:
 * `interactive` (a human is on the other end and stdio may be handed to a child process, which
 * is what the §6 `login` gh offer needs to know). There is no hidden-input method: the tool never
 * asks for a token (rev 9, Decision 2).
 */
export interface Prompter {
  readonly interactive: boolean;
  /**
   * What is on the other end: a terminal, or a program over frames (docs/frame-protocol.md). Verbs read it
   * only for the two questions that need a terminal and make no sense to a program: the app opt-in in
   * setup and the `gh auth login` offer (decision walk D5, 2026-09-08). Absent means terminal.
   */
  readonly channel?: 'terminal' | 'frames';
  confirm(question: string, options?: AskOptions): Promise<boolean>;
  text(question: string, defaultValue?: string, options?: AskOptions): Promise<string>;
  select(question: string, choices: readonly string[], defaultChoice?: string, options?: AskOptions): Promise<string>;
  print(line: string): void;
  /**
   * Optional: only a channel that can render progress implements it (frame mode does; a terminal does not,
   * because a verb that wants a person to see progress prints a line). Callers must use `io.progress?.(…)`.
   */
  progress?(update: ProgressUpdate): void;
}

/** §3: `sync --hook` is typed against this — it can print and nothing else. */
export interface NonInteractivePrompter {
  readonly interactive: false;
  print(line: string): void;
}

/** Thrown when a question cannot be answered: the channel is not interactive, input ended first, or the output the question would go to is gone. */
export class PromptClosedError extends Error {
  constructor(question: string, reason: 'not-interactive' | 'closed' | 'output-closed') {
    super(reason === 'not-interactive'
      ? `Cannot ask "${question}": this command needs an interactive terminal (stdin is not a TTY).`
      : reason === 'output-closed'
        ? `Output closed before "${question}" could be asked: the reader went away.`
        : `Input ended before "${question}" was answered.`);
    this.name = 'PromptClosedError';
  }
}

export const MAX_SELECT_ATTEMPTS = 3;

/** What a cursor-driven select needs from its streams beyond a line reader: raw key events in, cursor movement out. */
export interface CursorCapableInput { isTTY?: boolean; setRawMode?(mode: boolean): unknown; resume?(): unknown; pause?(): unknown; }
export interface CursorCapableOutput { isTTY?: boolean; columns?: number; }

export interface TerminalStreams {
  input?: NodeJS.ReadableStream & CursorCapableInput;
  output?: NodeJS.WritableStream & CursorCapableOutput;
  /** Override TTY detection (tests). Defaults to `input.isTTY`. */
  interactive?: boolean;
  /**
   * Override the cursor-select capability check (tests). Defaults to: interactive, both streams are TTYs, the input
   * can enter raw mode, TERM is not `dumb`, and TERUM_SKILLS_PLAIN_PROMPTS is unset. Off means the numbered line prompt.
   */
  cursor?: boolean;
  /** The environment the capability check reads (tests). Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** Settles when the output stream broke (a reader that went away): a pending or later question fails closed instead of hanging. */
  outputClosed?: Promise<void>;
}

/**
 * The terminal implementation. Questions are only asked on an interactive channel; a piped or
 * closed stdin gets PromptClosedError instead of a hang. Each question opens its own readline
 * interface and closes it in a `finally`, so the process can exit when the verb returns and a
 * child process handed our stdio (gh auth login) never competes with a live reader. EOF while a
 * question is pending is raced explicitly, because readline/promises never settles it.
 */
export function terminalPrompter(streams: TerminalStreams = {}): Prompter {
  const input = streams.input ?? processStdin;
  const output = streams.output ?? processStdout;
  const interactive = streams.interactive ?? Boolean(input.isTTY);
  let outputBroken = false;
  // Settlement, not fulfilment, is the signal (the field's doc comment says so): a producer that
  // reports the broken output by REJECTING has lost it just as surely, and a fulfilment-only handler
  // would leave that rejection unhandled on a promise nobody subscribes to — process-fatal.
  const markBroken = () => { outputBroken = true; };
  void streams.outputClosed?.then(markBroken, markBroken);

  async function ask(question: string, decorated = false): Promise<string> {
    if (!interactive) throw new PromptClosedError(question.trim(), 'not-interactive');
    if (outputBroken) throw new PromptClosedError(question.trim(), 'output-closed');
    // Decorated mode is a line transcript: cooked input avoids raw-mode cursor controls on conhost/ssh.
    // Its completed answers get a newline below because readline does not echo in this mode.
    const rl = createInterface({ input, output, terminal: !decorated });
    const closed = new Promise<never>((_, reject) => rl.once('close', () => reject(new PromptClosedError(question.trim(), 'closed'))));
    // A pending question also loses to the output breaking under it: the broken-pipe signal arrives
    // from the event loop, after the question was already written, so a pre-check alone is not enough.
    const failClosed = (): never => { throw new PromptClosedError(question.trim(), 'output-closed'); };
    const broken = streams.outputClosed?.then<never>(failClosed, failClosed);
    try {
      const answer = await Promise.race(broken ? [rl.question(question), closed, broken] : [rl.question(question), closed]);
      if (decorated) output.write('\n');
      return answer;
    } finally {
      rl.close();
    }
  }

  const environment = streams.env ?? processEnv;
  /**
   * A cursor-driven select needs a person at a terminal on both ends: keys arrive raw (no line discipline), and the
   * list is redrawn in place with cursor movement, which a pipe, a log file, a dumb terminal or a screen reader
   * cannot follow. Anything less keeps the numbered line prompt, which is the same question with the same answers.
   */
  const cursorCapable = (): boolean => streams.cursor ?? (
    interactive && Boolean(input.isTTY) && typeof input.setRawMode === 'function' && Boolean(output.isTTY)
    && environment['TERM'] !== 'dumb' && !environment['TERUM_SKILLS_PLAIN_PROMPTS']
  );
  const visibleLength = (line: string): number => [...line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')].length;
  const rowsOf = (lines: readonly string[]): number => {
    const columns = Math.max(1, output.columns ?? 80);
    return lines.reduce((total, line) => total + Math.max(1, Math.ceil(visibleLength(line) / columns)), 0);
  };

  /**
   * The list with a movable cursor: ↑/↓ (also j/k, Tab/Shift-Tab, Home/End) move, Enter chooses, a digit chooses that
   * row outright, Esc or Ctrl-C cancels (CancelledError, the same typed decline every verb reports), Ctrl-D or the input
   * ending closes (PromptClosedError). The frame is redrawn in place and replaced by a two-line transcript of the answer
   * when it settles, so a scrollback reads the same as the line prompt's. Raw mode, the hidden cursor and the key
   * listener are all undone in `finally`, whichever way the question ends.
   */
  async function selectWithCursor(question: string, choices: readonly string[], defaultChoice: string | undefined, descriptions: readonly string[] | undefined, decorated: boolean): Promise<string> {
    if (!interactive) throw new PromptClosedError(question.trim(), 'not-interactive');
    if (outputBroken) throw new PromptClosedError(question.trim(), 'output-closed');
    // The same indent rule as the line prompts: decorated output is indented only where colour is on.
    const color = colorCapable();
    const pad = decorated && color ? '  ' : '';
    const paint = (kind: 'cyan' | 'dim', line: string): string => (color ? style(kind, line) : line);
    let index = Math.max(0, defaultChoice === undefined ? 0 : choices.indexOf(defaultChoice));
    const frame = (): string[] => {
      const rows = choices.flatMap((choice, i) => [
        i === index ? paint('cyan', `${pad}› ${i + 1}. ${choice}`) : `${pad}  ${i + 1}. ${choice}`,
        ...(descriptions?.[i] ? [paint('dim', `${pad}     ${descriptions[i]}`)] : []),
      ]);
      return [`${pad}${question}`, ...rows, paint('dim', `${pad}↑/↓ to move, Enter to choose${choices.length <= 9 ? ', or type a number' : ''}.`)];
    };
    let drawn = 0;
    const draw = (): void => {
      const lines = frame();
      output.write(`${drawn > 0 ? `\x1b[${drawn}A\x1b[0J` : ''}${lines.join('\n')}\n`);
      drawn = rowsOf(lines);
    };
    const settle = (chosen: string | null): void => {
      // Replace the frame with the answer (or the cancellation) so the transcript stays readable.
      const lines = [`${pad}${question}`, chosen === null ? paint('dim', `${pad}(cancelled)`) : paint('cyan', `${pad}› ${chosen}`)];
      output.write(`\x1b[${drawn}A\x1b[0J${lines.join('\n')}\n`);
    };
    emitKeypressEvents(input);
    const raw = input.setRawMode?.bind(input);
    output.write('\x1b[?25l');
    raw?.(true);
    input.resume?.();
    let onKey: ((sequence: string | undefined, key: { name?: string; ctrl?: boolean; shift?: boolean; sequence?: string } | undefined) => void) | undefined;
    let onEnd: (() => void) | undefined;
    try {
      draw();
      const answered = new Promise<string>((resolve, reject) => {
        onEnd = () => reject(new PromptClosedError(question.trim(), 'closed'));
        onKey = (sequence, key) => {
          const name = key?.name ?? '';
          const text = sequence ?? key?.sequence ?? '';
          if (key?.ctrl && name === 'c') { reject(new CancelledError('Selection was cancelled.')); return; }
          if (key?.ctrl && name === 'd') { reject(new PromptClosedError(question.trim(), 'closed')); return; }
          if (name === 'escape') { reject(new CancelledError('Selection was cancelled.')); return; }
          if (name === 'return' || name === 'enter') { resolve(choices[index]!); return; }
          if (/^[1-9]$/.test(text) && Number(text) <= choices.length && choices.length <= 9) { index = Number(text) - 1; draw(); resolve(choices[index]!); return; }
          const before = index;
          if (name === 'up' || name === 'k' || (name === 'tab' && key?.shift)) index = (index - 1 + choices.length) % choices.length;
          else if (name === 'down' || name === 'j' || name === 'tab') index = (index + 1) % choices.length;
          else if (name === 'home') index = 0;
          else if (name === 'end') index = choices.length - 1;
          if (index !== before) draw();
        };
        input.on('keypress', onKey);
        input.once('end', onEnd);
      });
      const failClosed = (): never => { throw new PromptClosedError(question.trim(), 'output-closed'); };
      const broken = streams.outputClosed?.then<never>(failClosed, failClosed);
      const chosen = await Promise.race(broken ? [answered, broken] : [answered]);
      settle(chosen);
      return chosen;
    } catch (error) {
      if (error instanceof CancelledError && !outputBroken) settle(null);
      throw error;
    } finally {
      if (onKey) input.off('keypress', onKey);
      if (onEnd) input.off('end', onEnd);
      raw?.(false);
      input.pause?.();
      output.write('\x1b[?25h');
    }
  }

  return {
    interactive,
    channel: 'terminal',
    async confirm(question, options) {
      for (const line of options?.detail ?? []) output.write(`${options?.decorated && colorCapable() ? '  ' : ''}${line}\n`);
      const affirmative = options?.default === true;
      const answer = await ask(`${options?.decorated && colorCapable() ? '  ' : ''}${question} ${affirmative ? '[Y/n]' : '[y/N]'} `, Boolean(options?.decorated && colorCapable()));
      return answer.trim() ? /^(y|yes)$/i.test(answer.trim()) : affirmative;
    },
    async text(question, defaultValue, options) {
      for (const line of options?.detail ?? []) output.write(`${options?.decorated && colorCapable() ? '  ' : ''}${line}\n`);
      const suffix = defaultValue === undefined || defaultValue === '' ? '' : ` [${defaultValue}]`;
      const answer = await ask(`${options?.decorated && colorCapable() ? '  ' : ''}${question}${suffix}: `, Boolean(options?.decorated && colorCapable()));
      return answer.trim() || defaultValue || '';
    },
    async select(question, choices, defaultChoice, options) {
      for (const line of options?.detail ?? []) output.write(`${options?.decorated && colorCapable() ? '  ' : ''}${line}\n`);
      const descriptions = options?.descriptions?.length === choices.length ? options.descriptions : undefined;
      if (options?.descriptions && !descriptions) output.write('Select descriptions do not match choices; descriptions omitted.\n');
      if (defaultChoice !== undefined && !choices.includes(defaultChoice)) throw new Error('Select default must be one of the choices.');
      if (choices.length === 0) throw new Error('Select needs at least one choice.');
      if (cursorCapable()) return selectWithCursor(question, choices, defaultChoice, descriptions, Boolean(options?.decorated));
      const decorated = options?.decorated && colorCapable();
      const lines = choices.map((choice, index) => `${index + 1}. ${choice}`).join('\n');
      for (let attempt = 0; attempt < MAX_SELECT_ATTEMPTS; attempt++) {
        const suffix = defaultChoice === undefined ? '' : ` [${defaultChoice}]`;
        let prompt = `${question}${suffix}\n${lines}\n> `;
        if (decorated) {
          const rows = choices.flatMap((choice, index) => [choice === defaultChoice ? style('cyan', `› ${index + 1}. ${choice}`) : `  ${index + 1}. ${choice}`, ...(descriptions?.[index] ? [style('dim', `     ${descriptions[index]}`)] : [])]);
          const hint = defaultChoice === undefined ? undefined : `  Press enter to choose ${choices.indexOf(defaultChoice) + 1}. ${defaultChoice}, or type a number.`;
          prompt = `  ${question}${suffix}\n${rows.join('\n')}${hint === undefined ? '' : `\n${style('dim', hint)}`}\n> `;
        }
        const answer = (await ask(prompt, Boolean(decorated))).trim();
        if (!answer && defaultChoice !== undefined) return defaultChoice;
        const byNumber = /^\d+$/.test(answer) ? choices[Number(answer) - 1] : undefined;
        const picked = byNumber ?? choices.find((choice) => choice === answer);
        if (picked !== undefined) return picked;
        output.write(`${decorated ? '  ' : ''}Enter a number from 1 to ${choices.length}.\n`);
      }
      throw new Error(`No valid choice after ${MAX_SELECT_ATTEMPTS} attempts`);
    },
    print(line) {
      output.write(`${line}\n`);
    },
  };
}

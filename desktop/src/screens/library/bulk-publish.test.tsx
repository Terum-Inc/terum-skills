import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../app/App';
import { Providers } from '../../app/providers';
import { useUiStore } from '../../app/store';
import * as backendModule from '../../backend/index.js';
import { createMockBackend } from '../../backend/mock';
import { createRun } from '../../backend/mock/run';
import type { Backend } from '../../backend/Backend';
import type { PublishResult, Result, Run, SkillCard } from '../../backend/types';
import { localActionReason, localRef } from '../../components/domain/skill-card-actions';
import { rowText } from './bulk-publish';

// Batch E (2026-09-13): Library selection mode (`?select=1`) and the bulk "Publish to team" question. Since the
// publish run host (2026-09-14) the question only STARTS the queue: the app-level `PublishRunProvider` runs it, the
// host draws the board, and the top bar carries the chip — so the board outlives the Library, the route and the
// dialog. The CLI's `publish <ref>` takes one ref and the team clone is write-locked, so the queue stays sequential.
//
// The production stack is rendered whole. `Providers` reads the backend through `pickBackend` and hosts the run
// above the routes, so the mock is put where `pickBackend` looks — a `BackendContext` inside `Providers` would leave
// the run talking to another backend.
function openWith(route: string, backend: Backend) { vi.spyOn(backendModule, 'pickBackend').mockReturnValue(backend); location.hash = route; return render(<Providers><App /></Providers>); }
beforeEach(() => { localStorage.clear(); useUiStore.setState({ railOpen: true, overviewHidden: false, theme: 'dark' }); });
afterEach(async () => { for (const run of runs.splice(0)) await run.cancel(); cleanup(); location.hash = ''; vi.restoreAllMocks(); });

const search = () => new URLSearchParams(location.hash.split('?')[1] ?? '');
const modeButton = () => screen.getByRole('button', { name: /^(Select|Done)$/ });
const checkbox = (name: string) => screen.getByRole('checkbox', { name: 'Select ' + name });
const checkboxes = () => screen.queryAllByRole('checkbox', { name: /^Select / });
const countLine = () => screen.getByText(/^\d+ of \d+ selected$/);
const cardNames = () => screen.getAllByTestId(/^skill-card-/).map(el => el.getAttribute('data-testid')?.replace('skill-card-', '') ?? '');
async function globalCards(backend: Backend): Promise<SkillCard[]> { const result = await backend.library({ scope: { kind: 'global' } }); if (!result.ok) throw new Error(result.error); return result.value.skills; }
const sendable = (cards: SkillCard[]) => cards.filter(card => localActionReason(card, 'publish') === null);
async function enterSelection(backend: Backend) { openWith('#/library/global', backend); await screen.findByText('15 skills'); fireEvent.click(modeButton()); await screen.findByText('0 of 15 selected'); }
function published(ref: string): Result<PublishResult> { return { ok: true, value: { name: ref.split('/').at(-1) ?? ref, project: null, version: 'v3', created: true, identicalTo: null, attachedEvals: 0, evalAssets: 0, profileAdded: false, projectAdded: false } }; }
const sentence = (card: SkillCard) => `${card.name} was published to the marketplace as Version 3.`;
/** `published`'s value alone: what a batched run returns one of per ref, in the order they were given. */
function publishedValue(ref: string): PublishResult { const result = published(ref); if (!result.ok) throw new Error('fixture'); return result.value; }
/** A refused item: the batch published the rest and said why this one did not land. */
const refusedValue = (ref: string, reason: string): PublishResult => ({ ...publishedValue(ref), version: null, created: false, refused: reason });
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
/** Opens the question from the selection bar; it is the URL's `dialog=publish`, so Back closes it. */
async function openDialog(count: number) { fireEvent.click(screen.getByRole('button', { name: `Publish ${count} skill${count === 1 ? '' : 's'} to team…` })); const dialog = await screen.findByTestId('bulk-publish-dialog'); expect(search().get('dialog')).toBe('publish'); return dialog; }
/** Presses the question's primary button (named for the READY rows); the question leaves and the host's board — titled for every row, skipped ones included — takes its place. */
async function startQueue(ready: number, rows = ready) { fireEvent.click(screen.getByRole('button', { name: `Publish ${ready} skill${ready === 1 ? '' : 's'}` })); await waitFor(() => expect(screen.queryByTestId('bulk-publish-dialog')).toBeNull()); return await screen.findByRole('dialog', { name: `Publish ${rows} skill${rows === 1 ? '' : 's'} to the team?` }); }
/** Selects, asks, and starts in one go; resolves with the board. */
async function publishAll(backend: Backend, pick: SkillCard[]) { await enterSelection(backend); for (const card of pick) fireEvent.click(checkbox(card.name)); await openDialog(pick.length); return await startQueue(pick.length); }
const rowState = (name: string) => within(screen.getByTestId('bulk-row-' + name)).getAllByText(/./).at(-1)?.textContent ?? '';
/** The top-bar chip is a button whose accessible name is the whole label (`publishChip`); `title` carries the detail. */
const chip = (label: string) => screen.getByRole('button', { name: label });
const noChip = (label: string) => screen.queryByRole('button', { name: label });
const libraryNotice = (text: string) => screen.findByText(text, { selector: '.library-notice' }, { timeout: 4000 });
const noLibraryNotice = (text: string) => screen.queryByText(text, { selector: '.library-notice' });
/** Runs a test leaves alive on purpose (a child that ignores its cancel) are torn down here. */
const runs: Run<unknown>[] = [];
/** "Keep running" is the board's own dismiss while busy (WorkflowDialog's dismissKeepsRunning); "Close" afterwards. */
const dismissBoard = (board: HTMLElement) => fireEvent.click(within(board).getByRole('button', { name: /^(Keep running|Close)$/ }));

it('Select enters selection mode in the URL, draws a checkbox per card, and Done drops the selection', async () => {
  const backend = createMockBackend();
  await enterSelection(backend);
  expect(search().get('select')).toBe('1');
  expect(modeButton()).toHaveTextContent('Done');
  expect(modeButton()).toHaveAttribute('aria-pressed', 'true');
  expect(checkboxes()).toHaveLength(15);
  fireEvent.click(checkbox('deploy-check'));
  expect(countLine()).toHaveTextContent('1 of 15 selected');
  expect(screen.getByTestId('skill-card-deploy-check')).toHaveAttribute('data-selected', 'true');
  fireEvent.click(modeButton());
  expect(search().get('select')).toBeNull();
  expect(checkboxes()).toHaveLength(0);
  expect(screen.queryByText(/of \d+ selected$/)).toBeNull();
  // Re-entering starts from nothing: Done dropped the set, it did not park it.
  fireEvent.click(modeButton());
  expect(await screen.findByText('0 of 15 selected')).toBeInTheDocument();
  expect(screen.getByTestId('skill-card-deploy-check')).not.toHaveAttribute('data-selected');
});

it('a card click toggles the card instead of navigating while selecting', async () => {
  const backend = createMockBackend();
  await enterSelection(backend);
  const link = within(screen.getByTestId('skill-card-deploy-check')).getByRole('link', { name: 'deploy-check' });
  fireEvent.click(link);
  expect(location.hash).toBe('#/library/global?select=1');
  expect(countLine()).toHaveTextContent('1 of 15 selected');
  expect(checkbox('deploy-check')).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(link);
  expect(countLine()).toHaveTextContent('0 of 15 selected');
  expect(checkbox('deploy-check')).toHaveAttribute('aria-checked', 'false');
});

it('Select all takes every drawn card, Clear empties the set, and the count follows the query', async () => {
  const backend = createMockBackend();
  await enterSelection(backend);
  fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
  expect(countLine()).toHaveTextContent('15 of 15 selected');
  expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: /^Search/ }), { target: { value: 'deploy' } });
  const drawn = cardNames().length;
  expect(drawn).toBeGreaterThan(0);
  expect(drawn).toBeLessThan(15);
  // Hidden cards stay selected but are neither counted nor offered: the button never promises more than the grid shows.
  expect(countLine()).toHaveTextContent(`${drawn} of ${drawn} selected`);
  expect(screen.getByRole('button', { name: `Publish ${drawn} skills to team…` })).toBeEnabled();
  fireEvent.click(screen.getAllByRole('button', { name: 'Clear search' }).at(-1)!);
  expect(await screen.findByText('15 of 15 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(countLine()).toHaveTextContent('0 of 15 selected');
  expect(screen.getByRole('button', { name: 'Publish to team…' })).toBeDisabled();
});

it('Escape leaves selection mode, but yields to a field the person is typing in', async () => {
  const backend = createMockBackend();
  await enterSelection(backend);
  const field = screen.getByRole('textbox', { name: /^Search/ });
  field.focus();
  fireEvent.keyDown(field, { key: 'Escape' });
  expect(search().get('select')).toBe('1');
  field.blur();
  fireEvent.keyDown(document.body, { key: 'Escape' });
  expect(search().get('select')).toBeNull();
  expect(checkboxes()).toHaveLength(0);
});

it('lists Ready and Skipped rows and never sends a skipped one', async () => {
  const backend = createMockBackend();
  const cards = await globalCards(backend);
  const broken = cards.find(card => localActionReason(card, 'publish') !== null);
  if (!broken) throw new Error('The mock Library has no unpublishable card to skip.');
  const publish = vi.spyOn(backend, 'publish').mockImplementation(args => createRun(async () => published(args.ref)));
  await enterSelection(backend);
  fireEvent.click(checkbox('deploy-check'));
  fireEvent.click(checkbox(broken.name));
  const dialog = await openDialog(2);
  expect(within(dialog).getByRole('heading', { name: 'Publish 2 skills to the team?' })).toBeInTheDocument();
  expect(rowState('deploy-check')).toBe('Ready');
  expect(rowState(broken.name)).toBe(`Skipped · ${localActionReason(broken, 'publish')}`);
  // The hint's command is drawn across several spans, so match the dialog's text as a whole.
  expect(dialog.textContent).toContain('npx -y terum-skills@latest publish deploy-check');
  const board = await startQueue(1, 2);
  await within(board).findByText('Published 1 of 1 skill');
  expect(publish).toHaveBeenCalledTimes(1);
  expect(publish.mock.calls[0]?.[0]).toEqual({ ref: localRef(cards.find(card => card.name === 'deploy-check')!) }); // Settings ▸ Publishing ▸ Defaults (2026-09-14): the default target is the marketplace, which sends no --project
  // The board carries the skipped row through, still skipped: it was never part of the queue.
  expect(rowState(broken.name)).toBe(`Skipped · ${localActionReason(broken, 'publish')}`);
});

it('publishes the selection in one run, reports each outcome, and a finished run ends the selection and refreshes the Library', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 3);
  const gate = deferred(), calls: string[][] = [];
  vi.spyOn(backend, 'publishMany').mockImplementation(args => { calls.push([...args.refs]); return createRun(async ctx => { ctx.progress(1, args.refs.length, 'committing', args.refs[0]); await gate.promise; return { ok: true, value: args.refs.map(publishedValue) }; }); });
  await enterSelection(backend);
  for (const card of pick) fireEvent.click(checkbox(card.name));
  const dialog = await openDialog(3);
  expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
  const board = await startQueue(3);
  // Starting is a URL write that REPLACES, so Back does not reopen the question over the running board.
  expect(search().get('dialog')).toBeNull();
  expect(within(board).getAllByRole('listitem')).toHaveLength(3);
  // One push for all of them, so every ready row is publishing at once — there is no queue to be
  // second in. The CLI names the skill it is on, and that row carries the label.
  await waitFor(() => expect(rowState(pick[0]!.name)).toMatch(/^Publishing…/));
  expect(rowState(pick[1]!.name)).toBe('Publishing…');
  expect(rowState(pick[2]!.name)).toBe('Publishing…');
  // While busy the board offers Stop and "Keep running" — never a Close that could read as a cancel.
  expect(within(board).getByRole('button', { name: 'Stop' })).toBeEnabled();
  expect(within(board).getByRole('button', { name: 'Keep running' })).toBeEnabled();
  expect(within(board).queryByRole('button', { name: 'Close' })).toBeNull();
  expect(chip('Publishing · 0 of 3')).toBeInTheDocument();
  // One process for the whole selection: every ref in a single call, and the row the CLI named is the
  // one that lights up — the others wait, exactly as they did when each had a process of its own.
  expect(calls).toEqual([pick.map(localRef)]);
  const library = vi.spyOn(backend, 'library');
  gate.resolve();
  await within(board).findByText('Published 3 of 3 skills');
  for (const card of pick) expect(rowState(card.name)).toBe(sentence(card));
  expect(within(board).queryByRole('button', { name: 'Stop' })).toBeNull();
  expect(within(board).queryByRole('button', { name: 'Keep running' })).toBeNull();
  // The Library reports the run the moment it settles — before the board is closed — and ends the selection.
  const notice = await libraryNotice('Published 3 of 3 skills');
  await waitFor(() => expect(search().get('select')).toBeNull());
  await waitFor(() => expect(checkboxes()).toHaveLength(0));
  await waitFor(() => expect(library).toHaveBeenCalled());
  // Closing the board keeps the chip: a finished run is forgotten by its ✕, never by looking at it.
  fireEvent.click(within(board).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(chip('Published · 3 of 3')).toBeInTheDocument();
  // Close unmounted the button focus would return to; the status line takes it so Tab does not restart at the top.
  await waitFor(() => expect(document.activeElement).toBe(notice));
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss publish status' }));
  expect(noChip('Published · 3 of 3')).toBeNull();
  // The notice belongs to the library it reports: entering a new selection clears it.
  fireEvent.click(modeButton());
  await screen.findByText('0 of 15 selected');
  expect(screen.queryByText('Published 3 of 3 skills', { selector: '.library-notice' })).toBeNull();
});

it('a refused skill reports the CLI sentence and the rest of the selection still lands', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 3);
  // One bad folder does not cost the others their upload: the batch skips it, publishes the rest in
  // the same push, and names the reason in that skill's own result (`refused`).
  vi.spyOn(backend, 'publishMany').mockImplementation(args => createRun(async () => ({ ok: true, value: args.refs.map(ref => ref === localRef(pick[1]!) ? refusedValue(ref, 'fatal: the team clone is locked by another publish') : publishedValue(ref)) })));
  const board = await publishAll(backend, pick);
  await within(board).findByText('Published 2 of 3 skills · 1 failed');
  expect(rowState(pick[0]!.name)).toBe(sentence(pick[0]!));
  expect(rowState(pick[1]!.name)).toBe('Failed · fatal: the team clone is locked by another publish');
  expect(rowState(pick[2]!.name)).toBe(sentence(pick[2]!));
  expect(await libraryNotice('Published 2 of 3 skills · 1 failed')).toBeInTheDocument();
  // A finished run with a failure wears the failed tone in the bar, and the count says how many.
  expect(chip('Published · 2 of 3 · 1 failed')).toHaveAttribute('data-tone', 'failed');
});

it('Stop before the push lands publishes nothing: one push is all or nothing', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 3);
  const gate = deferred();
  vi.spyOn(backend, 'publishMany').mockImplementation(args => {
    const run = createRun<PublishResult[]>(async ctx => { ctx.progress(1, args.refs.length, undefined, args.refs[0]); await gate.promise; return { ok: false, error: 'Cancelled.', cancelled: true }; });
    vi.spyOn(run, 'cancel').mockImplementation(async () => { gate.resolve(); });
    return run;
  });
  const board = await publishAll(backend, pick);
  await waitFor(() => expect(rowState(pick[0]!.name)).toBe('Publishing…'));
  fireEvent.click(within(board).getByRole('button', { name: 'Stop' }));
  // Nothing is in the repository until every skill is committed, so stopping before the push lands
  // publishes NOTHING. Partial progress is what a push per skill bought, and it is what this costs.
  await within(board).findByText('Published 0 of 3 skills');
  for (const card of pick) expect(rowState(card.name)).toBe('Cancelled');
  expect(within(board).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  expect(chip('Publish stopped · 0 published')).toHaveAttribute('data-tone', 'stopped');
});

it('a pasted URL with nothing selected renders the empty dialog with Cancel alone', async () => {
  const backend = createMockBackend();
  const publish = vi.spyOn(backend, 'publish');
  openWith('#/library/global?select=1&dialog=publish', backend);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading', { name: 'No skills selected.' })).toBeInTheDocument();
  expect(within(dialog).getAllByRole('button')).toHaveLength(1);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(search().get('dialog')).toBeNull();
  expect(search().get('select')).toBe('1');
  expect(publish).not.toHaveBeenCalled();
});

it('a declined question cancels the whole selection: every row reads Cancelled and nothing is published', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 3);
  // driveRun answers a declined PromptContext question with `cancelled:true`; nobody pressed Stop.
  // The batch asks every question before it writes anything, so a decline costs the selection, not a row.
  const publishMany = vi.spyOn(backend, 'publishMany').mockImplementation(() => createRun(async () => ({ ok: false, error: 'Publish was cancelled.', cancelled: true })));
  const board = await publishAll(backend, pick);
  await within(board).findByText('Published 0 of 3 skills');
  for (const card of pick) expect(rowState(card.name)).toBe('Cancelled');
  expect(publishMany).toHaveBeenCalledTimes(1);
});

it('a run that finished before its cancel landed is reported as published, with the CLI sentence kept', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 2);
  const gate = deferred();
  vi.spyOn(backend, 'publishMany').mockImplementation(args => {
    // The real adapter's race settle: ok:false with the sentence AND the value. One push means the
    // whole selection landed, so every row keeps its outcome and wears the sentence.
    const race: Result<PublishResult[]> = { ok: false, error: 'Cancelled, but publish had already finished; its changes are on disk.', value: args.refs.map(publishedValue) };
    const run = createRun<PublishResult[]>(async ctx => { ctx.progress(1, args.refs.length, undefined, args.refs[0]); await gate.promise; return race; });
    vi.spyOn(run, 'cancel').mockImplementation(async () => { gate.resolve(); });
    return run;
  });
  const board = await publishAll(backend, pick);
  await waitFor(() => expect(rowState(pick[0]!.name)).toBe('Publishing…'));
  fireEvent.click(within(board).getByRole('button', { name: 'Stop' }));
  await within(board).findByText('Published 2 of 2 skills');
  for (const card of pick) expect(rowState(card.name)).toBe(`${sentence(card)} Cancelled, but publish had already finished; its changes are on disk.`);
  expect(await libraryNotice('Published 2 of 2 skills')).toBeInTheDocument();
  // The versions landed, so the stopped chip counts them.
  expect(chip('Publish stopped · 2 published')).toBeInTheDocument();
});

it('any other CLI sentence after Stop is the failure it says, shown verbatim', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 2);
  const gate = deferred();
  vi.spyOn(backend, 'publishMany').mockImplementation(args => {
    const run = createRun<PublishResult[]>(async ctx => { ctx.progress(1, args.refs.length, undefined, args.refs[0]); await gate.promise; return { ok: false, error: 'fatal: could not write the receipt' }; });
    vi.spyOn(run, 'cancel').mockImplementation(async () => { gate.resolve(); });
    return run;
  });
  const board = await publishAll(backend, pick);
  await waitFor(() => expect(rowState(pick[0]!.name)).toBe('Publishing…'));
  fireEvent.click(within(board).getByRole('button', { name: 'Stop' }));
  // Not a cancellation: the run failed, and one push means it failed for the whole selection.
  await within(board).findByText('Published 0 of 2 skills · 2 failed');
  for (const card of pick) expect(rowState(card.name)).toBe('Failed · fatal: could not write the receipt');
});

// Inverts batch E's "leaving mid-queue cancels the active run": the queue belongs to the app now (North Star).
it('leaving mid-run keeps it running and cancels nothing', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 3);
  const gate = deferred(), calls: string[][] = [], cancels: string[][] = [];
  vi.spyOn(backend, 'publishMany').mockImplementation(args => {
    calls.push([...args.refs]);
    const run = createRun<PublishResult[]>(async ctx => { ctx.progress(1, args.refs.length, undefined, args.refs[1]); await gate.promise; return { ok: true, value: args.refs.map(publishedValue) }; });
    const cancel = run.cancel.bind(run);
    vi.spyOn(run, 'cancel').mockImplementation(async () => { cancels.push([...args.refs]); await cancel(); });
    return run;
  });
  const board = await publishAll(backend, pick);
  await waitFor(() => expect(rowState(pick[1]!.name)).toBe('Publishing…'));
  dismissBoard(board);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  // Away from the Library altogether — and really gone, so the run settles with no Library on screen to hear it.
  act(() => { location.hash = '#/marketplace'; });
  await waitFor(() => expect(screen.queryByText('15 skills')).toBeNull());
  expect(chip('Publishing · 0 of 3')).toBeInTheDocument();
  expect(cancels).toEqual([]);
  gate.resolve();
  await waitFor(() => expect(calls).toEqual([pick.map(localRef)]));
  await screen.findByRole('button', { name: 'Published · 3 of 3' });
  expect(cancels).toEqual([]);
  // Back in the Library, the run it started but never saw finish is reported now: the chip covered the interim.
  const library = vi.spyOn(backend, 'library');
  act(() => { location.hash = '#/library/global'; });
  await screen.findByText('15 skills');
  expect(await libraryNotice('Published 3 of 3 skills')).toBeInTheDocument();
  await waitFor(() => expect(library).toHaveBeenCalled());
});

it('a run reported once stays reported: a detour and back neither repeats the notice nor ends the new selection', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 2);
  vi.spyOn(backend, 'publish').mockImplementation(args => createRun(async () => published(args.ref)));
  const board = await publishAll(backend, pick);
  await within(board).findByText('Published 2 of 2 skills');
  dismissBoard(board);
  await libraryNotice('Published 2 of 2 skills');
  // A new selection clears the notice; the settled run is still on the provider (its chip is up).
  fireEvent.click(modeButton());
  await screen.findByText('0 of 15 selected');
  expect(noLibraryNotice('Published 2 of 2 skills')).toBeNull();
  const library = vi.spyOn(backend, 'library');
  act(() => { location.hash = '#/skill/deploy-check'; });
  await screen.findByRole('heading', { name: 'deploy-check' });
  act(() => { location.hash = '#/library/global?select=1'; });
  await screen.findByText('0 of 15 selected');
  // The remounted Library does not report the run a second time: the selection stands, the URL keeps `select`, no stale count.
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(search().get('select')).toBe('1');
  expect(noLibraryNotice('Published 2 of 2 skills')).toBeNull();
  expect(library.mock.calls.length).toBeLessThanOrEqual(1);
  expect(chip('Published · 2 of 2')).toBeInTheDocument();
});

it('a run settling while another Library is on screen is reported by the Library that started it, when the person returns', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 2);
  const gate = deferred();
  vi.spyOn(backend, 'publish').mockImplementation(args => createRun(async () => { await gate.promise; return published(args.ref); }));
  const board = await publishAll(backend, pick);
  dismissBoard(board);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  act(() => { location.hash = '#/library/checkout?root=' + encodeURIComponent('/Users/you/code/terum'); });
  await waitFor(() => expect(screen.getByRole('link', { name: /^Terum/ })).toHaveAttribute('aria-current', 'page'));
  gate.resolve();
  await screen.findByRole('button', { name: 'Published · 2 of 2' });
  // The checkout's grid never wears Global's count.
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(noLibraryNotice('Published 2 of 2 skills')).toBeNull();
  act(() => { location.hash = '#/library/global'; });
  await waitFor(() => expect(screen.getByRole('link', { name: /^Global/ })).toHaveAttribute('aria-current', 'page'));
  expect(await libraryNotice('Published 2 of 2 skills')).toBeInTheDocument();
});

// Inverts batch E's "a second Cancel leaves the dialog": the second Stop force-abandons instead (D2), so the app
// never waits forever on a child that ignores its cancel — and never claims the child is gone, either.
it('a run that never settles: a second Stop force-abandons, the row says so, and publishing is available again', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 1);
  const publish = vi.spyOn(backend, 'publish').mockImplementation(args => { const run = createRun<PublishResult>(async ctx => { await ctx.sleep(600_000); return published(args.ref); }); const real = run.cancel.bind(run); runs.push({ ...run, cancel: real } as Run<unknown>); vi.spyOn(run, 'cancel').mockResolvedValue(undefined); return run; });
  const board = await publishAll(backend, pick);
  await waitFor(() => expect(rowState(pick[0]!.name)).toBe('Publishing…'));
  fireEvent.click(within(board).getByRole('button', { name: 'Stop' }));
  // The cancel was swallowed: the row is still publishing, the board says what the second press does, and the chip
  // says the app is trying to stop it.
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(rowState(pick[0]!.name)).toBe('Publishing…');
  expect(within(board).getByText('Stopping… press Stop again to stop waiting')).toBeInTheDocument();
  expect(chip(`Stopping · ${pick[0]!.name}`)).toBeInTheDocument();
  expect(within(board).getByRole('button', { name: 'Stop' })).toBeEnabled();
  fireEvent.click(within(board).getByRole('button', { name: 'Stop' }));
  await waitFor(() => expect(rowState(pick[0]!.name)).toBe('Stopped without confirming'));
  expect(chip('Publish stopped · 0 published')).toBeInTheDocument();
  expect(within(board).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  fireEvent.click(within(board).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  // Publishing is open again: the next start is accepted, not refused with the in-flight sentence.
  await libraryNotice('Published 0 of 1 skill');
  fireEvent.click(modeButton());
  await screen.findByText('0 of 15 selected');
  fireEvent.click(checkbox(pick[0]!.name));
  await openDialog(1);
  await startQueue(1);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(publish).toHaveBeenCalledTimes(2);
});

it('Clear empties a selection the query is hiding', async () => {
  const backend = createMockBackend();
  await enterSelection(backend);
  fireEvent.click(checkbox('deploy-check'));
  await screen.findByText('1 of 15 selected');
  fireEvent.change(screen.getByRole('textbox', { name: /^Search/ }), { target: { value: 'nothing-matches-this' } });
  await screen.findByText('0 of 0 selected');
  const clear = screen.getByRole('button', { name: 'Clear' });
  expect(clear).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Publish to team…' })).toBeDisabled();
  fireEvent.click(clear);
  fireEvent.change(screen.getByRole('textbox', { name: /^Search/ }), { target: { value: '' } });
  await screen.findByText('0 of 15 selected');
  expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
});

it('the notice belongs to the library it reports: a checkout shows none, Global shows it again', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 1);
  vi.spyOn(backend, 'publish').mockImplementation(args => createRun(async () => published(args.ref)));
  const board = await publishAll(backend, pick);
  await within(board).findByText('Published 1 of 1 skill');
  fireEvent.click(within(board).getByRole('button', { name: 'Close' }));
  await libraryNotice('Published 1 of 1 skill');
  // The two Library routes share one component instance; the count must not follow the person into a checkout.
  act(() => { location.hash = '#/library/checkout?root=' + encodeURIComponent('/Users/you/code/terum'); });
  await waitFor(() => expect(screen.getByRole('link', { name: /^Terum/ })).toHaveAttribute('aria-current', 'page'));
  expect(screen.queryByText('Published 1 of 1 skill', { selector: '.library-notice' })).toBeNull();
  act(() => { location.hash = '#/library/global'; });
  await waitFor(() => expect(screen.getByRole('link', { name: /^Global/ })).toHaveAttribute('aria-current', 'page'));
  expect(screen.getByText('Published 1 of 1 skill', { selector: '.library-notice' })).toBeInTheDocument();
});

// —— The run host (spec §6, new) ————————————————————————————————————————————————————————————————————————————————

it('dismissing the board leaves the run going; the chip reopens it with every outcome intact', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 2);
  const gate = deferred(), calls: string[][] = [];
  vi.spyOn(backend, 'publishMany').mockImplementation(args => { calls.push([...args.refs]); return createRun(async ctx => { ctx.progress(1, args.refs.length, undefined, args.refs[0]); await gate.promise; return { ok: true, value: args.refs.map(publishedValue) }; }); });
  const board = await publishAll(backend, pick);
  await waitFor(() => expect(rowState(pick[0]!.name)).toBe('Publishing…'));
  // Escape is a dismiss, not a cancel: the board leaves, the run does not.
  fireEvent.keyDown(board, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(calls).toEqual([pick.map(localRef)]);
  expect(chip('Publishing · 0 of 2')).toBeInTheDocument();
  gate.resolve();
  fireEvent.click(await screen.findByRole('button', { name: 'Published · 2 of 2' }));
  const reopened = await screen.findByRole('dialog', { name: 'Publish 2 skills to the team?' });
  for (const card of pick) expect(rowState(card.name)).toBe(sentence(card));
  expect(within(reopened).getByText('Published 2 of 2 skills')).toBeInTheDocument();
});

it('navigating from the Library to a skill page and back mid-run cancels nothing and loses no row state', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 2);
  const gate = deferred(), cancels: string[][] = [];
  vi.spyOn(backend, 'publishMany').mockImplementation(args => { const run = createRun<PublishResult[]>(async ctx => { ctx.progress(1, args.refs.length, undefined, args.refs[1]); await gate.promise; return { ok: true, value: args.refs.map(publishedValue) }; }); vi.spyOn(run, 'cancel').mockImplementation(async () => { cancels.push([...args.refs]); }); return run; });
  const board = await publishAll(backend, pick);
  await waitFor(() => expect(rowState(pick[1]!.name)).toBe('Publishing…'));
  dismissBoard(board);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  act(() => { location.hash = '#/skill/deploy-check'; });
  await screen.findByRole('heading', { name: 'deploy-check' });
  expect(chip('Publishing · 0 of 2')).toBeInTheDocument();
  act(() => { location.hash = '#/library/global'; });
  await screen.findByText('15 skills');
  fireEvent.click(chip('Publishing · 0 of 2'));
  await screen.findByRole('dialog');
  expect(rowState(pick[1]!.name)).toBe('Publishing…');
  gate.resolve();
  await waitFor(() => expect(rowState(pick[1]!.name)).toBe(sentence(pick[1]!)));
  expect(rowState(pick[0]!.name)).toBe(sentence(pick[0]!));
  expect(cancels).toEqual([]);
});

it('the chip survives completion and is forgotten only by its ✕, never by closing the board', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 3);
  const gate = deferred();
  vi.spyOn(backend, 'publishMany').mockImplementation(args => createRun(async () => { await gate.promise; return { ok: true, value: args.refs.map(ref => ref === localRef(pick[1]!) ? refusedValue(ref, 'fatal: nope') : publishedValue(ref)) }; }));
  const board = await publishAll(backend, pick);
  dismissBoard(board);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  gate.resolve();
  const done = await screen.findByRole('button', { name: 'Published · 2 of 3 · 1 failed' });
  expect(done).toHaveAttribute('data-tone', 'failed');
  // No Stop beside a settled run; the ✕ takes its place.
  expect(screen.queryByRole('button', { name: 'Stop publish' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Dismiss publish status' })).toBeInTheDocument();
  fireEvent.click(done);
  const reopened = await screen.findByRole('dialog');
  fireEvent.click(within(reopened).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(chip('Published · 2 of 3 · 1 failed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss publish status' }));
  expect(noChip('Published · 2 of 3 · 1 failed')).toBeNull();
});

// North Star, clause 2: the one behaviour eval's chip did not have when this was specified.
it('a run that fails while the board is dismissed still surfaces: the chip reads Publish failed and carries the sentence', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 1);
  const gate = deferred();
  vi.spyOn(backend, 'publish').mockImplementation(() => createRun(async () => { await gate.promise; return { ok: false, error: 'fatal: the team clone is locked by another publish' }; }));
  const board = await publishAll(backend, pick);
  dismissBoard(board);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  act(() => { location.hash = '#/marketplace'; });
  gate.resolve();
  const failed = await screen.findByRole('button', { name: `Publish failed · ${pick[0]!.name}` });
  expect(failed).toHaveAttribute('data-tone', 'failed');
  expect(failed).toHaveAttribute('title', `Publish failed · ${pick[0]!.name} — fatal: the team clone is locked by another publish`);
  fireEvent.click(failed);
  await screen.findByRole('dialog');
  expect(rowState(pick[0]!.name)).toBe('Failed · fatal: the team clone is locked by another publish');
});

it('a second start while a publish is in flight is refused with the §4 sentence, shown in the question', async () => {
  const backend = createMockBackend();
  const pick = sendable(await globalCards(backend)).slice(0, 2);
  const gate = deferred();
  const publish = vi.spyOn(backend, 'publishMany').mockImplementation(args => createRun(async () => { await gate.promise; return { ok: true, value: args.refs.map(publishedValue) }; }));
  const board = await publishAll(backend, pick);
  dismissBoard(board);
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  // The selection is still live (the run has not settled), so the question can be asked again — and refuses in place.
  await openDialog(2);
  fireEvent.click(screen.getByRole('button', { name: 'Publish 2 skills' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A publish is already running for 2 skills.');
  expect(screen.getByTestId('bulk-publish-dialog')).toBeInTheDocument();
  expect(publish).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  gate.resolve();
  await screen.findByRole('button', { name: 'Published · 2 of 2' });
});

it('names every row state', () => {
  expect(rowText({ kind: 'ready' })).toBe('Ready');
  expect(rowText({ kind: 'skipped', reason: 'no folder' })).toBe('Skipped · no folder');
  expect(rowText({ kind: 'queued' })).toBe('Queued');
  expect(rowText({ kind: 'publishing', label: null })).toBe('Publishing…');
  expect(rowText({ kind: 'publishing', label: 'committing' })).toBe('Publishing… committing');
  expect(rowText({ kind: 'done', text: 'x was published.' })).toBe('x was published.');
  expect(rowText({ kind: 'failed', error: 'boom' })).toBe('Failed · boom');
  expect(rowText({ kind: 'cancelled' })).toBe('Cancelled');
  // D2's force-abandon: the child may still be alive, and the app must not claim otherwise.
  expect(rowText({ kind: 'abandoned' })).toBe('Stopped without confirming');
  expect(rowText({ kind: 'not-started' })).toBe('Not started');
});

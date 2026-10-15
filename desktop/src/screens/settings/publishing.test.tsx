import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MachineRemovalProvider } from '../../app/MachineRemovalProvider';
import { App } from '../../app/App';
import { Providers } from '../../app/providers';
import { PublishRunProvider } from '../../app/PublishRunProvider';
import { useUiStore } from '../../app/store';
import { BackendContext } from '../../backend';
import { createMockBackend } from '../../backend/mock';
import { createRun } from '../../backend/mock/run';
import type { PublishResult, SkillCard } from '../../backend/types';
import { detailPath, localActionReason } from '../../components/domain/skill-card-actions';
import { CATEGORY_ASK, MARKETPLACE_ONLY, PUBLISH_CATEGORY_KEY, PUBLISH_TARGET_KEY, sharedState } from '../skill/publish-defaults';

// Settings ▸ Publishing (Teddy, 2026-09-14): Defaults the publish dialogs honour, the Global folders with their state
// on the team, the CLI's own rules, and the promise that nothing is shared automatically.
const backend = createMockBackend();
function open(route: string) { location.hash = route; return render(<Providers><BackendContext value={backend}><PublishRunProvider><MachineRemovalProvider><App/></MachineRemovalProvider></PublishRunProvider></BackendContext></Providers>); }
beforeEach(() => { localStorage.clear(); useUiStore.getState().setTheme('dark'); });
afterEach(() => { cleanup(); location.hash = ''; vi.restoreAllMocks(); });
async function globalCards(): Promise<SkillCard[]> { const result = await backend.library({ scope: { kind: 'global' } }); if (!result.ok) throw new Error(result.error); return result.value.skills; }
const published = (): PublishResult => ({ name: 'x', project: null, version: 'v2', created: true, identicalTo: null, attachedEvals: 0, evalAssets: 0, profileAdded: false, projectAdded: false });

it('draws the four groups with the CLI-backed defaults and rules', async () => {
  open('#/settings/publishing');
  expect(await screen.findByRole('heading', { name: 'Publishing' })).toBeInTheDocument();
  for (const label of ['Defaults', 'Shared from this machine', 'Rules', 'Nothing automatic']) expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Publish to' })).toHaveTextContent(MARKETPLACE_ONLY);
  expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('Model suggests');
  for (const rule of ['Frontmatter', 'Hygiene', 'Regression gate', 'Identical bytes', 'Later edits', 'Sync only fetches']) expect(screen.getByText(rule)).toBeInTheDocument();
  expect(document.querySelector('.terminal-hint .board-mono')?.textContent).toBe('npx -y terum-skills@latest publish <ref>');
});

it('lists every Global folder with its state and a Publish action where one is due', async () => {
  const cards = await globalCards();
  open('#/settings/publishing');
  await screen.findByRole('heading', { name: 'Publishing' });
  await waitFor(() => expect(screen.queryByTestId('shared-skeleton')).toBeNull());
  for (const card of cards) {
    const row = screen.getByText(card.name, { selector: '.setting-row > div > span' }).closest<HTMLElement>('.setting-row')!;
    const state = sharedState(card);
    const value = within(row).getByText(state);
    expect(value).toBeInTheDocument();
    // An unreported byte match says why on hover; every other state speaks for itself.
    if (state === '—') expect(value).toHaveAttribute('title', expect.stringContaining('not reported by this terum-skills version'));
    else expect(value).not.toHaveAttribute('title');
    const button = within(row).queryByRole('button', { name: 'Publish…' });
    if (state === 'In sync' || state === '—') expect(button).toBeNull();
    else { expect(button).not.toBeNull(); if (localActionReason(card, 'publish')) expect(button).toBeDisabled(); }
  }
  const due = cards.find(card => { const state = sharedState(card); return state !== 'In sync' && state !== '—' && localActionReason(card, 'publish') === null; });
  if (due) {
    const row = screen.getByText(due.name, { selector: '.setting-row > div > span' }).closest<HTMLElement>('.setting-row')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Publish…' }));
    expect(location.hash).toBe('#' + detailPath(due) + '?dialog=publish');
  }
});

it('shows the CLI error instead of a list when the Library cannot be read', async () => {
  open('#/settings/publishing?__mock=error');
  // The error scenario fails the settings read too, so the section is the settings error board; assert the library error is not silently a blank card.
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

async function shareable() { const detail = await backend.skill({ ref: 'deploy-check' }); if (!detail.ok) throw new Error(detail.error); vi.spyOn(backend, 'skill').mockResolvedValue({ ok: true, value: { ...detail.value, teamState: 'shared' } }); }
it('the skill page publish dialog sends the Settings target and a typed category', async () => {
  await shareable();
  backend.prefs.set(PUBLISH_TARGET_KEY, 'SSM'); backend.prefs.set(PUBLISH_CATEGORY_KEY, CATEGORY_ASK);
  const publish = vi.spyOn(backend, 'publish').mockImplementation(() => createRun(async () => ({ ok: true, value: published() })));
  open('#/skill/deploy-check?dialog=publish');
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Publish to' })).toHaveTextContent('SSM'));
  fireEvent.change(within(dialog).getByRole('combobox', { name: 'Category' }), { target: { value: 'ops' } });
  expect(dialog.querySelector('.terminal-hint .board-mono')?.textContent).toMatch(/publish .* --project SSM --category ops$/);
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' })); });
  expect(publish).toHaveBeenCalledWith(expect.objectContaining({ project: 'SSM', category: 'ops' }));
});

it('the skill page dialog starts on the marketplace and sends neither --project nor --category', async () => {
  await shareable();
  const publish = vi.spyOn(backend, 'publish').mockImplementation(() => createRun(async () => ({ ok: true, value: published() })));
  open('#/skill/deploy-check?dialog=publish');
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('combobox', { name: 'Publish to' })).toHaveTextContent(MARKETPLACE_ONLY);
  expect(within(dialog).queryByRole('combobox', { name: 'Category' })).toBeNull();
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' })); });
  const args = publish.mock.calls[0]![0];
  expect(args.project).toBeUndefined(); expect(args.category).toBeUndefined();
});

it('the bulk dialog sends the target to every row and leaves categories to the model', async () => {
  backend.prefs.set(PUBLISH_TARGET_KEY, 'Terum'); backend.prefs.set(PUBLISH_CATEGORY_KEY, CATEGORY_ASK);
  // A selection of many is one batched run, so the flags are asserted on that single call's args.
  const publish = vi.spyOn(backend, 'publishMany').mockImplementation(args => createRun(async () => ({ ok: true, value: args.refs.map(() => published()) })));
  open('#/library/global?select=1');
  await screen.findByText('0 of 15 selected');
  fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
  fireEvent.click(within(screen.getByRole('toolbar', { name: 'Selection' })).getByRole('button', { name: /^Publish/ }));
  const dialog = await screen.findByTestId('bulk-publish-dialog');
  await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Publish to' })).toHaveTextContent('Terum'));
  expect(within(dialog).queryByRole('combobox', { name: 'Category' })).toBeNull();
  expect(within(dialog).getByText(/Suggested per skill by the model/)).toBeInTheDocument();
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: /^Publish \d+ skills$/ })); });
  await waitFor(() => expect(publish).toHaveBeenCalled());
  for (const call of publish.mock.calls) { expect(call[0].project).toBe('Terum'); expect(call[0].category).toBeUndefined(); expect(call[0].refs.length).toBeGreaterThan(1); }
});

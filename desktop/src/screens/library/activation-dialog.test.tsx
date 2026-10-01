import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tooltip } from '@base-ui/react/tooltip';
import { App } from '../../app/App';
import { Providers } from '../../app/providers';
import { useUiStore } from '../../app/store';
import { BackendContext, PrintContext, PromptContext } from '../../backend';
import { createMockBackend } from '../../backend/mock';
import type { Backend } from '../../backend/Backend';
import { PublishRunProvider } from '../../app/PublishRunProvider';

/**
 * The Library's Activation popup (2026-09-27): the Activation tile opens it, and it holds the root's
 * fires, misfires and dead skills over the window, one row per skill, and what stands out. It is a
 * URL state (`?dialog=activation`) like every dialog here, follows the tile's window, and never
 * starts a miss screening on its own.
 *
 * Mock fixture (backend/mock/usage.ts): over the last 30 days deploy-check fired 0/4, release-notes
 * 3/1, test-writer 2/0 (placed twelve days back), incident-triage 1/3 (not placed by Terum), and
 * pr-review fired twice seven weeks back, so it went quiet.
 */
function open(route: string) { location.hash = route; return render(<Providers><App /></Providers>); }
function openWith(backend: Backend, route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  location.hash = route;
  return render(<BackendContext value={backend}><QueryClientProvider client={client}><Tooltip.Provider><PromptContext value={async () => true}><PrintContext value={() => undefined}><PublishRunProvider><App/></PublishRunProvider></PrintContext></PromptContext></Tooltip.Provider></QueryClientProvider></BackendContext>);
}
const popup = async () => within(await screen.findByTestId('activation-dialog'));
/** The popup once its reads have landed. */
const loaded = async () => { const p = await popup(); await p.findByTestId('activation-timeline'); return p; };
const tile = () => screen.getByText('Activation', { selector: '.stat-label' }).closest('.stat-tile') as HTMLElement;

beforeEach(() => { localStorage.clear(); useUiStore.setState({ railOpen: true, overviewHidden: false, theme: 'dark' }); });
afterEach(() => { cleanup(); location.hash = ''; vi.restoreAllMocks(); });

it('opens from the Activation tile as a popup that is a link, and closes back to the Library', async () => {
  open('#/library/global');
  await screen.findByText('4 of 15', { selector: '.stat-value' });
  expect(tile().tagName).toBe('BUTTON');
  expect(tile()).toHaveAttribute('aria-haspopup', 'dialog');
  fireEvent.click(tile());
  await waitFor(() => expect(location.hash).toContain('dialog=activation'));
  const p = await loaded();
  expect(p.getByRole('region', { name: 'Activation over time' })).toBeInTheDocument();
  expect(p.getByRole('region', { name: 'Skills' })).toBeInTheDocument();
  expect(p.getByRole('region', { name: 'Worth a look' })).toBeInTheDocument();
  fireEvent.click(p.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(location.hash).not.toContain('dialog='));
  expect(screen.queryByTestId('activation-dialog')).toBeNull();
});

it('draws the root over the window with the tile\'s own numbers, and no rate', async () => {
  open('#/library/global?dialog=activation');
  const p = await loaded();
  // Global: 4 + 4 + 2 + 4 firings across its cards; 11 of 15 silent for the whole window.
  expect(p.getByTestId('timeline-fires')).toHaveTextContent(/^14/);
  expect(p.getByTestId('timeline-dead')).toHaveTextContent('11of 15');
  expect(p.getByTestId('timeline-misfires')).toHaveTextContent('—');
  expect(p.getByRole('row', { name: 'deploy-check, 4 firings' })).toBeInTheDocument();
  expect(p.getByText('Never fired in the last 30 days · 11')).toBeInTheDocument();
  expect((await screen.findByTestId('activation-dialog')).textContent ?? '').not.toMatch(/\d%/);
});

it('lists what stands out, in counts, and opens a skill from its name', async () => {
  open('#/library/global?dialog=activation');
  const p = await loaded();
  const look = within(p.getByRole('region', { name: 'Worth a look' }));
  expect(look.getByText('deploy-check only fires when named')).toBeInTheDocument();
  expect(look.getByText(/^Never chosen from its description: all 4 firings/)).toBeInTheDocument();
  expect(look.getByText('pr-review went quiet')).toBeInTheDocument();
  fireEvent.click(look.getByRole('button', { name: 'pr-review' }));
  // Global's mock cards are folders the team has never seen, so the page is addressed by path, as a card links it.
  await waitFor(() => expect(location.hash).toMatch(/^#\/skill\/local\?path=[^&]*pr-review&tab=activity$/));
});

it('spends no model call until Screen for misses is clicked, then counts the misfires for this root', async () => {
  const backend = createMockBackend();
  const spy = vi.spyOn(backend, 'misses');
  openWith(backend, '#/library/global?dialog=activation');
  const p = await loaded();
  expect(spy).not.toHaveBeenCalled();
  expect(p.getByText(/one model call per ten prompts/)).toBeInTheDocument();
  fireEvent.click(p.getByRole('button', { name: 'Screen for misses' }));
  await p.findByRole('button', { name: 'Screen again' });
  expect(spy).toHaveBeenCalledTimes(1);
  // deploy-check's two candidates and incident-triage's one all fall in the window and on Global.
  expect(p.getByTestId('timeline-misfires')).toHaveTextContent('3');
  expect(within(p.getByRole('row', { name: 'deploy-check, 4 firings' })).getAllByRole('cell')[5]).toHaveTextContent('2');
  expect(p.getByText(/candidates for review, not measured misses/)).toBeInTheDocument();
});

it('widens the window from the URL for the tile and the popup together', async () => {
  open('#/library/global?dialog=activation');
  const p = await loaded();
  fireEvent.click(p.getByRole('button', { name: '90 days' }));
  await waitFor(() => expect(location.hash).toContain('window=90'));
  expect(await p.findByText('Last 90 days')).toBeInTheDocument();
  // pr-review fired seven weeks back, so the wider window counts it among the fired.
  await waitFor(() => expect(tile()).toHaveTextContent('5 of 15'));
  expect(p.getByRole('button', { name: '90 days' })).toHaveAttribute('aria-pressed', 'true');
});

it('opens a skill\'s activity from its row, in the same window', async () => {
  open('#/library/global?dialog=activation&window=90');
  const p = await loaded();
  fireEvent.click(await p.findByRole('row', { name: /^release-notes, / }));
  await waitFor(() => expect(location.hash).toMatch(/^#\/skill\/local\?path=[^&]*release-notes&tab=activity&window=90$/));
});

it('reads the tile\'s window and the year behind it, each once, with no ref', async () => {
  const backend = createMockBackend();
  const spy = vi.spyOn(backend, 'usage');
  openWith(backend, '#/library/global?dialog=activation');
  await loaded();
  expect(spy.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([{ days: 30 }, { days: 365 }]));
  expect(spy).toHaveBeenCalledTimes(2);
});

it('is not a button for an empty library, and the URL cannot open it there', async () => {
  open('#/library/global?__mock=empty&dialog=activation');
  await screen.findByText('No skills in your global library');
  expect(screen.queryByTestId('activation-dialog')).toBeNull();
});

it('says why the timeline is missing on a CLI that predates per-day buckets, and keeps the counts', async () => {
  const backend = createMockBackend();
  const real = backend.usage.bind(backend);
  vi.spyOn(backend, 'usage').mockImplementation(async (q, o) => { const r = await real(q, o); return r.ok ? { ok: true, value: { ...r.value, daily: null } } : r; });
  openWith(backend, '#/library/global?dialog=activation');
  const p = await popup();
  expect(await p.findByText(/Per-day firings need terum-skills 0.24 or newer/)).toBeInTheDocument();
  expect(p.queryByTestId('activation-timeline')).toBeNull();
  expect(p.getByRole('row', { name: 'deploy-check, 4 firings' })).toBeInTheDocument();
  expect(await screen.findByText('4 of 15', { selector: '.stat-value' })).toBeInTheDocument();
});

it('surfaces a failed read as the CLI error, copyable', async () => {
  const backend = createMockBackend();
  vi.spyOn(backend, 'usage').mockResolvedValue({ ok: false, error: 'could not read transcripts' });
  openWith(backend, '#/library/global?dialog=activation');
  const error = await (await popup()).findByText('could not read transcripts');
  expect(error).toHaveClass('board-error-line');
});

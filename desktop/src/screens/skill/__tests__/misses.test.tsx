import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tooltip } from '@base-ui/react/tooltip';
import { BackendContext, PrintContext, PromptContext } from '../../../backend/index.js';
import { createMockBackend } from '../../../backend/mock/index.js';
import type { Backend } from '../../../backend/Backend.js';
import { App } from '../../../app/App.js';
import { PublishRunProvider } from '../../../app/PublishRunProvider';

afterEach(() => { cleanup(); location.hash = ''; localStorage.clear(); vi.restoreAllMocks(); });

async function openActivity(ref = 'deploy-check') {
  const backend = createMockBackend();
  const spy = vi.spyOn(backend, 'misses');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  location.hash = `#/skill/${ref}?tab=activity`;
  render(<BackendContext value={backend}><QueryClientProvider client={client}><Tooltip.Provider><PromptContext value={async () => true}><PrintContext value={() => undefined}><PublishRunProvider><App/></PublishRunProvider></PrintContext></PromptContext></Tooltip.Provider></QueryClientProvider></BackendContext>);
  await screen.findByRole('region', { name: 'Activity' });
  // The tab draws the screening beside its figures once the firings reads land.
  await screen.findByRole('region', { name: 'Misfires' });
  return { backend, spy };
}

const button = (): HTMLElement => screen.getByRole('button', { name: /Screen for misses|Screen again|Screening/ });

/**
 * THE test for this panel.
 *
 * Every other panel on the Activity tab reads on mount. This one spends model calls — roughly one
 * per ten prompts screened — so a render-time fetch would bill the user for opening a tab. The
 * backend types it as `Run` rather than `Promise<Result>` so it cannot be dropped into a `useQuery`
 * by accident, and this pins the behaviour so a future refactor cannot quietly undo it.
 */
it('makes NO model call until the button is clicked', async () => {
  const { spy } = await openActivity();
  expect(screen.getByRole('region', { name: 'Misfires' })).toBeTruthy();
  expect(spy).not.toHaveBeenCalled();
  // Still nothing after the tab has settled and every other panel has finished reading.
  await waitFor(() => expect(screen.getByText('Active days')).toBeTruthy());
  expect(spy).not.toHaveBeenCalled();
});

it('states the cost before it is spent, not after', async () => {
  await openActivity();
  expect(screen.getByText(/one model call per ten prompts/)).toBeTruthy();
});

it('screens on click and renders this skill candidates', async () => {
  const { spy } = await openActivity();
  fireEvent.click(button());
  await screen.findByText(/ship the new build to staging/);
  expect(spy).toHaveBeenCalledTimes(1);
  // No ref: a per-skill call costs exactly what a whole-machine call costs, because the judge runs
  // over every prompt either way. One run answers every skill page.
  expect(spy.mock.calls[0]![0]).toBeUndefined();
});

it('shows only THIS skill rows out of the whole-machine result', async () => {
  await openActivity();
  fireEvent.click(button());
  await screen.findByText(/ship the new build to staging/);
  // incident-triage is in the same report and must not leak onto deploy-check's page.
  expect(screen.queryByText(/prod is throwing 500s/)).toBeNull();
});

it('marks a candidate the judge saw with no prior context', async () => {
  await openActivity();
  fireEvent.click(button());
  await screen.findByText(/no prior context/i);
});

it('prints the caveats, so a candidate list is never read as a miss rate', async () => {
  await openActivity();
  fireEvent.click(button());
  await screen.findByText(/candidates for review, not measured misses/);
});

it('shows no percentage anywhere — this is not a rate', async () => {
  await openActivity();
  fireEvent.click(button());
  await screen.findByText(/ship the new build to staging/);
  const region = screen.getByRole('region', { name: 'Activity' });
  expect(region.textContent ?? '').not.toMatch(/\d%/);
});

it('reads an empty result as a real answer, not a failure', async () => {
  // pr-review is the 0/0 row in `usage` — the ambiguous one this feature exists to disambiguate.
  await openActivity('pr-review');
  fireEvent.click(button());
  await screen.findByText(/Nothing worth reviewing/);
});

it('surfaces an error instead of pretending nothing applied', async () => {
  const backend = createMockBackend();
  vi.spyOn(backend, 'misses').mockReturnValue({
    done: Promise.resolve({ ok: false, error: 'model call failed' }),
    answer: () => undefined, cancel: async () => undefined,
    frames: { async *[Symbol.asyncIterator]() {} },
  } as unknown as ReturnType<Backend['misses']>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  location.hash = '#/skill/deploy-check?tab=activity';
  render(<BackendContext value={backend}><QueryClientProvider client={client}><Tooltip.Provider><PromptContext value={async () => true}><PrintContext value={() => undefined}><PublishRunProvider><App/></PublishRunProvider></PrintContext></PromptContext></Tooltip.Provider></QueryClientProvider></BackendContext>);
  await screen.findByRole('region', { name: 'Misfires' });
  fireEvent.click(button());
  await screen.findByText(/model call failed/);
});

it('hides the panel entirely when the CLI does not advertise the feature', async () => {
  const backend = createMockBackend();
  const features = await backend.features();
  vi.spyOn(backend, 'features').mockResolvedValue({ ...features, misses: false });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  location.hash = '#/skill/deploy-check?tab=activity';
  render(<BackendContext value={backend}><QueryClientProvider client={client}><Tooltip.Provider><PromptContext value={async () => true}><PrintContext value={() => undefined}><PublishRunProvider><App/></PublishRunProvider></PrintContext></PromptContext></Tooltip.Provider></QueryClientProvider></BackendContext>);
  await screen.findByText('Active days');
  expect(screen.queryByRole('region', { name: 'Misfires' })).toBeNull();
});

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
 * The Activity tab (build spec §6, decision D6 2026-09-15; redrawn 2026-09-27) draws live firings
 * and only those: four figures for the window, the one note they raise, a year of days with the
 * window bracketed, what happened since placement, the prompts it should have caught, and the CLI's
 * caveats.
 *
 * The outcomes below are genuinely different statements and the tab must not collapse them. The one
 * where a skill is placed here and never fired is the case the whole feature exists to surface, and
 * it is the one a naive "no data" empty state would erase.
 *
 * Mock fixture (backend/mock/usage.ts): over the last 30 days deploy-check 0/4, release-notes 3/1,
 * test-writer 2/0 (placed twelve days back), pr-review 0/0 (it fired seven weeks back), env-audit 0/0
 * (undated) placed; incident-triage 1/3 fired but NOT placed; commit-msg has nothing recorded.
 */
function open(route: string) { location.hash = route; return render(<Providers><App /></Providers>); }
function openWith(backend: Backend, route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  location.hash = route;
  return render(<BackendContext value={backend}><QueryClientProvider client={client}><Tooltip.Provider><PromptContext value={async () => true}><PrintContext value={() => undefined}><PublishRunProvider><App/></PublishRunProvider></PrintContext></PromptContext></Tooltip.Provider></QueryClientProvider></BackendContext>);
}
/** The tab once both reads have landed: await the figures, not just the region. */
const activity = async () => { const tab = within(await screen.findByRole('region', { name: 'Activity' })); await tab.findByText('Active days'); return tab; };
type Tab = ReturnType<typeof within>;
/** The number under one of the four figure labels. */
const figure = (tab: Tab, label: string) => tab.getByText(label, { selector: '.activity-stat > span:first-child' }).parentElement?.querySelector('.activity-stat-value')?.textContent;
/** What qualifies one of the four figures. */
const qualifier = (tab: Tab, label: string) => tab.getByText(label, { selector: '.activity-stat > span:first-child' }).parentElement?.querySelector('.board-small')?.textContent;
/** One "Since placement" row: its value and the line under it. */
const since = (tab: Tab, label: string) => { const cell = within(tab.getByRole('region', { name: 'Since placement' })).getByText(label); return [cell.nextElementSibling?.textContent, cell.nextElementSibling?.nextElementSibling?.textContent]; };
const note = (tab: Tab) => tab.queryByRole('status');

beforeEach(() => { localStorage.clear(); useUiStore.setState({ railOpen: true, overviewHidden: false, theme: 'dark' }); });
afterEach(() => { cleanup(); location.hash = ''; vi.restoreAllMocks(); });

it('names a skill people reach for that the model never chooses — the reason this tab exists', async () => {
  open('#/skill/deploy-check?tab=activity');
  const tab = await activity();
  expect(figure(tab, 'Firings')).toMatch(/^4/);
  expect(qualifier(tab, 'Firings')).toBe('0 by the model · 4 by name');
  expect(note(tab)).toHaveTextContent('Only fires when named');
  expect(note(tab)).toHaveTextContent(/Never chosen from its description: all 4 firings in the last 30 days were typed by name\./);
});

it('does not brand a skill the model does choose', async () => {
  open('#/skill/release-notes?tab=activity');
  const tab = await activity();
  expect(qualifier(tab, 'Firings')).toBe('3 by the model · 1 by name');
  expect(tab.queryByText(/Never chosen from its description/)).toBeNull();
  expect(note(tab)).toBeNull();
});

it('says placed-and-never-fired rather than reporting nothing, and why when the record can', async () => {
  open('#/skill/pr-review?tab=activity');
  const tab = await activity();
  expect(note(tab)).toHaveTextContent('Placed here and never fired in the last 30 days');
  expect(note(tab)).toHaveTextContent(/It fired 2 times in the 30 days before/);
  // Never-fired is a real finding, not an absence: the zero figures still render.
  expect(figure(tab, 'Firings')).toMatch(/^0/);
  expect(figure(tab, 'Active days')).toBe('0of 31');
  expect(since(tab, 'Placed')[0]).toBe('1 Jul 2026');
});

it('shows firings for a copy Terum did not place, instead of claiming it is not installed', async () => {
  // Regression: `decision-walk` lives at ~/.claude/skills/decision-walk with four recorded firings,
  // but is absent from the placements ledger. The tab read "Not installed on this machine" while the
  // rail beside it read "Installed · on this machine", and the counts were thrown away.
  open('#/skill/incident-triage?tab=activity');
  const tab = await activity();
  expect(qualifier(tab, 'Firings')).toBe('1 by the model · 3 by name');
  expect(since(tab, 'Placement')).toEqual(['Not placed by Terum', expect.stringMatching(/Terum did not place this copy/)]);
  expect(tab.queryByText(/[Nn]ot installed/)).toBeNull();
});

it('claims nothing about installation when it simply has no firings to report, and draws no count', async () => {
  open('#/skill/commit-msg?tab=activity');
  const tab = await activity();
  expect(note(tab)).toHaveTextContent('No firings recorded for this skill in the last 30 days');
  expect(note(tab)).toHaveTextContent(/transcripts, not the filesystem/);
  // A zero here would read exactly like the placed-and-silent case, which is a different finding.
  expect(figure(tab, 'Firings')).toBe('—');
  expect(since(tab, 'Placement')).toEqual(['—', 'No Terum placement recorded']);
  expect(tab.queryByText(/[Nn]ot installed/)).toBeNull();
});

it('hedges an undated placement and outlines the days before a recent one, each in its own words', async () => {
  open('#/skill/env-audit?tab=activity');
  let tab = await activity();
  expect(since(tab, 'Placed')).toEqual(['Undated', 'Placed by Terum; the ledger records no placement date']);
  cleanup();
  open('#/skill/test-writer?tab=activity');
  tab = await activity();
  expect(tab.getByText('Before placement on 3 Sep')).toBeInTheDocument();
  expect(since(tab, 'Placed')[0]).toBe('3 Sep 2026');
});

it('always carries the invocations-not-outcomes caveat, and never a rate', async () => {
  open('#/skill/deploy-check?tab=activity');
  const tab = await activity();
  expect(tab.getByText(/invocations, not outcome-changing uses/)).toBeVisible();
  expect(tab.getByText(/30-day window: Claude Code prunes transcripts/)).toBeVisible();
  expect((await screen.findByRole('region', { name: 'Activity' })).textContent ?? '').not.toMatch(/\d%/);
});

it('reads the whole machine with no ref — the window and the year behind it, each once — so every skill page shares the reads', async () => {
  const backend = createMockBackend();
  const spy = vi.spyOn(backend, 'usage');
  openWith(backend, '#/skill/deploy-check?tab=activity');
  await activity();
  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([{ days: 30 }, { days: 365 }]));
});

it('surfaces a failed read as the CLI error, copyable, with no figures', async () => {
  const backend = createMockBackend();
  vi.spyOn(backend, 'usage').mockResolvedValue({ ok: false, error: 'could not read transcripts' });
  openWith(backend, '#/skill/deploy-check?tab=activity');
  const region = await screen.findByRole('region', { name: 'Activity' });
  const error = await within(region).findByText('could not read transcripts');
  expect(error).toHaveClass('board-error-line');
  expect(within(region).queryByText('Active days')).toBeNull();
});

it('draws the year, one cell a day, with the window bracketed and the days before placement outlined', async () => {
  open('#/skill/deploy-check?tab=activity');
  const tab = await activity();
  const grid = tab.getByTestId('firing-heatmap');
  expect(grid.querySelectorAll('.heat-cell')).toHaveLength(365);
  expect(grid.querySelectorAll('.heat-cell:not([data-level="0"])').length).toBeGreaterThanOrEqual(4);
  // Placed 76 days before the window's end: most of the year is outlines, not silence.
  expect(grid.querySelectorAll('.heat-cell[data-before="true"]').length).toBeGreaterThan(250);
  expect(tab.getByTestId('window-bracket')).toHaveTextContent('The last 30 days · 4 firings');
  expect(tab.getByText(/firings? in the last year$/)).toBeInTheDocument();
});

it('reads the figures off the window: active days, longest streak, last fired', async () => {
  open('#/skill/deploy-check?tab=activity');
  const tab = await activity();
  expect(figure(tab, 'Active days')).toBe('4of 31');
  expect(figure(tab, 'Longest streak')).toBe('1day');
  expect(figure(tab, 'Last fired')).toBe('2 days ago');
  expect(qualifier(tab, 'Last fired')).toBe('Sun 13 Sep');
  expect(since(tab, 'Last fired')[0]).toBe('13 Sep 2026');
  expect(within(tab.getByRole('region', { name: 'Since placement' })).getByText('All time')).toBeInTheDocument();
});

it('widens the window from the URL, so a 90-day view is a link and brings a dead skill back to life', async () => {
  open('#/skill/pr-review?tab=activity');
  let tab = await activity();
  expect(note(tab)).toHaveTextContent('Placed here and never fired');
  fireEvent.click(tab.getByRole('button', { name: '90 days' }));
  expect(location.hash).toContain('window=90');
  tab = await activity();
  await waitFor(() => expect(tab.getByTestId('window-bracket')).toHaveTextContent('The last 90 days · 2 firings'));
  expect(qualifier(tab, 'Firings')).toBe('2 by the model · 0 by name');
  expect(note(tab)).toBeNull();
  expect(tab.getByRole('button', { name: '90 days' })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps the counts and says why the calendar is missing on a CLI that predates per-day buckets', async () => {
  const backend = createMockBackend();
  const real = backend.usage.bind(backend);
  vi.spyOn(backend, 'usage').mockImplementation(async (q, o) => { const r = await real(q, o); return r.ok ? { ok: true, value: { ...r.value, daily: null } } : r; });
  openWith(backend, '#/skill/deploy-check?tab=activity');
  const tab = within(await screen.findByRole('region', { name: 'Activity' }));
  expect(await tab.findByText(/Per-day firings need terum-skills 0.24 or newer/)).toBeVisible();
  expect(tab.queryByTestId('firing-heatmap')).toBeNull();
  expect(figure(tab, 'Firings')).toBe('4');
  expect(qualifier(tab, 'Firings')).toBe('0 by the model · 4 by name');
});

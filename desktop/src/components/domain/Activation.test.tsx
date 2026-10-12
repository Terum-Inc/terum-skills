import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActivationTimeline, WindowPicker, YearHeatmap } from './Activation';
import { history, scopeTimeline, windowPhrase, yearCalendar } from '../../lib/activation';
import { mockUsage } from '../../backend/mock/usage';
import type { SkillCard } from '../../backend/types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const card = (name: string): SkillCard => ({ name, flags: [] }) as unknown as SkillCard;
/** The mock's 30-day window and the year behind it, as the Activity tab and the popup read them. */
const reads = (days: 30 | 365 = 30) => { const window = mockUsage(days), older = mockUsage(days === 30 ? 365 : 732); return { window, h: history(window, older)! }; };
const screening = { groups: [{ skill: 'deploy-check', candidates: [{ prompt: 'p', ts: '2026-09-12T09:14:00.000Z', noPriorContext: false }] }], screened: 1, calls: 1, truncated: false, unjudged: 0, since: '2026-09-08T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z', caveats: [] };

it('offers the three windows and reports the chosen one, as a group of pressed buttons', () => {
 const onChange = vi.fn();
 render(<WindowPicker value={90} onChange={onChange} />);
 const group = screen.getByRole('group', { name: 'Window' });
 expect(group.querySelectorAll('button')).toHaveLength(3);
 expect(screen.getByRole('button', { name: '90 days' })).toHaveAttribute('aria-pressed', 'true');
 expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'false');
 fireEvent.click(screen.getByRole('button', { name: '1 year' }));
 expect(onChange).toHaveBeenCalledWith(365);
});

it('draws a year, one cell a day, and names every day and who started its firings', () => {
 const { window, h } = reads(), model = yearCalendar(h, window, 'deploy-check');
 const { container } = render(<YearHeatmap model={model} skill="deploy-check" bracket="The last 30 days · 4 firings" />);
 expect(container.querySelectorAll('.heat-cell')).toHaveLength(365);
 expect(container.querySelectorAll('.heat-cell:not([data-level="0"])')).toHaveLength(model.cells.filter(c => c.total > 0).length);
 const lit = container.querySelector('.heat-cell:not([data-level="0"]) title');
 expect(lit?.textContent).toMatch(/\d+ firings? · \d+ chosen by the model · \d+ by name/);
 expect(screen.getByRole('img', { name: 'Firings of deploy-check by day over the last year' })).toBeInTheDocument();
 expect(container.querySelectorAll('.heat-scale .sq')).toHaveLength(5);
 expect(container.textContent).toMatch(/Less.*More/);
});

it('outlines the days before the ledger placed a skill, so silence there is not silence', () => {
 // deploy-check was placed 76 days before the window's end.
 const { window, h } = reads(), { container } = render(<YearHeatmap model={yearCalendar(h, window, 'deploy-check')} skill="deploy-check" bracket={null} />);
 const hollow = container.querySelectorAll('.heat-cell[data-before="true"]');
 expect(hollow.length).toBeGreaterThan(250);
 expect(hollow[0]?.querySelector('title')?.textContent).toMatch(/not yet placed/);
 expect(container.textContent).toMatch(/Before placement on 1 Jul/);
});

it('brackets the window under the weeks it covers, and draws no bracket when the window is the year', () => {
 const short = reads(), { container, rerender } = render(<YearHeatmap model={yearCalendar(short.h, short.window, 'release-notes')} skill="release-notes" bracket="The last 30 days · 4 firings" />);
 expect(screen.getByTestId('window-bracket')).toHaveTextContent('The last 30 days · 4 firings');
 const year = reads(365);
 rerender(<YearHeatmap model={yearCalendar(year.h, year.window, 'release-notes')} skill="release-notes" bracket={null} />);
 expect(screen.queryByTestId('window-bracket')).toBeNull();
 expect(container.querySelectorAll('.heat-cell').length).toBeGreaterThanOrEqual(365);
});

const skills = ['deploy-check', 'release-notes', 'pr-review', 'commit-msg'].map(card);
const slot = { empty: <button type="button">Screen for misses</button>, action: <button type="button">Screen again</button> };

it('draws fires, misfires and dead skills as three rows, each ending on its number', () => {
 const { window, h } = reads();
 render(<ActivationTimeline timeline={scopeTimeline(h, window, skills, null)} phrase={windowPhrase(30)} span="30 days" misfires={slot} />);
 // Fires across the four: deploy-check 4 + release-notes 4. Dead now: pr-review and commit-msg.
 expect(screen.getByTestId('timeline-fires')).toHaveTextContent(/^8/);
 expect(screen.getByTestId('timeline-dead')).toHaveTextContent('2of 4');
 expect(screen.getByTestId('timeline-misfires')).toHaveTextContent('—');
 expect(screen.getByText('Not screened yet')).toBeInTheDocument();
 // Before a screening the plot holds the way to start one, not an empty line that reads as none.
 expect(screen.getByRole('button', { name: 'Screen for misses' })).toBeInTheDocument();
 expect(screen.queryByRole('button', { name: 'Screen again' })).toBeNull();
 expect(document.querySelector('[data-series="fires"] .timeline-ghost')).not.toBeNull();
 expect(document.body.textContent ?? '').not.toMatch(/\d%/);
});

it('plots misfires once a screening exists, and drops the row entirely when the CLI cannot screen', () => {
 const { window, h } = reads();
 const { rerender } = render(<ActivationTimeline timeline={scopeTimeline(h, window, skills, screening)} phrase={windowPhrase(30)} span="30 days" misfires={slot} />);
 expect(screen.getByTestId('timeline-misfires')).toHaveTextContent('1');
 expect(document.querySelector('[data-series="misfires"] .timeline-line')).not.toBeNull();
 expect(screen.getByRole('button', { name: 'Screen again' })).toBeInTheDocument();
 rerender(<ActivationTimeline timeline={scopeTimeline(h, window, skills, null)} phrase={windowPhrase(30)} span="30 days" misfires={null} />);
 expect(screen.queryByTestId('timeline-misfires')).toBeNull();
 expect(screen.queryByText('Misfires')).toBeNull();
});

it('names the day under the pointer with all three values, on every row at once', () => {
 const { window, h } = reads();
 const { container } = render(<ActivationTimeline timeline={scopeTimeline(h, window, skills, null)} phrase={windowPhrase(30)} span="30 days" misfires={slot} />);
 const plot = container.querySelector('.timeline-plot') as HTMLElement;
 // jsdom lays nothing out; the plot maps the pointer through the box it is drawn in.
 vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 560, top: 0, height: 60, right: 560, bottom: 60, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
 fireEvent.pointerMove(plot, { clientX: 559 });
 const tip = screen.getByRole('status');
 expect(tip).toHaveTextContent(/Tue 15 Sep/);
 expect(tip).toHaveTextContent(/Fires\d+ · 8 so far/);
 expect(tip).toHaveTextContent(/Dead skills2 of 4/);
 expect(container.querySelectorAll('.timeline-guide')).toHaveLength(2);
 fireEvent.pointerLeave(plot);
 expect(screen.queryByRole('status')).toBeNull();
});

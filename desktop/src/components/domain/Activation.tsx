import { useId, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { UsageWindow } from '../../backend/types';
import { USAGE_WINDOWS } from '../../backend/types';
import type { ScopeTimeline, YearCalendar } from '../../lib/activation';
import { MONTHS, WEEKDAYS, dayLabel, dayRangeLabel, parseDay, shortDayLabel } from '../../lib/activation';
import { useElementSize } from './useElementSize';
import './Activation.css';

const WINDOW_LABELS: Record<UsageWindow, string> = { 30: '30 days', 90: '90 days', 365: '1 year' };
/** The three windows, as a segmented control. The value lives in the URL (`?window=`), so a view is a link. */
export function WindowPicker({ value, onChange }: { value: UsageWindow; onChange: (days: UsageWindow) => void }) {
 return <div className="window-picker" role="group" aria-label="Window">{USAGE_WINDOWS.map(days => <button key={days} type="button" aria-pressed={value === days} onClick={() => onChange(days)}>{WINDOW_LABELS[days]}</button>)}</div>;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
function cellTitle(cell: YearCalendar['cells'][number]): string {
 const when = dayLabel(cell.day);
 if (cell.beforePlacement) return `${when} · not yet placed`;
 if (cell.total === 0) return `${when} · no firings`;
 return `${when} · ${plural(cell.total, 'firing')} · ${cell.d1} chosen by the model · ${cell.d2} by name`;
}
/**
 * A skill's year of firings, the way GitHub draws contributions: weeks as columns, Monday on top, a
 * cell a day, deepening with the day's count (quartiles of the busiest day shown, so a quiet skill
 * still shows its shape). It spans the whole width — the cell size follows the column count and the
 * pane — and scrolls to the latest week when a pane is too narrow for a year. A day before the
 * ledger placed the skill is an outline: silence there is not silence. The window the rest of the
 * tab counts is bracketed under the weeks it covers. Every cell names its day and counts.
 */
export function YearHeatmap({ model, skill, bracket }: { model: YearCalendar; skill: string; /** The bracket's label, or null when the window is the whole calendar. */ bracket: string | null }) {
 const [ref, size] = useElementSize<HTMLDivElement>({ width: 760, height: 0 });
 const LEFT = 30, TOP = 18, GAP = 3;
 const STEP = Math.max(12, Math.min(22, Math.floor((size.width - LEFT + GAP) / Math.max(1, model.columns)))), CELL = STEP - GAP, rx = CELL >= 14 ? 3 : 2;
 const gridWidth = model.columns * STEP - GAP, bracketed = bracket !== null && model.windowColumn !== null;
 const width = LEFT + gridWidth, height = TOP + 7 * STEP - GAP + (bracketed ? 30 : 2);
 // Show the latest weeks when a year does not fit: the newest days are the ones anyone came to read.
 useLayoutEffect(() => { const element = ref.current; if (element !== null && element.scrollWidth > element.clientWidth) element.scrollLeft = element.scrollWidth; }, [ref, width, model]);
 const bracketLeft = bracketed ? LEFT + model.windowColumn! * STEP : 0, bracketY = TOP + 7 * STEP - GAP + 8;
 return <div className="year-heatmap">
  <div ref={ref} className="year-heatmap-scroll">
   <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Firings of ${skill} by day over the last year`} data-testid="firing-heatmap">
    {model.months.map(m => <text key={m.label + m.column} className="heat-label" x={LEFT + m.column * STEP} y={11}>{m.label}</text>)}
    {[0, 2, 4].map(row => <text key={row} className="heat-label" x={0} y={TOP + row * STEP + CELL / 2 + 3.5}>{WEEKDAYS[row]}</text>)}
    {model.cells.map((cell, i) => {
     const slot = i + model.firstWeekday, column = Math.floor(slot / 7), row = slot % 7;
     return cell.beforePlacement
      ? <rect key={cell.day} className="heat-cell" data-level={0} data-before="true" x={LEFT + column * STEP + 0.5} y={TOP + row * STEP + 0.5} width={CELL - 1} height={CELL - 1} rx={rx}><title>{cellTitle(cell)}</title></rect>
      : <rect key={cell.day} className="heat-cell" data-level={cell.level} x={LEFT + column * STEP} y={TOP + row * STEP} width={CELL} height={CELL} rx={rx}><title>{cellTitle(cell)}</title></rect>;
    })}
    {bracketed ? <g className="heat-bracket" data-testid="window-bracket"><path d={`M${bracketLeft + 0.5},${bracketY - 4}V${bracketY + 0.5}H${width - 0.5}V${bracketY - 4}`} /><text x={width} y={bracketY + 16} textAnchor="end">{bracket}</text></g> : null}
   </svg>
  </div>
  <div className="heat-legend">
   <span>{model.placedDay !== null ? <span className="heat-hollow"><i />Before placement on {shortDayLabel(model.placedDay)}</span> : null}</span>
   <span className="heat-scale"><span>Less</span>{[0, 1, 2, 3, 4].map(level => <span key={level} className="sq" data-level={level} />)}<span>More</span></span>
  </div>
 </div>;
}

/** A round number just above `v`, so a row's scale reads cleanly: 4, 5, 10, 15, 20, 25, 30, 40, 50, … */
function niceMax(v: number): number {
 if (v <= 4) return Math.max(1, Math.ceil(v));
 const p = 10 ** Math.floor(Math.log10(v));
 for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
 return 10 * p;
}
const PX = 4, PT = 10, PB = 2;
type Series = { values: number[]; from: number; kind: 'line' | 'step'; ghost?: number[] | null; max: number; tone: 'fires' | 'misfires' | 'dead' };
/** One row's plot at the pixels it occupies. The hover guide is drawn by every row at once, so the
 *  three lines are read on the same day. */
function Plot({ series, n, hover, onHover }: { series: Series | null; n: number; hover: number | null; onHover: (k: number | null) => void }) {
 const [ref, size] = useElementSize<HTMLDivElement>({ width: 560, height: 60 });
 const gradient = useId();
 const W = size.width, H = Math.max(44, size.height);
 const x = (k: number): number => PX + (n <= 1 ? 0 : (k * (W - 2 * PX)) / (n - 1));
 const y = (v: number): number => PT + (H - PT - PB) * (1 - v / (series?.max ?? 1));
 const points = series === null ? [] : series.values.map((v, i) => [x(series.from + i), y(v)] as const);
 const line = points.length === 0 ? '' : series!.kind === 'step'
  ? points.map(([px, py], i) => i === 0 ? `M${px.toFixed(1)},${py.toFixed(1)}` : `H${px.toFixed(1)}V${py.toFixed(1)}`).join('')
  : points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join('');
 const end = points[points.length - 1];
 const area = series?.kind === 'line' && points.length > 1 ? `${line}L${end![0].toFixed(1)},${y(0).toFixed(1)}L${points[0]![0].toFixed(1)},${y(0).toFixed(1)}Z` : '';
 const ghost = series?.ghost ? series.ghost.map((v, k) => `${k === 0 ? 'M' : 'L'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('') : '';
 const at = hover === null || series === null ? null : hover - series.from;
 function move(event: React.PointerEvent<HTMLDivElement>) {
  const box = event.currentTarget.getBoundingClientRect(); if (box.width === 0 || n === 0) return;
  onHover(Math.max(0, Math.min(n - 1, Math.round((((event.clientX - box.left) / box.width) * W - PX) / (W - 2 * PX) * (n - 1)))));
 }
 return <div ref={ref} className="timeline-plot" onPointerMove={move} onPointerLeave={() => onHover(null)}>
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-series={series?.tone}>
   <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0" className={`stop-${series?.tone ?? 'dead'}`} stopOpacity="0.22" /><stop offset="1" className={`stop-${series?.tone ?? 'dead'}`} stopOpacity="0" /></linearGradient></defs>
   {series !== null ? <><line className="timeline-top" x1={0} x2={W} y1={y(series.max)} y2={y(series.max)} /><text className="timeline-scale" x={PX} y={y(series.max) + 11}>{series.max}</text></> : null}
   <line className="timeline-base" x1={0} x2={W} y1={y(0)} y2={y(0)} />
   {area ? <path d={area} fill={`url(#${gradient})`} /> : null}
   {ghost ? <path className="timeline-ghost" d={ghost} /> : null}
   {line ? <path className={`timeline-line ${series!.tone}`} d={line} /> : null}
   {end ? <circle className={`timeline-dot ${series!.tone}`} cx={end[0]} cy={end[1]} r={3.25} /> : null}
   {hover !== null ? <line className="timeline-guide" x1={x(hover)} x2={x(hover)} y1={0} y2={H} /> : null}
   {at !== null && at >= 0 && at < points.length ? <circle className={`timeline-dot ${series!.tone}`} cx={points[at]![0]} cy={points[at]![1]} r={3.25} /> : null}
  </svg>
 </div>;
}
/** The shared date axis under the three rows: a tick a week at 30 days, a month beyond. */
function Axis({ days }: { days: string[] }) {
 const [ref, size] = useElementSize<HTMLDivElement>({ width: 560, height: 0 });
 const n = days.length, W = size.width, x = (k: number): number => PX + (n <= 1 ? 0 : (k * (W - 2 * PX)) / (n - 1));
 const ticks: number[] = [];
 if (n <= 31) { for (let k = n - 1; k >= 0; k -= 7) ticks.unshift(k); }
 else days.forEach((day, k) => { if (parseDay(day).getDate() === 1) ticks.push(k); });
 const shown: number[] = [];
 for (const k of ticks) if (shown.length === 0 || x(k) - x(shown[shown.length - 1]!) >= (n <= 31 ? 44 : 30)) shown.push(k);
 return <div ref={ref} className="timeline-axis-plot">
  <svg width={W} height={24} viewBox={`0 0 ${W} 24`} aria-hidden="true">
   {shown.map(k => <g key={k}><line x1={x(k)} x2={x(k)} y1={0} y2={4} /><text x={x(k)} y={16} textAnchor={x(k) < 18 ? 'start' : x(k) > W - 18 ? 'end' : 'middle'}>{n <= 31 ? shortDayLabel(days[k]!) : MONTHS[parseDay(days[k]!).getMonth()]}</text></g>)}
  </svg>
 </div>;
}

/**
 * The Library root's activation over time: fires, misfires and dead skills as three rows on one date
 * axis, each on its own scale — a handful of firings a day and every skill on the root are
 * different magnitudes, and one axis flattened the smaller onto its baseline. Fires and misfires are
 * running totals, so each line ends on the number beside it; the dashed line is the window before,
 * day for day. Dead skills is a level. Pointing at a day marks it on all three and names its values.
 * Counts, never a rate.
 */
export function ActivationTimeline({ timeline: t, phrase, span, misfires: slot }: { timeline: ScopeTimeline; phrase: { current: string; previous: string }; /** "30 days" / "year": the run of days a dead skill has been silent for. */ span: string; /** The screening's controls, or null when the CLI cannot screen: then there is no misfires row at all. `empty` fills the plot until a screening has run; `action` sits under the count once one has. */ misfires: { empty: ReactNode; action: ReactNode } | null }) {
 const [hover, setHover] = useState<number | null>(null);
 const n = t.days.length, last = n - 1;
 const fires = t.cumulative[last] ?? 0, previous = t.previous === null ? null : t.previous[last] ?? 0;
 const delta = previous === null ? null : fires - previous;
 const m = t.misfires;
 const rows: { key: 'fires' | 'misfires' | 'dead'; name: string; value: ReactNode; foot: ReactNode; extra?: ReactNode; empty?: ReactNode; series: Series | null }[] = [
  { key: 'fires', name: 'Fires', value: <>{fires}{delta !== null ? <span className="timeline-delta" data-trend={delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'} title={`${fires} in ${phrase.current} · ${previous} in ${phrase.previous}`}>{delta > 0 ? `↑${delta}` : delta < 0 ? `↓${-delta}` : 'same'}</span> : null}</>, foot: previous === null ? `The record does not reach ${phrase.previous}` : <><span className="timeline-ghost-key" />{previous} in {phrase.previous}</>, series: { values: t.cumulative, from: 0, kind: 'line', ghost: t.previous, max: niceMax(Math.max(fires, previous ?? 0)), tone: 'fires' } },
  ...(slot === null ? [] : [{ key: 'misfires' as const, name: 'Misfires', value: m === null ? '—' : m.total, foot: m === null ? 'Not screened yet' : m.cumulative.length === 0 ? `No screened days in ${phrase.current}` : `Should have fired and did not · screened ${dayRangeLabel(t.days[m.from]!, t.days[m.to]!)}`, extra: m === null ? null : slot.action, empty: m === null ? slot.empty : null, series: m === null || m.cumulative.length === 0 ? null : { values: m.cumulative, from: m.from, kind: 'line' as const, max: niceMax(Math.max(4, m.total)), tone: 'misfires' as const } }]),
  { key: 'dead', name: 'Dead skills', value: <>{t.dead[last] ?? 0}<small>of {t.present[last] ?? t.total}</small></>, foot: `No firing in the ${span} up to each day`, series: { values: t.dead, from: 0, kind: 'step', max: niceMax(Math.max(1, t.total)), tone: 'dead' } },
 ];
 const day = hover === null ? null : t.days[hover]!;
 const missAt = hover === null || m === null || hover < m.from || hover > m.to ? null : m.cumulative[hover - m.from]!;
 return <div className="timeline" data-testid="activation-timeline" style={{ ['--t' as string]: hover === null || n <= 1 ? 0 : hover / (n - 1) }}>
  {rows.map(row => <div key={row.key} className="timeline-row" data-row={row.key}>
   <div className="timeline-label">
    <span className="timeline-name"><i className={row.key} />{row.name}</span>
    <span className="timeline-value" data-testid={`timeline-${row.key}`}>{row.value}</span>
    <span className="timeline-foot">{row.foot}</span>
    {row.extra}
   </div>
   <div className="timeline-chart">{row.empty ? <div className="timeline-empty">{row.empty}</div> : <Plot series={row.series} n={n} hover={hover} onHover={setHover} />}</div>
  </div>)}
  <div className="timeline-row timeline-axis"><div /><div className="timeline-chart"><Axis days={t.days} /></div></div>
  {day !== null && hover !== null ? <div className="timeline-tip" role="status">
   <b>{dayLabel(day)}</b>
   <span><i className="fires" />Fires<em>{t.fires[hover]} · {t.cumulative[hover]} so far</em></span>
   {t.previous !== null ? <span><i className="ghost" />{phrase.previous.replace(/^the /, '').replace(/^./, c => c.toUpperCase())}<em>{t.previous[hover]} by then</em></span> : null}
   {slot !== null ? <span><i className="misfires" />Misfires<em>{missAt === null ? m === null ? 'not screened yet' : 'not screened' : `${m!.perDay[hover]} · ${missAt} so far`}</em></span> : null}
   <span><i className="dead" />Dead skills<em>{t.dead[hover]} of {t.present[hover]}</em></span>
  </div> : null}
 </div>;
}

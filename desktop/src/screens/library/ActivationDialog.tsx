import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useBackend, useFeatures } from '../../backend';
import type { SkillCard, UsageWindow } from '../../backend/types';
import { activationFindings, dayLabel, dayRangeLabel, daysAgoLabel, fullDayLabel, history, historyDays, scopeTimeline, shortDayLabel, skillRows, windowPhrase } from '../../lib/activation';
import type { Finding, SkillRow } from '../../lib/activation';
import { ActivationTimeline, WindowPicker } from '../../components/domain/Activation';
import { ACTIVATION_UNSUPPORTED } from '../../components/domain/Analytics';
import { useMissScreening } from '../../components/domain/useMissScreening';
import { detailHref } from '../../components/domain/skill-card-actions';
import { BoardSkeleton, ErrorLine, IconButton, SectionLabel, Small, VerdictChip } from '../../components/domain/Primitives';
import { Button } from '../../components/ui/Button';
import { Dialog, DialogPopup, DialogTitle } from '../../components/ui/Dialog';
import './activation-dialog.css';

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
/** A skill's page on its Activity tab, in the same window, from wherever this Library is. */
function activityHref(card: SkillCard, origin: string, days: UsageWindow): string {
 const base = detailHref(card, origin), extra = ['tab=activity', ...(days === 30 ? [] : [`window=${days}`])].join('&');
 return base + (base.includes('?') ? '&' : '?') + extra;
}

function read(backend: ReturnType<typeof useBackend>, days: number) {
 return async ({ signal }: { signal: AbortSignal }) => { const r = await backend.usage({ days }, { signal }); if (!r.ok) throw new Error(r.error); return r.value; };
}

/** Per day at 30 days, per week beyond: model firings solid, named ones pale, on one scale for every row. */
function Strip({ bins, max }: { bins: NonNullable<SkillRow['bins']>; max: number }) {
 const BW = 4, H = 20;
 return <svg className="activation-strip" viewBox={`0 0 ${bins.length * BW} ${H}`} preserveAspectRatio="none" aria-hidden="true">
  {bins.map((bin, k) => {
   const total = bin.d1 + bin.d2, x = k * BW;
   const when = bin.from === bin.to ? dayLabel(bin.from) : dayRangeLabel(bin.from, bin.to);
   if (total === 0) return <rect key={bin.from} className="strip-empty" x={x} y={H - 1} width={BW - 1} height={1}><title>{`${when} · no firings`}</title></rect>;
   const h = Math.max(2, (total / max) * H), model = (bin.d1 / total) * h;
   return <g key={bin.from}><title>{`${when} · ${plural(total, 'firing')} · ${bin.d1} chosen by the model · ${bin.d2} by name`}</title><rect className="strip-name" x={x} y={H - h} width={BW - 1} height={h - model} /><rect className="strip-model" x={x} y={H - model} width={BW - 1} height={model} /></g>;
  })}
 </svg>;
}

function SkillsTable({ rows, days, until, windowStart, onOpen }: { rows: SkillRow[]; days: UsageWindow; until: string; /** The window's first day; a last firing before it is dated rather than counted back. */ windowStart: string | null; onOpen: (card: SkillCard) => void }) {
 const { current } = windowPhrase(days), fired = rows.filter(r => r.total > 0), cold = rows.filter(r => r.total === 0);
 const max = Math.max(1, ...rows.flatMap(r => (r.bins ?? []).map(b => b.d1 + b.d2)));
 const hasBins = rows.some(r => r.bins !== null);
 const count = (n: number | null) => n === null ? <span className="activation-zero">—</span> : n === 0 ? <span className="activation-zero">0</span> : n;
 const last = (r: SkillRow) => r.lastFired === null ? <span className="activation-zero" title="No firing on record">—</span> : windowStart === null || r.lastFired >= windowStart ? daysAgoLabel(until, r.lastFired) : <span className="activation-muted" title={fullDayLabel(r.lastFired)}>{shortDayLabel(r.lastFired)}</span>;
 const row = (r: SkillRow) => <button key={r.card.path ?? r.card.name} type="button" role="row" className="activation-row" data-cold={r.total === 0 || undefined} aria-label={`${r.card.name}, ${plural(r.total, 'firing')}`} onClick={() => onOpen(r.card)}>
  <span role="cell" className="activation-skill"><b>{r.card.name}</b>{r.card.category ? <span>{r.card.category}</span> : null}</span>
  <span role="cell">{r.bins !== null ? <Strip bins={r.bins} max={max} /> : null}</span>
  <span role="cell" className="num">{count(r.total)}</span>
  <span role="cell" className="num">{count(r.d1)}</span>
  <span role="cell" className="num">{count(r.d2)}</span>
  <span role="cell" className="num">{count(r.misfires)}</span>
  <span role="cell" className="num">{last(r)}</span>
  <span role="cell"><VerdictChip summary={r.card.summary} muted={r.card.summary?.partial != null} /></span>
 </button>;
 return <div className="activation-table-wrap"><div className="activation-table" role="table" aria-label="Skills by firings">
  <div className="activation-row activation-head" role="row">
   <span role="columnheader">Skill</span>
   <span role="columnheader">{hasBins ? <>{days === 30 ? 'Per day' : 'Per week'}<span className="activation-key"><i className="model" />model<i className="name" />name</span></> : null}</span>
   <span role="columnheader" className="num">Firings</span><span role="columnheader" className="num">By model</span><span role="columnheader" className="num">By name</span><span role="columnheader" className="num">Misfires</span><span role="columnheader" className="num">Last fired</span><span role="columnheader">Eval</span>
  </div>
  {fired.map(row)}
  {cold.length ? <div className="activation-group" role="row"><span role="cell">Never fired in {current} · {cold.length}</span></div> : null}
  {cold.map(row)}
 </div></div>;
}

function Findings({ findings, onOpen }: { findings: Finding[]; onOpen: (name: string) => void }) {
 if (findings.length === 0) return <Small>Nothing stands out in this window.</Small>;
 return <div className="activation-findings">{findings.map(f => <div key={f.title} className="activation-finding" data-tone={f.tone}>
  <span className="activation-finding-mark" aria-hidden="true" />
  <div><div className="activation-finding-title">{f.title}</div><div className="activation-finding-body">{f.body}</div></div>
  <div className="activation-finding-skills">{f.skills.map(name => <button key={name} type="button" className="activation-chip" onClick={() => onOpen(name)}>{name}</button>)}</div>
 </div>)}</div>;
}

/**
 * The Library's Activation popup, opened from the Activation tile (`?dialog=activation`): the root's
 * fires, misfires and dead skills over the window, one row per skill, then what stands out.
 *
 * It reads the tile's own `usage` window (so every count inside the window is the tile's) and one
 * longer read behind it (`historyDays`) for the days before the window opened: the window before,
 * day for day; a full window of silence behind every day; and when a quiet skill last fired. Both are
 * whole-machine reads shared with every skill page. Misfires come only from a screening a person
 * starts here or on a skill page; nothing here spends a model call on its own.
 */
export function ActivationDialog({ skills, window: days, origin, onWindow, onClose }: { skills: readonly SkillCard[]; window: UsageWindow; /** The origin a skill page reads back (`root=…` from a project Library, '' from Global). */ origin: string; onWindow: (days: UsageWindow) => void; onClose: () => void }) {
 const backend = useBackend(), features = useFeatures(), navigate = useNavigate(), supported = features?.usage === true;
 const current = useQuery({ queryKey: ['usage', days], enabled: supported, queryFn: read(backend, days) });
 const older = useQuery({ queryKey: ['usage', historyDays(days)], enabled: supported, queryFn: read(backend, historyDays(days)) });
 const misses = useMissScreening();
 const phrase = windowPhrase(days);
 const byName = new Map(skills.map(card => [card.name, card]));
 const open = (card: SkillCard | undefined) => { if (card !== undefined) navigate(activityHref(card, origin, days)); };
 const screenButton = misses.supported ? <Button icon="sparkle" height={24} disabled={misses.busy} title="Spends about one model call per ten prompts" onClick={() => void misses.screen()}>{misses.busy ? 'Screening…' : misses.model === null ? 'Screen for misses' : 'Screen again'}</Button> : null;
 const body = () => {
  if (features === undefined || (supported && (current.isPending || older.isPending))) return <div className="activation-dialog-loading"><BoardSkeleton width="100%" height={220} /><BoardSkeleton width="100%" height={160} /></div>;
  if (!supported) return <Small>{ACTIVATION_UNSUPPORTED}</Small>;
  const failure = current.error ?? older.error;
  if (failure !== null || current.data === undefined || older.data === undefined) return <ErrorLine>{failure instanceof Error ? failure.message : 'Could not read skill firings.'}</ErrorLine>;
  const report = current.data, h = history(report, older.data);
  const rows = skillRows(h, report, skills, misses.model);
  const findings = activationFindings(rows, days, report.until);
  return <>
   <section className="activation-section" aria-label="Activation over time">
    <SectionLabel trailing={<Small>Running totals · point at a day</Small>}>Activation over time</SectionLabel>
    {h === null
     ? <Small>Per-day firings need terum-skills 0.24 or newer. Update it to see the timeline; the counts below still come from this version.</Small>
     : <ActivationTimeline timeline={scopeTimeline(h, report, skills, misses.model)} phrase={phrase} span={days === 365 ? 'year' : `${days} days`} misfires={misses.supported ? { empty: <><Small>Not screened yet. Screening spends about one model call per ten prompts, and the result serves every skill page.</Small>{screenButton}</>, action: screenButton } : null} />}
    {misses.error !== null ? <ErrorLine>{misses.error}</ErrorLine> : null}
   </section>
   <section className="activation-section" aria-label="Skills">
    <SectionLabel trailing={<Small>Select a skill to open its activity</Small>}>Skills</SectionLabel>
    <SkillsTable rows={rows} days={days} until={report.until} windowStart={h === null ? null : h.days[h.start] ?? null} onOpen={open} />
   </section>
   <section className="activation-section" aria-label="Worth a look">
    <SectionLabel trailing={findings.length ? <Small>{plural(findings.length, 'finding')}</Small> : undefined}>Worth a look</SectionLabel>
    <Findings findings={findings} onOpen={name => open(byName.get(name))} />
   </section>
   <div className="activation-caveats">{[...report.caveats, ...(misses.model?.caveats ?? [])].map(line => <Small key={line}>{line}</Small>)}</div>
  </>;
 };
 return <Dialog open onOpenChange={next => { if (!next) onClose(); }}>
  <DialogPopup data-testid="activation-dialog" style={{ width: 'min(1040px, calc(100% - 48px))', maxWidth: 'none', maxHeight: 'calc(100% - 48px)', padding: 0, gap: 0 }}>
   <div className="activation-dialog-head">
    <DialogTitle>Activation</DialogTitle>
    <Small>{phrase.current.replace(/^the l/, 'L')}</Small>
    <div className="activation-dialog-tools"><WindowPicker value={days} onChange={onWindow} /><IconButton icon="x" label="Close" onClick={onClose} /></div>
   </div>
   <div className="activation-dialog-body">{body()}</div>
  </DialogPopup>
 </Dialog>;
}

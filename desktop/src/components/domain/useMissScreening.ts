import { useContext, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { driveRun, PrintContext, PromptContext, useBackend, useFeatures } from '../../backend';
import type { Backend } from '../../backend/Backend';
import type { MissesModel } from '../../backend/types';

/**
 * Miss screening -- the question `usage` cannot answer. A 0/0 row is ambiguous: nobody needed the
 * skill, or it was needed and passed over. Screening asks a model which skills *should* have been
 * selected for prompts that really happened.
 *
 * **This deliberately never fetches on its own.** Every other read on these surfaces runs on mount;
 * this one SPENDS MODEL CALLS (about one per ten prompts), so it runs only from `screen()`, and
 * `misses.test.tsx` pins that no call is made until a button is clicked. The backend types it as
 * `Run`, not `Promise<Result>`, so it cannot be dropped into a query by accident; the query below
 * is `enabled: false` and exists only to READ the shared cache reactively, so a run started on a
 * skill page shows on the Library timeline and the other way round. One run covers the whole
 * machine, so any surface may read it.
 */
export function useMissScreening(): { supported: boolean; model: MissesModel | null; busy: boolean; error: string | null; screen: () => Promise<void> } {
 const backend = useBackend(), features = useFeatures(), supported = features?.misses === true;
 const print = useContext(PrintContext), unexpected = useContext(PromptContext);
 const client = useQueryClient();
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const model = useQuery<MissesModel>({ queryKey: ['misses'], enabled: false, staleTime: Infinity, queryFn: async () => { throw new Error('Miss screening is started from its button, never fetched.'); } }).data ?? null;
 const active = useRef<ReturnType<Backend['misses']> | null>(null);
 async function screen() {
  if (busy || active.current) return;
  setBusy(true); setError(null);
  try {
   const run = backend.misses();
   active.current = run;
   const result = await driveRun<MissesModel>(run, {}, unexpected, print);
   if (active.current !== run) return;
   active.current = null; setBusy(false);
   if (!result.ok) { setError(result.error); return; }
   // Shared, so the next surface reads it instead of paying for the same judgments again.
   client.setQueryData(['misses'], result.value);
  } catch (e) { active.current = null; setBusy(false); setError(e instanceof Error ? e.message : 'Screening failed.'); }
 }
 return { supported, model, busy, error, screen };
}

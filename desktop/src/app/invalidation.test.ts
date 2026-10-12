import { createElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import * as backendModule from '../backend';
import { createTauriBackend } from '../backend/tauri';
import { fakeBridge } from '../backend/tauri/__tests__/fake-bridge';
import type { ChangeSource } from '../backend/types';
import { Providers } from './providers';
import { affects } from './invalidation';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const keys = ['status', 'settings', 'onboarding', 'library', 'skill', 'receipts', 'inbox', 'catalog', 'roster', 'update', 'capabilities', 'features', 'surfaces', 'usage'];
const cases: [ChangeSource, string[]][] = [
  ['config', ['status', 'settings', 'onboarding', 'library', 'skill', 'catalog', 'features', 'capabilities']],
  ['clone', ['library', 'skill', 'catalog', 'roster', 'inbox', 'receipts', 'status']],
  // A fetch-only sync cannot touch local files, so 'library' is deliberately absent; it can bring in a
  // teammate's people file and receipts, so 'roster' and 'receipts' are deliberately present.
  ['marketplace', ['catalog', 'skill', 'roster', 'receipts']],
  // The `usage` row set is the placements ledger, so a placement re-reads the firings too.
  ['placed', ['library', 'skill', 'settings', 'status', 'catalog', 'usage']],
  ['stamp', ['status', 'settings', 'inbox']],
];
it.each(cases)('invalidates exactly the read-model prefixes affected by %s', (source, expected) => {
  for (const key of keys) {
    expect(affects(source, [key])).toBe(expected.includes(key));
    expect(affects(source, [key, 'acme', { ref: 'a' }])).toBe(expected.includes(key));
  }
  expect(affects(source, [])).toBe(false);
  expect(affects(source, [null])).toBe(false);
  expect(affects(source, ['status-extra'])).toBe(false);
});

it('uses the focus lifecycle policy and invalidates mapped queries after a settled run, unsubscribing on unmount', async () => {
  const f = fakeBridge((_args, emit) => {
    emit({ kind: 'stdout', line: JSON.stringify({ t: 'result', verb: 'sync', ok: true, exitCode: 0, value: { notices: [], changed: true, teams: [] } }) });
  });
  const backend = createTauriBackend(f.bridge);
  vi.spyOn(backendModule, 'pickBackend').mockReturnValue(backend);
  const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
  let client!: QueryClient;
  function Probe() { client = useQueryClient(); return null; }
  const view = render(createElement(Providers, null, createElement(Probe)));
  expect(client.getDefaultOptions().queries).toEqual({ retry: false, staleTime: 30_000, refetchOnWindowFocus: true, refetchOnReconnect: false, refetchOnMount: 'always' });
  for (const key of keys) client.setQueryData([key, 'acme'], 'cached');
  await act(async () => { await backend.sync({}).done; });
  expect(invalidate).toHaveBeenCalledTimes(2);
  for (const key of keys) expect(client.getQueryState([key, 'acme'])?.isInvalidated).toBe(['marketplace', 'stamp'].some(source => affects(source as ChangeSource, [key])));
  expect(client.getQueryData(['library', 'acme'])).toBe('cached');
  view.unmount();
  await backend.sync({}).done;
  expect(invalidate).toHaveBeenCalledTimes(2);
});

it('does not invalidate after a failed run', async () => {
  const f = fakeBridge((_args, emit) => {
    emit({ kind: 'stdout', line: JSON.stringify({ t: 'result', verb: 'sync', ok: false, exitCode: 1, error: 'Failed.' }) });
  });
  const backend = createTauriBackend(f.bridge);
  vi.spyOn(backendModule, 'pickBackend').mockReturnValue(backend);
  const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
  render(createElement(Providers));
  await act(async () => { await backend.sync({}).done; });
  expect(invalidate).not.toHaveBeenCalled();
});

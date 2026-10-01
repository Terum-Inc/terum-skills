import type { QueryKey } from '@tanstack/react-query';
import type { ChangeSource } from '../backend/types';

const prefixes: Record<ChangeSource, readonly string[]> = {
  config: ['status', 'settings', 'onboarding', 'library', 'skill', 'catalog', 'features', 'capabilities'],
  clone: ['library', 'skill', 'catalog', 'roster', 'inbox', 'receipts', 'status'],
  marketplace: ['catalog', 'skill', 'roster', 'receipts'],
  // A placement adds or removes a `usage` row (the row set IS the ledger), so the firings read goes too.
  placed: ['library', 'skill', 'settings', 'status', 'catalog', 'usage'],
  stamp: ['status', 'settings', 'inbox'],
};

export function affects(source: ChangeSource, queryKey: QueryKey): boolean {
  return typeof queryKey[0] === 'string' && prefixes[source].includes(queryKey[0]);
}

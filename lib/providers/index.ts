import { AggregatorProvider } from './aggregator';
import { MockProvider } from './mock';
import type { PFProvider } from './types';

// Single factory for provider selection. Product code calls getProvider()
// and never imports a concrete provider. Swapping PF_PROVIDER=mock →
// aggregator requires zero code changes.
//
// A FailoverProvider wrapper is deliberately NOT built in v1 — add it only
// if a second real provider is ever added.

let cached: PFProvider | null = null;
let cachedName: string | null = null;

export function getProvider(): PFProvider {
  const name = (process.env.PF_PROVIDER ?? 'mock').toLowerCase();
  if (cached && cachedName === name) return cached;

  switch (name) {
    case 'mock':
      cached = new MockProvider();
      break;
    case 'aggregator':
      cached = new AggregatorProvider();
      break;
    default:
      throw new Error(
        `Unknown PF_PROVIDER "${name}" — expected "mock" or "aggregator"`
      );
  }
  cachedName = name;
  return cached;
}

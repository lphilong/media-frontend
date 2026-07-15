import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MANAGER_PERMISSION_CODES = [
  'kpi.read',
  'kpi.readProgress',
  'kpi.manageAllocation',
  'kpi.enterActual',
  'kpi.correctActual',
  'kpi.approveAllocation',
  'revenueLedger.platformEarning.read',
] as const;

describe('Manager frontend permission contract', () => {
  it('conforms to the backend Permission catalog', () => {
    const backendCatalog = readFileSync(
      resolve(process.cwd(), '../backend/src/core/permission/permission.enum.ts'),
      'utf8',
    );

    for (const permission of MANAGER_PERMISSION_CODES) {
      expect(backendCatalog, permission).toContain(`"${permission}"`);
    }
  });
});

const requestJson = async (
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; payload: unknown }> => {
  const response = await fetch(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    status: response.status,
    payload: await response.json(),
  };
};

const readContractStatus = async (contractRecordId: string): Promise<string> => {
  const response = await fetch(`http://localhost/admin/contract-records/${contractRecordId}`);
  const payload = (await response.json()) as { data: { status: string } };
  return payload.data.status;
};

describe('wave 7 MSW Contract Registry lifecycle guards', () => {
  it('rejects invalid lifecycle transitions instead of setting statuses directly', async () => {
    await expect(readContractStatus('contract-record-active')).resolves.toBe('ACTIVE');

    const invalidPending = await requestJson(
      '/admin/contract-records/contract-record-active/mark-pending-signature',
    );
    expect(invalidPending.status).toBe(409);
    await expect(readContractStatus('contract-record-active')).resolves.toBe('ACTIVE');

    const validExpire = await requestJson('/admin/contract-records/contract-record-active/expire', {
      expiryDate: '2026-04-20',
    });
    expect(validExpire.status).toBe(200);
    await expect(readContractStatus('contract-record-active')).resolves.toBe('EXPIRED');

    const invalidTerminate = await requestJson(
      '/admin/contract-records/contract-record-active/terminate',
      {
        terminationDate: '2026-04-20',
      },
    );
    expect(invalidTerminate.status).toBe(409);
    await expect(readContractStatus('contract-record-active')).resolves.toBe('EXPIRED');
  });

  it('enforces zero-body lifecycle actions and blocks transitions from archived records', async () => {
    const bodyLeak = await requestJson('/admin/contract-records/contract-record-001/activate', {
      scope: 'global',
    });
    expect(bodyLeak.status).toBe(422);
    await expect(readContractStatus('contract-record-001')).resolves.toBe('DRAFT');

    const archivedActivate = await requestJson(
      '/admin/contract-records/contract-record-archived/activate',
    );
    expect(archivedActivate.status).toBe(409);
    await expect(readContractStatus('contract-record-archived')).resolves.toBe('ARCHIVED');

    const archivedArchive = await requestJson(
      '/admin/contract-records/contract-record-archived/archive',
    );
    expect(archivedArchive.status).toBe(409);
    await expect(readContractStatus('contract-record-archived')).resolves.toBe('ARCHIVED');
  });

  it('keeps non-lifecycle actions unavailable for archived records and preserves file-pair clearing', async () => {
    const archivedOwner = await requestJson(
      '/admin/contract-records/contract-record-archived/assign-owner',
      {
        newOwnerEmploymentProfileId: 'ep-002',
      },
    );
    expect(archivedOwner.status).toBe(409);

    const badClear = await requestJson(
      '/admin/contract-records/contract-record-001/file-reference',
      {
        newFileReferenceId: null,
        newFileDisplayName: 'contract.pdf',
      },
    );
    expect(badClear.status).toBe(422);

    const goodClear = await requestJson(
      '/admin/contract-records/contract-record-001/file-reference',
      {
        newFileReferenceId: null,
        newFileDisplayName: null,
      },
    );
    expect(goodClear.status).toBe(200);
    expect(goodClear.payload).toMatchObject({
      data: {
        fileReferenceId: null,
        fileDisplayName: null,
      },
    });
  });
});

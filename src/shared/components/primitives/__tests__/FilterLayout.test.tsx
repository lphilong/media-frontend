import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { AppliedFilterChips, FilterToolbar, MoreFiltersPanel } from '@shared/components/primitives';

describe('shared filter layout primitives', () => {
  it('renders toolbar slots, more filters panel, and applied chip actions', async () => {
    const user = userEvent.setup();
    const clearStatus = vi.fn();
    const clearAll = vi.fn();
    const closePanel = vi.fn();

    render(
      <FilterToolbar
        searchSlot={<input aria-label="Search" />}
        moreFiltersTrigger={<button type="button">More filters</button>}
        moreFiltersPanel={
          <MoreFiltersPanel
            id="test-more-filters"
            title="More filters"
            isOpen
            closeLabel="Close"
            onClose={closePanel}
          >
            <label>
              Status
              <select />
            </label>
          </MoreFiltersPanel>
        }
        appliedFilters={
          <AppliedFilterChips
            title="Applied filters"
            clearFilterLabel="Clear filter"
            clearAllLabel="Clear all"
            onClearAll={clearAll}
            items={[
              {
                id: 'status',
                label: 'Status',
                value: 'Active',
                onClear: clearStatus,
              },
              {
                id: 'createdBeforeAt',
                label: 'Created before',
                value: '1780000000000',
              },
            ]}
          />
        }
      />,
    );

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More filters' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'More filters' })).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByText('Applied filters')).toBeInTheDocument();
    expect(screen.getByText(/Created before:/)).toBeInTheDocument();
    expect(screen.getByText(/03:26 29-05-2026, giờ Việt Nam/)).toBeInTheDocument();
    expect(screen.queryByText(/1780000000000/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filter: Status' }));
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(clearStatus).toHaveBeenCalledTimes(1);
    expect(clearAll).toHaveBeenCalledTimes(1);
    expect(closePanel).toHaveBeenCalledTimes(1);
  });
});

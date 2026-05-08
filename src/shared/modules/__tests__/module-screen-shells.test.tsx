import { screen } from '@testing-library/react';

import {
  expectPageHeading,
  expectSectionText,
  renderModuleDetailShell,
  renderModuleListShell,
} from '@shared/testing';

describe('module screen shells', () => {
  it('renders list shell slots without assuming search, sort, or uniform filters', () => {
    renderModuleListShell({
      title: 'List Shell',
      mode: 'related-list',
      filterBar: <div>Filter Slot</div>,
      tableSection: <div>Table Slot</div>,
      rowActionRegion: <div>Row Actions</div>,
      pageActionRegion: <button type="button">Page Action</button>,
      pager: <div>Cursor Pager</div>,
      relatedSection: <div>Related Slot</div>,
    });

    expectPageHeading('List Shell');
    expectSectionText('Filter Slot');
    expectSectionText('Table Slot');
    expectSectionText('Row Actions');
    expectSectionText('Page Action');
    expectSectionText('Cursor Pager');
    expectSectionText('Related Slot');
    expect(screen.getByTestId('module-list-shell')).toHaveAttribute(
      'data-module-list-mode',
      'related-list',
    );
  });

  it('keeps list interaction and query controls visible while the result area is in error state', () => {
    renderModuleListShell({
      state: 'error',
      interactionSection: <div>Create Surface</div>,
      filterBar: <div>Filter Slot</div>,
      tableSection: <div>Table Slot</div>,
      errorState: <div>List Error</div>,
    });

    expectSectionText('Create Surface');
    expectSectionText('Filter Slot');
    expectSectionText('List Error');
    expect(screen.queryByText('Table Slot')).not.toBeInTheDocument();
  });

  it('renders detail shell with status, read-only and locked notices, and action rail slots', () => {
    renderModuleDetailShell({
      title: 'Detail Shell',
      statusBadge: <span>ACTIVE</span>,
      readOnlyNotice: <div>Read-only Notice</div>,
      lockedNotice: <div>Locked Notice</div>,
      summarySection: <div>Summary Slot</div>,
      metadataSection: <div>Metadata Slot</div>,
      sections: <div>Section Slot</div>,
      relatedSection: <div>Related Slot</div>,
      actionRail: <div>Action Rail Slot</div>,
    });

    expectPageHeading('Detail Shell');
    expectSectionText('ACTIVE');
    expectSectionText('Read-only Notice');
    expectSectionText('Locked Notice');
    expectSectionText('Summary Slot');
    expectSectionText('Metadata Slot');
    expectSectionText('Section Slot');
    expectSectionText('Related Slot');
    expectSectionText('Action Rail Slot');
  });
});

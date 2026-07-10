import type { ReferenceOption } from '@shared/components/reference/AsyncReferencePicker';
import {
  fetchReferenceLookupOptions,
  type ReferenceLookupItem,
} from '@shared/components/reference/reference-lookup.api';
import { fetchEvents } from '@modules/event-assignment/api/event-assignment.api';

const OPTION_LIMIT = 20;

const toEventOption = (item: ReferenceLookupItem): ReferenceOption => ({
  id: item.id,
  label: item.label,
  description: item.secondaryLabel,
  secondaryLabel: item.secondaryLabel,
  code: item.code,
  type: item.type,
  status: item.status,
  state: item.state,
  href: `/events/${item.id}`,
});

export const loadEventReferenceOptions = async (search: string): Promise<ReferenceOption[]> => {
  const items = await fetchReferenceLookupOptions('events', {
    search: search || undefined,
    limit: OPTION_LIMIT,
  });

  return items.map(toEventOption);
};

export const loadCompletedEventReferenceOptions = async (
  search: string,
): Promise<ReferenceOption[]> => {
  const response = await fetchEvents({
    status: 'COMPLETED',
    search: search.trim() || undefined,
    limit: 25,
    sortBy: 'eventCode',
    sortDirection: 'desc',
  });

  return response.data.map((event) => ({
    id: event.id,
    label: `${event.eventCode} - ${event.title}`,
    description: event.status,
  }));
};

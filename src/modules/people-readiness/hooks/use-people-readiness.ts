import { useQuery } from '@tanstack/react-query';

import {
  fetchPeopleReadinessIssues,
  fetchPeopleReadinessSummary,
  type PeopleReadinessIssuesQuery,
} from '@modules/people-readiness/api/people-readiness.api';

const PEOPLE_READINESS_QUERY_ROOT = ['people-readiness'] as const;

const toIssueQueryToken = (query: PeopleReadinessIssuesQuery): string =>
  new URLSearchParams(
    Object.entries(query)
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();

export const peopleReadinessQueryKeys = {
  all: (): readonly ['people-readiness'] => PEOPLE_READINESS_QUERY_ROOT,
  summary: () => ['people-readiness', 'summary'] as const,
  issues: (query: PeopleReadinessIssuesQuery) =>
    ['people-readiness', 'issues', toIssueQueryToken(query)] as const,
};

export const usePeopleReadinessSummary = () =>
  useQuery({
    queryKey: peopleReadinessQueryKeys.summary(),
    queryFn: fetchPeopleReadinessSummary,
  });

export const usePeopleReadinessIssues = (query: PeopleReadinessIssuesQuery) =>
  useQuery({
    queryKey: peopleReadinessQueryKeys.issues(query),
    queryFn: () => fetchPeopleReadinessIssues(query),
  });

'use client';

import { useQuery } from '@tanstack/react-query';
import { onboardingApi, type OnboardingState } from '../lib/api-client';

/** Server-owned onboarding checklist — progress survives refresh. */
export function useOnboarding() {
  return useQuery<OnboardingState>({
    queryKey: ['onboarding'],
    queryFn: () => onboardingApi.get(),
    staleTime: 30_000,
    retry: 1,
  });
}

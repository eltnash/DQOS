export interface PillarStepState {
  key: 'context' | 'auction_type' | 'location' | 'behavior' | 'confirmation' | 'invalidation';
  label: string;
  valid: boolean;
  value?: string | null;
}

export interface ReadinessChangeEvent {
  readinessPct: number;
  pillarsQualified: boolean;
  completedSteps: number;
}

export const READINESS_STEP_COUNT = 6;

export function readinessPctFromCompleted(validSteps: number): number {
  return Math.round((validSteps / READINESS_STEP_COUNT) * 100);
}

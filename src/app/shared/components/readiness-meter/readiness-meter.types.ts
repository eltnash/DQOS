export interface PillarStepState {
  key: 'location' | 'behavior' | 'confirmation' | 'invalidation';
  label: string;
  valid: boolean;
  value?: string | null;
}

export interface ReadinessChangeEvent {
  readinessPct: number;
  pillarsQualified: boolean;
  completedSteps: number;
}

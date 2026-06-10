export type GatekeeperStepTabDensity = 'compact' | 'comfortable';

export interface GatekeeperStepTabItem {
  number: number;
  label: string;
  complete: boolean;
  current: boolean;
  locked?: boolean;
}

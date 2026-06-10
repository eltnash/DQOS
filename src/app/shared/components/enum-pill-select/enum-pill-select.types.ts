export interface PillOption<T extends string = string> {
  label: string;
  value: T;
  hint?: string;
}

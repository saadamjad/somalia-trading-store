export type FilterType = "select" | "multiselect" | "range" | "checkbox";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  /**
   * Key into the `shop.filters.labels` message namespace used to render a
   * translated version of `label` in the UI. `label` itself stays the
   * literal English fallback / value used where matching logic needs it.
   */
  labelKey: string;
  type: FilterType;
  options?: FilterOption[];
  specKey?: string;
}

export type ActiveFilters = Record<string, string | string[] | [number, number]>;

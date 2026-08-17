export type FilterType = "select" | "multiselect" | "range" | "checkbox";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  specKey?: string;
}

export type ActiveFilters = Record<string, string | string[] | [number, number]>;

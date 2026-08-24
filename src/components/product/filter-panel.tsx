"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActiveFilters } from "@/lib/types/filter";
import type { FilterDefinition } from "@/lib/types/filter";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  filterDefs: FilterDefinition[];
  filters: ActiveFilters;
  priceRange: [number, number];
  activeFilterCount: number;
  onToggleFilter: (key: string, value: string) => void;
  onSetPriceFilter: (min: number, max: number) => void;
  onClearFilters: () => void;
  className?: string;
}

export function FilterPanel({
  filterDefs,
  filters,
  priceRange,
  activeFilterCount,
  onToggleFilter,
  onSetPriceFilter,
  onClearFilters,
  className,
}: FilterPanelProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            onClick={onClearFilters}
            className="text-sm text-accent-text hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {filterDefs.map((filter) => (
        <div key={filter.key}>
          <h4 className="mb-3 text-sm font-semibold">{filter.label}</h4>
          {filter.type === "checkbox" && filter.options && (
            <div className="space-y-2">
              {filter.options.map((opt) => {
                const selected = (
                  (filters[filter.key] as string[]) || []
                ).includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleFilter(filter.key, opt.value)}
                      className="h-4 w-4 rounded border-border accent-accent"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          )}
          {filter.type === "range" && (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                ${priceRange[0]} – ${priceRange[1]}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSetPriceFilter(priceRange[0], priceRange[1])}
              >
                Apply full range
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ActiveFilterPills({
  filters,
  onToggleFilter,
}: {
  filters: ActiveFilters;
  onToggleFilter: (key: string, value: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {Object.entries(filters).map(([key, value]) => {
        if (!value || !Array.isArray(value)) return null;
        const values = value as string[];
        return values.map((v) => (
          <button
            key={`${key}-${v}`}
            onClick={() => onToggleFilter(key, v)}
            className="inline-flex items-center gap-1 bg-accent-muted px-3 py-1 text-xs font-medium text-accent-text"
          >
            {v}
            <X className="h-3 w-3" />
          </button>
        ));
      })}
    </div>
  );
}

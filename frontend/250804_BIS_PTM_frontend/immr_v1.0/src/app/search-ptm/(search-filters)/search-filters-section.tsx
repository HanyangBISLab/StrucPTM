"use client";

import { Suspense } from "react";
import { Collapse, Spin } from "antd";
import SearchFiltersForm from "./search-filters-form";
import { SearchFilters } from "../(search-results)/search-results-types";

interface SearchFiltersSectionProps {
  onFiltersChange: (filters: SearchFilters) => void;
}

export default function SearchFiltersSection({ onFiltersChange }: SearchFiltersSectionProps) {
  const items = [
    {
      key: "searchFilters",
      label: <h2>Search Filters</h2>,
      children: (
        <Suspense fallback={<div className="py-4 text-center"><Spin /></div>}>
          <SearchFiltersForm onFiltersChange={onFiltersChange} />
        </Suspense>
      ),
    },
  ];

  return (
    <section>
      <Collapse
        defaultActiveKey="searchFilters"
        bordered={false}
        expandIconPosition="end"
        items={items}
      />
    </section>
  );
}

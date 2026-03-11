"use client";

import { Suspense, useState } from "react";
import SectionContainer from "@/components/section-container";
import SearchFiltersSection from "./(search-filters)/search-filters-section";
import SearchResultsTable from "./(search-results)/search-results-table";
import { SearchFilters } from "./(search-results)/search-results-types";
import VisualizationSection from "./(search-comparison-visualization)/visualization-section";


export default function SearchPTMPage() {
  const [filters, setFilters] = useState<SearchFilters | undefined>();

  const handleFiltersChange = (filters: SearchFilters) => {
    console.log("Filters changed:", filters);
    setFilters(filters);
  };

  return (
    <div className="space-y-6 p-4">
      <SearchFiltersSection onFiltersChange={handleFiltersChange} />
      <SectionContainer title="Search Results" className="pb-2">
        <Suspense>
          <SearchResultsTable filters={filters} />
        </Suspense>
        <Suspense>
          <VisualizationSection />
        </Suspense>
      </SectionContainer>
    </div>
  );
}
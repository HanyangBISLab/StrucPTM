# PTM Search Documentation

## Overview
The PTM search page allows users to visually explore and filter through a database containing PTMs (Post-Translational Modifications). Users can filter data using 6 different criteria, compare protein structures side-by-side, and analyze structural similarities.



## File Structure

src/app/search-ptm/
├── page.tsx                           # Main layout, state management, component coordination
├── README.md                          # This documentation
├── (search-filters)/                  # User input components
│   ├── search-filters-form.tsx        # 6 filter inputs with real-time validation
│   └── search-filters-section.tsx     # Collapsible wrapper around form
├── (search-results)/                  # Data display and processing
│   ├── search-results-table.tsx       # Main table component (orchestrator)
│   ├── search-results-api.tsx         # Backend API communication
│   ├── search-results-filters.tsx     # Client-side filtering logic
│   ├── search-results-config.tsx      # Table columns, colors, UI settings
│   └── search-results-types.tsx       # TypeScript interfaces
└── (search-comparison-visualization)/ # PDB structure comparison
    ├── visualization-section.tsx      # Main comparison orchestrator
    ├── visualization-table.tsx        # Side-by-side PTM data tables
    ├── visualization-comparison.tsx   # Similarity analysis results
    └── visualization-3d.tsx           # 3D structure viewers (placeholder)


## Updating form options

Form options, labels, tooltips, and placeholders can be modified in the search-filters-form.tsx file.

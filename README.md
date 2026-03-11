# StrucPTM: A Database of Structurally Validated Protein Modifications
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18939125.svg)](https://doi.org/10.5281/zenodo.18939125)

**StrucPTM** is a comprehensive structural database that systematically extracts and contextualizes post-translational modification (PTM) sites within experimentally determined protein structures. By directly validating PTMs from PDB mmCIF files using atom-level composition rules and comparing homologous structures, StrucPTM provides a critical foundation for analyzing PTM-induced conformational variations.

🌐 **Web Server:** [https://prix.hanyang.ac.kr/strucptm](https://prix.hanyang.ac.kr/strucptm)

## 📌 Key Features
* **Structure-based PTM Validation:** Extracts PTMs directly from PDB structures via atom-level composition rules.
* **Structural Context Annotation:** Provides key structural descriptors for each modified residue, including secondary structure (DSSP), relative solvent accessibility (RSA), and inter-chain interface proximity.
* **Homolog-aware Conformational Comparison:** Groups structural homologs sharing the same UniProt ID (Sequence Identity ≥ 0.8) to investigate PTM-induced conformational deviations.
* **Interactive 3D Visualization:** Seamlessly compare modified and unmodified structures with synchronized camera controls powered by 3Dmol.js.

## 🛠️ Technology Stack
* **Frontend:** Next.js (App Router), React, Tailwind CSS, 3Dmol.js, Ant Design
* **Backend:** Python, FastAPI, MySQL
* **Structural Processing (Data Pipeline):** Biopython, SIFTS, TM-align, DSSP

## 📂 Repository Structure
This repository contains the source code for the StrucPTM web interface and API server.

```text
StrucPTM/
├── backend/
│   └── mysql.py                    # Database connection and query routing
├── frontend/
│   └── 250804_BIS_PTM_frontend/
│       ├── immr_v1.0/              # Next.js web application
│       │   ├── public/             # Static assets, raw data, and USE viewer html
│       │   ├── src/app/            # Next.js App Router (Search, Docs, UI Layouts)
│       │   ├── src/components/     # Reusable React components (Spectrum/3D Viewers)
│       │   ├── src/lib/            # API endpoints and utility functions
│       │   └── src/styles/         # Global styles and Tailwind configs
│       └── main.py                 # FastAPI backend entry point
├── LICENSE
└── README.md

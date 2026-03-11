# StrucPTM: A Database of Structurally Validated Protein Modifications
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18939125.svg)](https://doi.org/10.5281/zenodo.18939125)

**StrucPTM** is a comprehensive structural database that systematically extracts and contextualizes post-translational modification (PTM) sites within experimentally determined protein structures. By directly validating PTMs from PDB mmCIF files using atom-level composition rules and comparing homologous structures, StrucPTM provides a foundation for analyzing PTM-induced conformational variations.

🌐 **Web Server:** [https://prix.hanyang.ac.kr/strucptm](https://prix.hanyang.ac.kr/strucptm)

## 📌 Key Features
* **Structure-based PTM Validation:** Identifies PTMs directly from PDB structures using rigorous atom-level composition rules, overcoming the limitations of incomplete annotations.
* **Structural Context Annotation:** Provides key descriptors including secondary structure (DSSP), relative solvent accessibility (RSA), and inter-chain interface proximity.
* **Homolog-aware Conformational Comparison:** Groups homologous chains mapped to the same UniProt ID (Sequence Identity ≥ 0.8) and provides structural divergence metrics (TM-score, RMSD) calculated via TM-align.
* **Interactive 3D Visualization:** Seamlessly compares wild-type and modified structures in synchronized 3D viewers (powered by 3Dmol.js).

## 🛠️ Technology Stack
* **Frontend:** Next.js, React, Tailwind CSS, 3Dmol.js
* **Backend:** Python, FastAPI, MySQL
* **Pipeline/Data Processing:** Biopython, SIFTS, TM-align, DSSP

## 📂 Repository Structure
```text
StrucPTM/
├── frontend/               # Next.js web application source code
├── backend/                # FastAPI server and API endpoints
├── pipeline/               # Python scripts for data generation
│   ├── 01_pdb_parsing/     # mmCIF parsing & atom-level PTM validation
│   ├── 02_uniprot_map/     # SIFTS mapping to UniProt
│   └── 03_structural_cmp/  # Homolog grouping & TM-align calculation
└── README.md

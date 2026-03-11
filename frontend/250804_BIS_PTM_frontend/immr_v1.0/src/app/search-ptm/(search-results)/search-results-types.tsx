// src/app/search-ptm/(search-results)/search-results-types.ts

// For Backend Database → 프론트에서 사용하는 레코드 타입
export interface PTMRecord {
  id: string;
  pdb_id_chain: string; // 예: "132L:A"

  // 표에 보이는 기본 정보
  residue_name: string; // Residue (canonical name)
  annotation: string; // PTM type (annotation)
  pdb_pos: number; // PDB residue number

  organism: string;
  uniprot_accession: string;
  related_pdb_chains?: string; // Related PDB chains (SIFTS)

  // 기존 키도 유지
  pdb_restype?: string;

  // ★ 새로 추가된 컬럼들
  assembly_type?: string; // Monomer / Multimer
  location?: string; // Interface / Non-interface
  secondary_structure?: string; // H, E, C ...
  rsa?: number; // Relative solvent accessibility (0~1)
}

// For Frontend User Input (Search filters)
export interface SearchFilters {
  pdb_id_chain?: string;
  residue_name?: string; // Residue 이름
  annotation?: string; // PTM type
  uniprot_accession?: string;
  organism?: string;

  // ★ 새 필터들
  assembly_type?: string;
  location?: string;
  secondary_structure?: string;
  rsa_min?: number | string;
  rsa_max?: number | string;
}

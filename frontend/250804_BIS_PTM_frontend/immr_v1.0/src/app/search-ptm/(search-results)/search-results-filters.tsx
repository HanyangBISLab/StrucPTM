// src/app/search-ptm/(search-results)/search-results-filters.ts
import { PTMRecord, SearchFilters } from "./search-results-types";

/** 공백/Null 안전 문자열 normalize */
const norm = (s?: string) => (s ?? "").trim();
/** 대소문자 무시 비교용 */
const up = (s?: string) => norm(s).toUpperCase();
/** 값이 "비어있지 않음" 판단 */
const isNonEmpty = (v: unknown) =>
  v !== undefined &&
  v !== null &&
  String(v).trim() !== "";

/**
 * "PDB[:CHAIN]" 형태를 파싱.
 * - 입력이 없으면 null 반환
 * - 체인 없으면 chain은 빈 문자열("")
 */
function parsePdbChain(
  s?: string
): { pdb: string; chain: string } | null {
  const t = up(s);
  if (!t) return null;
  const [pdb, chain = ""] = t.split(":");
  if (!/^[0-9A-Z]{4}$/.test(pdb)) return null;
  if (chain && !/^[0-9A-Z]{1,2}$/.test(chain)) return null;
  return { pdb, chain };
}

/**
 * PDB/체인 매칭 규칙:
 * - 쿼리가 "132L" : item이 "132L" 또는 "132L:?" 모두 매칭
 * - 쿼리가 "132L:A": item이 정확히 같은 PDB이고 체인도 "A"일 때만 매칭
 * - 단, item.chain 이 비어있으면 PDB만 비교(완화)
 */
function matchesPdbChain(
  itemPdbIdChain: string,
  query: string
): boolean {
  const item = parsePdbChain(itemPdbIdChain);
  const q = parsePdbChain(query);
  if (!q) return true; // 쿼리 비어있으면 통과
  if (!item) return false;

  // 체인 없이 PDB만 지정된 경우
  if (q.chain === "") {
    return item.pdb === q.pdb;
  }
  // item에 체인 정보가 없다면 PDB만 비교
  if (!item.chain) {
    return item.pdb === q.pdb;
  }
  return item.pdb === q.pdb && item.chain === q.chain;
}

/** 사용자가 실제로 필터를 지정했는지 */
export const hasActiveFilters = (
  filters?: SearchFilters
): boolean => {
  return !!(
    filters &&
    Object.values(filters).some(isNonEmpty)
  );
};

/**
 * 클라이언트 사이드 필터링
 * - 🔧 활성 필터가 없으면 기본값 주입(132L) 없이 빈 결과 반환
 */
export const applyFiltersToData = (
  allData: PTMRecord[],
  filters?: SearchFilters
): PTMRecord[] => {
  const active = hasActiveFilters(filters);
  // 초기 진입(검색 전)에는 아무 것도 보여주지 않음
  if (!active) return [];

  const eff: SearchFilters = filters as SearchFilters;

  // ★ RSA range 파싱 (number | string 모두 지원)
  const rsaMin =
    eff.rsa_min !== undefined &&
    eff.rsa_min !== null &&
    String(eff.rsa_min).trim() !== ""
      ? Number(eff.rsa_min)
      : undefined;
  const rsaMax =
    eff.rsa_max !== undefined &&
    eff.rsa_max !== null &&
    String(eff.rsa_max).trim() !== ""
      ? Number(eff.rsa_max)
      : undefined;

  return allData.filter((item) => {
    // pdb_id_chain
    if (isNonEmpty(eff.pdb_id_chain)) {
      if (
        !matchesPdbChain(
          item.pdb_id_chain,
          String(eff.pdb_id_chain)
        )
      ) {
        return false;
      }
    }

    // residue_name (부분일치, 대소문자 무시)
    if (isNonEmpty(eff.residue_name)) {
      const ok = up(item.residue_name).includes(
        up(String(eff.residue_name))
      );
      if (!ok) return false;
    }

    // annotation / ptm_type (부분일치)
    if (isNonEmpty((eff as any).annotation)) {
      const ok = up(item.annotation).includes(
        up(String((eff as any).annotation))
      );
      if (!ok) return false;
    }

    // uniprot_accession (부분일치)
    if (isNonEmpty(eff.uniprot_accession)) {
      const ok = up(item.uniprot_accession).includes(
        up(String(eff.uniprot_accession))
      );
      if (!ok) return false;
    }

    // organism (부분일치)
    if (isNonEmpty(eff.organism)) {
      const ok = up(item.organism).includes(
        up(String(eff.organism))
      );
      if (!ok) return false;
    }

    // ★ Assembly type (부분일치)
    if (isNonEmpty(eff.assembly_type)) {
      const ok = up(item.assembly_type).includes(
        up(String(eff.assembly_type))
      );
      if (!ok) return false;
    }

    // ★ Location (부분일치)
    if (isNonEmpty(eff.location)) {
      const ok = up(item.location).includes(
        up(String(eff.location))
      );
      if (!ok) return false;
    }

    // ★ Secondary structure (정확히 한 글자 비교)
    if (isNonEmpty(eff.secondary_structure)) {
      if (
        up(item.secondary_structure || "") !==
        up(String(eff.secondary_structure))
      ) {
        return false;
      }
    }

    // ★ RSA 범위
    if (rsaMin !== undefined || rsaMax !== undefined) {
      const rsaValRaw =
        typeof item.rsa === "number"
          ? item.rsa
          : item.rsa !== undefined
          ? Number(item.rsa)
          : NaN;
      if (Number.isNaN(rsaValRaw)) return false;
      if (rsaMin !== undefined && rsaValRaw < rsaMin)
        return false;
      if (rsaMax !== undefined && rsaValRaw > rsaMax)
        return false;
    }

    return true;
  });
};

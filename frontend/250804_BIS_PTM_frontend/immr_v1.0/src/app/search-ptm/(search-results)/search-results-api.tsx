// src/app/search-ptm/(search-results)/search-results-api.tsx
import { PTMRecord, SearchFilters } from "./search-results-types";

/**
 * API URL 설정
 *
 * - 프로덕션(브라우저): 같은 오리진의 /api/search_ptm_data
 *   (예: https://prix.hanyang.ac.kr/api/search_ptm_data)
 *
 * - 서버/로컬 개발(SSR, node 실행 시):
 *   gateway(4000)의 /api/search_ptm_data 로 호출
 */
const API_BASE =
  typeof window !== "undefined"
    ? "" // 브라우저에서는 같은 오리진 사용
    : "http://127.0.0.1:4000"; // SSR/빌드 시 로컬 gateway

const API_URL = `${API_BASE}/api/search_ptm_data`;

const norm = (s?: string) => (s ?? "").trim();
const up = (s?: string) => norm(s).toUpperCase();

export async function loadPTMData(
  filters?: SearchFilters
): Promise<PTMRecord[]> {
  // 🔹 필터가 비어 있으면 요청 안 보냄
  const hasAnyFilter =
    !!filters &&
    Object.values(filters).some((v) => norm(String(v ?? "")) !== "");

  if (!hasAnyFilter) {
    return [];
  }

  // 전달된 필터만 사용
  const effective: SearchFilters = { ...filters };

  if (effective.pdb_id_chain) {
    effective.pdb_id_chain = up(effective.pdb_id_chain);
  }

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(effective),
    });
  } catch (e: any) {
    console.error("[search_ptm_data] network error:", e);
    throw new Error(`network-error`);
  }

  if (!res.ok) {
    console.error("[search_ptm_data] HTTP error:", res.status, res.statusText);
    throw new Error(`http-${res.status}`);
  }

  let data: any;
  try {
    // 💡 [수정] 바로 JSON으로 변환하지 않고, 텍스트로 먼저 받아서 쓰레기 문자를 강제로 청소합니다!
    const rawText = await res.text();
    
    // 백엔드의 좀비 프로세스가 뱉어내는 이스케이프 문자 '\\n'을 찾아내 완전히 삭제
    const cleanedText = rawText.replace(/\\n/g, ""); 
    
    // 깨끗해진 텍스트를 비로소 JSON으로 안전하게 파싱
    data = JSON.parse(cleanedText);
  } catch (e) {
    console.error("[search_ptm_data] invalid JSON:", e);
    throw new Error("invalid-json");
  }

  console.debug("[search_ptm_data] request:", effective);
  console.debug("[search_ptm_data] response:", data);

  if (data?.status && data.status !== "success") {
    throw new Error(data?.error || data?.details || "backend-error");
  }

  const results = Array.isArray(data?.results) ? data.results : data ?? [];

  return results.map((item: any, i: number) => {
    const pdb_id: string = item.pdb_id || item.PDB_ID || "";
    const chain_id: string =
      item.chain_id || item.chain || item.chain_ID || "";
    const pdb_id_chain: string =
      item.pdb_id_chain || (pdb_id ? `${pdb_id}:${chain_id}` : "");
    const residue_no = item.pdb_pos ?? item.residue_no;
    const rsaRaw = item.rsa ?? item.RSA;

    return {
      id: item.id || `${pdb_id_chain}_${residue_no ?? ""}_${i}`,
      pdb_id_chain,
      residue_name:
        item.residue_name ||
        item.base_residue_name ||
        item.Residue_name ||
        "",
      annotation: item.annotation || item.ptm_type || item.PTM_type || "",
      pdb_pos: Number.isFinite(residue_no) ? Number(residue_no) : 0,
      organism: item.organism || item.Organism || "",
      uniprot_accession:
        item.uniprot_accession ||
        item.uniprot_acc ||
        item.UniProt_Accession_code ||
        "",
      related_pdb_chains:
        item.related_pdb_chains ||
        item.related_pdb_chains_from_SIFTS ||
        "",
      pdb_restype:
        item.pdb_restype ||
        item.res3 ||
        item["3_letter_residue_code"] ||
        "",
      // 새 컬럼들
      assembly_type:
        item.assembly_type ||
        item.Assembly_type ||
        item.assemblyType ||
        "",
      location: item.location || item.Location || "",
      secondary_structure:
        item.secondary_structure ||
        item.Secondary_structure ||
        item.sec_struct ||
        "",
      rsa:
        rsaRaw === null || rsaRaw === undefined || rsaRaw === ""
          ? undefined
          : Number(rsaRaw),
    } as PTMRecord;
  });
}

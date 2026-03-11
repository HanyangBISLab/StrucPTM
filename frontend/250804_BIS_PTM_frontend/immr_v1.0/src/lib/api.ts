// src/lib/api.ts

/**
 * API URL helper.
 *
 * - "http://..." / "https://..."  -> 그대로 반환
 * - "/api/..."                    -> 그대로 반환
 * - "/something"                  -> 그대로 반환 (현재 origin 기준 상대 경로)
 * - "something"                   -> "/api/something" 으로 변환
 *
 * 결국 최종 fetch URL 은 항상 현재 origin(https://prix.hanyang.ac.kr)을 기준으로 동작.
 */
export function apiUrl(path: string): string {
  if (!path) return "/api";

  // 절대 URL이면 그대로
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  // 이미 /api/ 로 시작하면 그대로
  if (path.startsWith("/api/")) {
    return path;
  }

  // 그냥 /로 시작하는 경우도 그대로 사용
  if (path.startsWith("/")) {
    return path;
  }

  // 나머지는 /api/ prefix
  return "/api/" + path.replace(/^\/+/, "");
}

/**
 * 3D viewer iframe URL
 *
 * - 브라우저:  https://<현재 origin>/api/viewer-3dmol?pdb=<pdb>
 * - SSR:      /api/viewer-3dmol?pdb=<pdb>
 *
 * Spring 의 /api/** 프록시가 알아서 FastAPI(8000) 의 /viewer-3dmol 로 전달.
 */
export function viewerUrlFor(pdb: string): string {
  const clean = (pdb ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const encoded = encodeURIComponent(clean || "dummy");

  if (typeof window !== "undefined") {
    const { origin } = window.location; // 예: https://prix.hanyang.ac.kr
    return `${origin}/api/viewer-3dmol?pdb=${encoded}`;
  }

  // SSR/빌드 단계에서는 상대 경로만
  return `/api/viewer-3dmol?pdb=${encoded}`;
}

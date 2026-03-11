# ==========================
# main.py — Frontend Gateway → Upstream (mysql.py @ :8000)
# ==========================

import os
from fastapi import FastAPI, Request, HTTPException, Body
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# =========================
# Settings
# =========================
PTM_API_BASE = os.getenv("PTM_API_BASE", "http://127.0.0.1:8000").rstrip("/")
# 🚀 대용량을 넉넉하게 기다려주기 위해 120초로 설정
REQ_TIMEOUT = int(os.getenv("PTM_TIMEOUT", "120"))
POOL_MAX = int(os.getenv("PTM_POOL_MAX", "50"))
RETRY_TOTAL = int(os.getenv("PTM_RETRY_TOTAL", "3"))

app = FastAPI(title="BIS PTM Front Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_session: Optional[requests.Session] = None

def get_session() -> requests.Session:
    global _session
    if _session is not None:
        return _session
    s = requests.Session()
    retry = Retry(
        total=RETRY_TOTAL,
        connect=RETRY_TOTAL,
        read=RETRY_TOTAL,
        backoff_factor=0.3,
        status_forcelist=(500, 502, 503, 504),
        allowed_methods=frozenset(["GET", "HEAD", "OPTIONS"]),
    )
    adapter = HTTPAdapter(
        max_retries=retry, pool_connections=POOL_MAX, pool_maxsize=POOL_MAX
    )
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    s.headers.update(
        {
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "User-Agent": "bis-ptm-gateway/1.0",
        }
    )
    _session = s
    return s


def normalize_tm_score(data: Dict[str, Any]) -> Dict[str, Any]:
    tm_candidates = ["tm_score", "tm_score_overall", "tmScore", "score"]
    tm_val = None
    for k in tm_candidates:
        if k in data:
            tm_val = data.get(k)
            break
    try:
        tm_val = float(tm_val) if tm_val is not None else 0.0
    except Exception:
        tm_val = 0.0

    out = {
        "pdb1": data.get("pdb1"),
        "pdb2": data.get("pdb2"),
        "chain1": data.get("chain1", ""),
        "chain2": data.get("chain2", ""),
        "tm_score": tm_val,
        "tm_score_overall": tm_val,
        "note": data.get("note", ""),
    }
    return out


# 🚀 핵심 수정 구역: r.json() 파싱을 없애고 r.content 원본을 그대로 고속 패스합니다.
def proxy_get_json(path: str, params: Dict[str, Any]) -> Response:
    url = f"{PTM_API_BASE}{path}"
    s = get_session()
    try:
        r = s.get(url, params=params, timeout=REQ_TIMEOUT)
        return Response(content=r.content, status_code=r.status_code, media_type="application/json")
    except requests.exceptions.RequestException as e:
        return JSONResponse(status_code=504, content={"error": f"Gateway Timeout or Error: {str(e)}"})


def proxy_post_json(path: str, json_body: Dict[str, Any]) -> Response:
    url = f"{PTM_API_BASE}{path}"
    s = get_session()
    try:
        r = s.post(url, json=json_body, timeout=REQ_TIMEOUT)
        # 받은 거대한 바이트 데이터를 뜯어보지 않고 곧바로 넘김 (초고속)
        return Response(content=r.content, status_code=r.status_code, media_type="application/json")
    except requests.exceptions.RequestException as e:
        return JSONResponse(status_code=504, content={"error": f"Gateway Timeout or Error: {str(e)}"})


@app.get("/api/healthz")
@app.get("/healthz")
def healthz():
    return {"ok": True, "upstream": PTM_API_BASE}


@app.get("/api/tm_score")
def api_tm_score(
    pdb1: str, pdb2: str, chain: Optional[str] = None, chain1: Optional[str] = None, chain2: Optional[str] = None,
):
    params = {"pdb1": pdb1, "pdb2": pdb2}
    if chain: params["chain"] = chain
    if chain1: params["chain1"] = chain1
    if chain2: params["chain2"] = chain2

    url = f"{PTM_API_BASE}/tm_score"
    s = get_session()
    r = s.get(url, params=params, timeout=REQ_TIMEOUT)
    if r.status_code != 200:
        return Response(content=r.content, status_code=r.status_code, media_type="application/json")

    try: 
        upstream = r.json() # TM-score는 용량이 작아서 json 파싱해도 무방
        return JSONResponse(normalize_tm_score(upstream))
    except Exception: 
        raise HTTPException(status_code=502, detail="Invalid JSON from upstream")


@app.get("/api/align_sequences")
@app.get("/api/align")
def api_align_sequences(
    request: Request, pdb1: Optional[str] = None, pdb2: Optional[str] = None, seq1: Optional[str] = None, seq2: Optional[str] = None, chain: Optional[str] = None, chain1: Optional[str] = None, chain2: Optional[str] = None,
):
    params: Dict[str, Any] = {}
    if pdb1: params["pdb1"] = pdb1
    if pdb2: params["pdb2"] = pdb2
    if seq1: params["seq1"] = seq1
    if seq2: params["seq2"] = seq2
    if chain: params["chain"] = chain
    if chain1: params["chain1"] = chain1
    if chain2: params["chain2"] = chain2
    return proxy_get_json("/align_sequences", params)


@app.post("/api/search_ptm_data")
def api_search_ptm_data(body: Dict[str, Any] = Body(...)):
    return proxy_post_json("/search_ptm_data", body)


@app.get("/api/stats_overview")
def api_stats_overview():
    return proxy_get_json("/stats_overview", {})


@app.get("/api/cif/{pdb_id}")
def api_get_cif(pdb_id: str, chain: Optional[str] = None):
    params = {"chain": chain} if chain else {}
    url = f"{PTM_API_BASE}/cif/{pdb_id}"
    s = get_session()
    r = s.get(url, params=params, timeout=REQ_TIMEOUT, stream=True)
    if r.status_code != 200:
        return Response(content=r.content, status_code=r.status_code, media_type="application/json")

    headers = {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": r.headers.get("Content-Disposition", f'inline; filename="{pdb_id}.cif"'),
    }
    return StreamingResponse(r.iter_content(chunk_size=8192), headers=headers)


@app.get("/api/viewer-3dmol")
def api_viewer_3dmol(pdb: str, chain: Optional[str] = None):
    params = {"pdb": pdb}
    if chain: params["chain"] = chain
    url = f"{PTM_API_BASE}/viewer-3dmol"
    s = get_session()
    r = s.get(url, params=params, timeout=REQ_TIMEOUT)
    if r.status_code != 200: return Response(status_code=r.status_code, content=r.text)
    return Response(content=r.text, media_type="text/html; charset=utf-8")


@app.post("/search_ptm_data")
def api_search_ptm_data_alias(body: Dict[str, Any] = Body(...)):
    return proxy_post_json("/search_ptm_data", body)

@app.get("/tm_score")
def api_tm_score_alias(pdb1: str, pdb2: str, chain: Optional[str] = None, chain1: Optional[str] = None, chain2: Optional[str] = None):
    return api_tm_score(pdb1=pdb1, pdb2=pdb2, chain=chain, chain1=chain1, chain2=chain2)

@app.get("/align_sequences")
@app.get("/align")
def api_align_sequences_alias(request: Request, pdb1: Optional[str] = None, pdb2: Optional[str] = None, seq1: Optional[str] = None, seq2: Optional[str] = None, chain: Optional[str] = None, chain1: Optional[str] = None, chain2: Optional[str] = None):
    return api_align_sequences(request=request, pdb1=pdb1, pdb2=pdb2, seq1=seq1, seq2=seq2, chain=chain, chain1=chain1, chain2=chain2)

@app.get("/cif/{pdb_id}")
def api_get_cif_alias(pdb_id: str, chain: Optional[str] = None):
    return api_get_cif(pdb_id=pdb_id, chain=chain)

@app.get("/viewer-3dmol")
def api_viewer_3dmol_alias(pdb: str, chain: Optional[str] = None):
    return api_viewer_3dmol(pdb=pdb, chain=chain)
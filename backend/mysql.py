# ==========================
# mysql.py (FULL MODIFIED VERSION - Perfect Camera Sync)
# ==========================

import os
import re
import json
import subprocess
import time
from typing import Optional, List, Tuple, Dict, Any, Union

import pymysql
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles  # static movie 제공

from pydantic import BaseModel

# =============================================================================
# ✅ root_path="/strucptm/api"
# =============================================================================
app = FastAPI(
    root_path="/strucptm/api",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.mount(
    "/movies",
    StaticFiles(directory="/var/lib/mysql-files"),
    name="movies",
)

# ========= CORS =========
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========= DB / TABLE 설정 =========
DB_NAME = os.getenv("PTM_DB", "BIS_PTM")
DB_HOST = os.getenv("PTM_HOST", "localhost")
DB_USER = os.getenv("PTM_USER", "root")
DB_PASS = os.getenv("PTM_PASS", "bis4704_29")

PTM_TABLE = os.getenv("PTM_TABLE", "ptm_data_ext")
SEQ_TABLE = os.getenv("SEQ_TABLE", "sequence_data_ext")


def get_conn():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASS,
        db=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.Cursor,
    )


try:
    from Bio import pairwise2
    BIOPY_AVAIL = True
except Exception:
    BIOPY_AVAIL = False
    print("[WARN] Biopython not available; fallback will be used.")

SCORING_PRESET = dict(match=1.0, mismatch=-1.0, gap_open=-5.0, gap_extend=-1.0)
PDB_RE = re.compile(r"^[0-9A-Za-z]{4}$")
CHAIN_RE = re.compile(r"^[0-9A-Za-z]{1,2}$")


# ========= UTILS =========
def number_only(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    return s if s else None


def split_pdb_chain(s: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not s:
        return None, None
    s = s.strip()
    if ":" in s:
        pid, ch = s.split(":", 1)
        return pid.strip(), (ch.strip() or None)
    return s, None


def _to_str_list(v: Optional[Union[str, List[str]]]) -> Optional[List[str]]:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return [s] if s else None
    if isinstance(v, list):
        out: List[str] = []
        for x in v:
            if x is None:
                continue
            xs = str(x).strip()
            if xs:
                out.append(xs)
        return out or None
    s = str(v).strip()
    return [s] if s else None


def _sql_in_clause(col: str, values: List[Any], params: List[Any]) -> str:
    placeholders = ",".join(["%s"] * len(values))
    params.extend(values)
    return f" AND {col} IN ({placeholders}) "


class SearchQuery(BaseModel):
    uniprot_accession: Optional[str] = None
    organism: Optional[str] = None
    pdb_id_chain: Optional[str] = None
    pdb_pos: Optional[int] = None
    pdb_restype: Optional[str] = None
    annotation: Optional[str] = None
    residue_name: Optional[str] = None
    assembly_type: Optional[Union[str, List[str]]] = None
    location: Optional[Union[str, List[str]]] = None
    secondary_structure: Optional[Union[str, List[str]]] = None
    rsa_min: Optional[float] = None
    rsa_max: Optional[float] = None


_STATS_CACHE: Dict[str, Any] = {"ts": 0.0, "data": None}
_STATS_TTL = 600.0  


def bucket_organism(raw: Optional[str]) -> str:
    if not raw: return "Others"
    s = raw.strip().lower()
    if not s: return "Others"
    if "homo sapiens" in s or "human" in s: return "Human"
    if "mus musculus" in s or "mouse" in s: return "Mouse"
    if "rattus norvegicus" in s or "rat" in s: return "Rat"
    if "gallus gallus" in s or "chicken" in s: return "Chicken"
    if "saccharomyces cerevisiae" in s or "yeast" in s: return "Yeast"
    if "escherichia coli" in s or "e. coli" in s or "e coli" in s or "coli " in s or s.endswith("coli"): return "E. coli"
    if "arabidopsis thaliana" in s or "arabidopsis" in s: return "Arabidopsis"
    if "danio rerio" in s or "zebrafish" in s: return "Zebrafish"
    return "Others"


def get_snapshot_date(conn) -> Optional[str]:
    # 1. 쉘 스크립트가 만들어둔 텍스트 파일에서 날짜 읽기
    date_file = "/home/bis/230711_JSG/241125_PTM/250818_webservice/backend/snapshot_date.txt"
    if os.path.exists(date_file):
        try:
            with open(date_file, "r") as f:
                date_str = f.read().strip()
                if date_str:
                    return date_str
        except Exception as e:
            print("Read snapshot file error:", e)

    # 2. 파일이 없으면 기존 방식(DB 메타데이터)으로 시도
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DATE(UPDATE_TIME)
                FROM information_schema.tables
                WHERE TABLE_SCHEMA = %s
                  AND TABLE_NAME   = %s
                """,
                (DB_NAME, PTM_TABLE),
            )
            row = cur.fetchone()
        if row and row[0]:
            return str(row[0])
    except Exception as e:
        print("get_snapshot_date error:", e)
        
    return None


@app.get("/stats_overview", include_in_schema=False)
def stats_overview():
    now = time.time()
    if _STATS_CACHE["data"] is not None and now - _STATS_CACHE["ts"] < _STATS_TTL:
        return _STATS_CACHE["data"]

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT ptm_type, COUNT(*) AS cnt FROM {PTM_TABLE} GROUP BY ptm_type")
            ptm_rows = cur.fetchall()

            cur.execute(f"SELECT residue_name, COUNT(*) AS cnt FROM {PTM_TABLE} GROUP BY residue_name")
            res_rows = cur.fetchall()

            cur.execute(f"SELECT organism, COUNT(*) AS cnt FROM {PTM_TABLE} GROUP BY organism")
            org_rows = cur.fetchall()

            cur.execute(f"SELECT COUNT(DISTINCT pdb_id) FROM {PTM_TABLE}")
            row_struct = cur.fetchone()
            unique_mmcif_count = int(row_struct[0]) if row_struct and row_struct[0] is not None else 0

        snapshot_date = get_snapshot_date(conn)
    finally:
        conn.close()

    ptm_items = [{"label": name or "Unknown", "value": int(cnt)} for (name, cnt) in ptm_rows]
    res_items = [{"label": name or "Unknown", "value": int(cnt)} for (name, cnt) in res_rows]

    org_bucket: Dict[str, int] = {}
    for raw, cnt in org_rows:
        label = bucket_organism(raw)
        org_bucket[label] = org_bucket.get(label, 0) + int(cnt)

    org_items = [{"label": label, "value": value} for label, value in org_bucket.items()]

    ptm_items.sort(key=lambda x: x["value"], reverse=True)
    res_items.sort(key=lambda x: x["value"], reverse=True)
    org_items.sort(key=lambda x: x["value"], reverse=True)

    data = {
        "ptm_type": ptm_items,
        "residue_type": res_items,
        "organism": org_items,
        "snapshot_date": snapshot_date,
        "unique_mmcif_count": unique_mmcif_count,
    }
    _STATS_CACHE["ts"] = now
    _STATS_CACHE["data"] = data
    return data


# ========= PTM SEARCH (🚀 30,000개 하드 리미트 + 초고속 JSON 바이패스 적용) =========
@app.post("/search_ptm_data", include_in_schema=True)
def search_ptm_data(query: SearchQuery):
    sql = f"""
        SELECT
            uniprot_acc, organism, pdb_id, chain_id, residue_no, res3,
            ptm_type, residue_name, related_pdb_chains_from_SIFTS AS related_pdb_chains,
            assembly_type, location, secondary_structure, rsa
        FROM {PTM_TABLE}
        WHERE 1=1
    """
    params: List[Any] = []

    if query.uniprot_accession:
        sql += " AND uniprot_acc = %s"
        params.append(query.uniprot_accession.strip())
    if query.organism:
        token = (query.organism or "").lower().strip()
        sql += " AND LOWER(COALESCE(organism,'')) LIKE %s"
        params.append(f"%{token}%")
    if query.pdb_id_chain:
        part = query.pdb_id_chain.strip()
        if ":" in part:
            pid, ch = part.split(":", 1)
            sql += " AND UPPER(pdb_id)=UPPER(%s) AND UPPER(chain_id)=UPPER(%s)"
            params += [pid[:4], ch[:2]]
        else:
            sql += " AND UPPER(pdb_id)=UPPER(%s)"
            params.append(part[:4])
    if query.pdb_pos is not None:
        sql += " AND residue_no = %s"
        params.append(int(query.pdb_pos))
    if query.pdb_restype:
        sql += " AND UPPER(res3) = UPPER(%s)"
        params.append(query.pdb_restype.strip()[:3])
    if query.annotation:
        sql += " AND ptm_type = %s"
        params.append(query.annotation.strip())
    if query.residue_name:
        sql += " AND residue_name = %s"
        params.append(query.residue_name.strip())

    assembly_list = _to_str_list(query.assembly_type)
    if assembly_list:
        sql += _sql_in_clause("assembly_type", assembly_list, params)
    location_list = _to_str_list(query.location)
    if location_list:
        sql += _sql_in_clause("location", location_list, params)
    sec_list = _to_str_list(query.secondary_structure)
    if sec_list:
        sql += _sql_in_clause("secondary_structure", sec_list, params)
    if query.rsa_min is not None:
        sql += " AND rsa >= %s"
        params.append(float(query.rsa_min))
    if query.rsa_max is not None:
        sql += " AND rsa <= %s"
        params.append(float(query.rsa_max))

    # 데이터베이스 부하 방지를 위한 하드 리미트
    sql += " LIMIT 30000"

    results = []
    conn = get_conn()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            
            for row in rows:
                chain_id = row.get("chain_id")
                pdb_id = row.get("pdb_id")
                pdb_id_chain = f"{pdb_id}:{chain_id}" if chain_id else f"{pdb_id}"
                
                # 빈 문자열 에러 방지
                rsa_val = row.get("rsa")
                rsa_clean = None
                if rsa_val not in (None, ""):
                    try:
                        rsa_clean = float(rsa_val)
                    except:
                        pass
                
                results.append({
                    "uniprot_accession": row.get("uniprot_acc"),
                    "organism": row.get("organism"),
                    "pdb_id_chain": pdb_id_chain,
                    "pdb_pos": row.get("residue_no"),
                    "pdb_restype": row.get("res3"),
                    "annotation": row.get("ptm_type"),
                    "residue_name": row.get("residue_name"),
                    "related_pdb_chains": row.get("related_pdb_chains") or "",
                    "assembly_type": row.get("assembly_type"),
                    "location": row.get("location"),
                    "secondary_structure": row.get("secondary_structure"),
                    "rsa": rsa_clean
                })
    finally:
        conn.close()

    json_str = json.dumps(results)
    return Response(content=json_str, media_type="application/json")


# ========= SEQUENCE FUNCTIONS =========
def get_conn_dict():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASS,
        db=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def fetch_all_sequences(pdb_id: str) -> List[Dict[str, Any]]:
    pid = pdb_id.strip().upper()
    conn = get_conn_dict()
    try:
        sql = f"""
            SELECT chain_id, seq_aa1
            FROM {SEQ_TABLE}
            WHERE pdb_id = %s
              AND seq_aa1 IS NOT NULL AND seq_aa1 <> ''
            ORDER BY chain_id
        """
        with conn.cursor() as cur:
            cur.execute(sql, (pid,))
            rows = cur.fetchall()

        out: List[Dict[str, Any]] = []
        for r in rows:
            cid = (r["chain_id"] or "").strip()
            if not cid:
                continue
            seq = (r["seq_aa1"] or "").replace("\n", "").replace("\r", "").strip()
            out.append({"chain_id": cid, "sequence": seq, "length": len(seq)})
        if not out:
            raise HTTPException(status_code=404, detail=f"No sequences for {pid}")
        return out
    finally:
        conn.close()


def fetch_chain_sequence(pdb_id: str, chain_id: str) -> Dict[str, Any]:
    pid = pdb_id.strip().upper()
    ch = chain_id.strip().upper()
    conn = get_conn_dict()
    try:
        sql = f"""
            SELECT seq_aa1
            FROM {SEQ_TABLE}
            WHERE pdb_id = %s AND chain_id = %s
              AND seq_aa1 IS NOT NULL AND seq_aa1 <> ''
            LIMIT 1
        """
        with conn.cursor() as cur:
            cur.execute(sql, (pid, ch))
            row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"No sequence for {pid}:{ch}")
        seq = (row["seq_aa1"] or "").replace("\n", "").replace("\r", "").strip()
        return {"chain_id": ch, "sequence": seq, "length": len(seq)}
    finally:
        conn.close()


def concat_pdb_sequence(pdb_id: str) -> Dict[str, Any]:
    chains = fetch_all_sequences(pdb_id)
    chains_sorted = sorted(chains, key=lambda x: str(x["chain_id"]))
    seqs = [c["sequence"] for c in chains_sorted]
    concat = "".join(seqs)

    if not concat:
        raise HTTPException(status_code=404, detail=f"Empty sequence for {pdb_id}")

    offsets = []
    pos = 0
    for c in chains_sorted:
        L = len(c["sequence"])
        offsets.append({"chain_id": c["chain_id"], "start": pos + 1, "end": pos + L})
        pos += L

    return {
        "sequence": concat,
        "length": len(concat),
        "chains": [c["chain_id"] for c in chains_sorted],
        "offsets": offsets,
    }


def get_sequence_for(pdb: str, chain: Optional[str]):
    pdb_up = pdb.strip().upper()
    if chain:
        ch_up = chain.strip().upper()
        if not CHAIN_RE.match(ch_up):
            raise HTTPException(status_code=400, detail="Invalid chain")
        info = fetch_chain_sequence(pdb_up, ch_up)
        return {
            "pdb": pdb_up,
            "mode": "chain",
            "chain": ch_up,
            "sequence": info["sequence"],
            "length": info["length"],
        }
    else:
        info = concat_pdb_sequence(pdb_up)
        return {"pdb": pdb_up, "mode": "concat", **info}


def compute_alignment_affine(seq1: str, seq2: str) -> Tuple[str, str, str]:
    if BIOPY_AVAIL:
        aln = pairwise2.align.globalms(
            seq1,
            seq2,
            SCORING_PRESET["match"],
            SCORING_PRESET["mismatch"],
            SCORING_PRESET["gap_open"],
            SCORING_PRESET["gap_extend"],
            one_alignment_only=True,
            penalize_end_gaps=False,
        )
        if not aln:
            return "", "", ""
        a_aln, b_aln, _score, _start, _end = aln[0]
    else:
        a_aln, b_aln, mid = needleman_wunsch(seq1, seq2)
        return a_aln, b_aln, mid

    if not a_aln or not b_aln:
        return a_aln or "", b_aln or "", ""

    n = min(len(a_aln), len(b_aln))
    a_aln = a_aln[:n]
    b_aln = b_aln[:n]

    mid_chars = []
    for aa, bb in zip(a_aln, b_aln):
        if aa != "-" and bb != "-" and aa == bb:
            mid_chars.append("|")
        else:
            mid_chars.append(" ")
    mid = "".join(mid_chars)

    return a_aln, b_aln, mid


def needleman_wunsch(a, b, match=1, mismatch=-1, gap=-1):
    A, B = list(a), list(b)
    n, m = len(A), len(B)
    S = [[0] * (m + 1) for _ in range(n + 1)]
    T = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        S[i][0] = S[i - 1][0] + gap
        T[i][0] = 2
    for j in range(1, m + 1):
        S[0][j] = S[0][j - 1] + gap
        T[0][j] = 3

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            diag = S[i - 1][j - 1] + (match if A[i - 1] == B[j - 1] else mismatch)
            up = S[i - 1][j] + gap
            left = S[i][j - 1] + gap

            best = diag
            tb = 1
            if up > best:
                best = up
                tb = 2
            if left > best:
                best = left
                tb = 3

            S[i][j] = best
            T[i][j] = tb

    aa, bb, mm = [], [], []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and T[i][j] == 1:
            x = A[i - 1]
            y = B[j - 1]
            aa.append(x)
            bb.append(y)
            mm.append("|" if x == y else " ")
            i -= 1
            j -= 1
        elif i > 0 and T[i][j] == 2:
            aa.append(A[i - 1])
            bb.append("-")
            mm.append(" ")
            i -= 1
        else:
            aa.append("-")
            bb.append(B[j - 1])
            mm.append(" ")
            j -= 1

    aa = "".join(reversed(aa))
    bb = "".join(reversed(bb))
    mm = "".join(reversed(mm))

    return aa, bb, mm


# ========= CIF FILES =========
MMCIF_DIR = os.getenv("MMCIF_DIR", "/var/lib/mysql-files/mmcifs")

def resolve_mmcif_path(pdb_id: str, chain: str | None = None) -> str:
    pid = pdb_id.strip().lower()
    if not PDB_RE.match(pid):
        raise HTTPException(status_code=400, detail="Invalid pdb_id")
    if chain:
        ch = chain.strip().upper()
        if not CHAIN_RE.match(ch):
            raise HTTPException(status_code=400, detail="Invalid chain")
        chain_path = os.path.join(MMCIF_DIR, f"{pid}:{ch}.cif")
        if os.path.exists(chain_path):
            return chain_path

    path = os.path.join(MMCIF_DIR, f"{pid}.cif")
    if os.path.exists(path):
        return path

    target = f"{pid}:{chain}.cif" if chain else f"{pid}.cif"
    raise HTTPException(status_code=404, detail=f"CIF file not found: {target}")


@app.get("/cif/{pdb_id}", include_in_schema=False)
def get_cif_file(pdb_id: str, chain: str | None = Query(default=None)):
    filepath = resolve_mmcif_path(pdb_id, chain)
    filename = os.path.basename(filepath)
    return FileResponse(
        filepath,
        media_type="text/plain; charset=utf-8",
        filename=filename,
        headers={
            "Cache-Control": "no-store, max-age=0",
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


# ========= PTM (viewer용) =========
def fetch_ptm_for_viewer(pdb_id: str, chain: Optional[str]) -> List[dict]:
    pid = pdb_id.strip().upper()
    ch = (chain or "").strip().upper() or None

    sql = f"""
        SELECT chain_id, residue_no, residue_name, ptm_type
        FROM {PTM_TABLE}
        WHERE pdb_id = %s
    """
    params: List[Any] = [pid]
    if ch:
        sql += " AND chain_id = %s"
        params.append(ch)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
    finally:
        conn.close()

    out: List[dict] = []
    for r in rows:
        chain_id, residue_no, residue_name, ptm_type = r
        if not chain_id:
            continue
        out.append(
            {
                "chain": str(chain_id).strip(),
                "resnum": int(residue_no),
                "residue_name": str(residue_name or "").strip(),
                "ptm_type": str(ptm_type or "").strip(),
            }
        )
    return out


# 🚀 [핵심 수정 구간] 3Dmol 뷰어 카메라 동기화 로직 완벽 개선 
@app.get("/viewer-3dmol", response_class=HTMLResponse, include_in_schema=False)
def viewer_3dmol(pdb: str, chain: str | None = None):
    if ":" in pdb:
        base, ch = pdb.split(":", 1)
        pdb = base
        if not chain and ch:
            chain = ch

    pdb_lower = pdb.strip().lower()
    pdb_upper = pdb.strip().upper()
    chain_up = (chain or "").strip().upper() or ""
    chain_q = f"&chain={chain_up}" if chain_up else ""
    cif_url = f"/cif/{pdb_lower}?nocache=1{chain_q}"

    ptm_sites = fetch_ptm_for_viewer(pdb_upper, chain_up or None)
    ptm_json = json.dumps(ptm_sites, ensure_ascii=False)

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>3Dmol.js Viewer — {pdb_upper}</title>
      <script src="https://3Dmol.org/build/3Dmol-min.js"></script>
      <style>
        html, body {{ margin:0; height:100%; }}
        #gldiv {{ width:100%; height:100%; position:fixed; left:0; top:0; }}
        #err {{ position:fixed; left:8px; bottom:8px; padding:6px 8px; background:rgba(220,0,0,.1);
                border:1px solid rgba(220,0,0,.4); color:#b00; font-family:monospace; display:none; white-space:pre-wrap; }}
        #legend {{ position:fixed; right:12px; top:12px; background:rgba(255,255,255,.9); border:1px solid #ddd;
                   border-radius:8px; padding:8px 10px; font:12px/1.3 sans-serif; box-shadow:0 2px 8px rgba(0,0,0,.08); max-width:220px; }}
        #legend .row {{ display:flex; align-items:center; gap:6px; margin:4px 0; }}
        #legend .swatch {{ width:12px; height:12px; border-radius:3px; border:1px solid rgba(0,0,0,.15); }}
        #legend .title {{ font-weight:600; margin-bottom:6px; }}
      </style>
    </head>
    <body>
      <div id="gldiv"></div>
      <div id="err"></div>
      <div id="legend" style="display:none;">
        <div class="title">Chains</div>
        <div id="legend-rows"></div>
      </div>

      <script>
        const PALETTE   = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b',
                           '#e377c2','#7f7f7f','#bcbd22','#17becf','#393b79','#637939',
                           '#8c6d31','#843c39','#7b4173'];
        const PTM_SITES = {ptm_json};

        const showError = (m) => {{
          const e = document.getElementById('err');
          e.textContent = m;
          e.style.display = 'block';
          console.error(m);
        }};

        (async () => {{
          try {{
            const res = await fetch("{cif_url}", {{ cache: 'no-store' }});
            if (!res.ok) throw new Error('HTTP ' + res.status + ' loading CIF');
            const cifText = await res.text();
            if (!cifText || cifText.length < 200) throw new Error('CIF is empty');

            const el = document.getElementById('gldiv');
            const viewer = $3Dmol.createViewer(el, {{ backgroundColor: 'white' }});
            viewer.addModel(cifText, 'mmcif');

            const model  = viewer.getModel();
            const atoms  = model.selectedAtoms({{}});
            const set    = new Set();
            for (const a of atoms) if (a.chain) set.add(a.chain);
            const chains = Array.from(set).sort();

            const legendRows = document.getElementById('legend-rows');
            const legendBox  = document.getElementById('legend');

            const REQ_CHAIN = "{chain_up}";

            if (REQ_CHAIN) {{
              chains.forEach((ch) => {{
                const color = (ch === REQ_CHAIN) ? '#1f77b4' : '#c0c0c0';
                viewer.setStyle({{ chain: ch }}, {{ cartoon: {{ color: color, thickness: 0.30 }} }});
              }});
            }} else {{
              chains.forEach((ch, idx) => {{
                const color = PALETTE[idx % PALETTE.length];
                viewer.setStyle({{ chain: ch }}, {{ cartoon: {{ color: color, thickness: 0.30 }} }});
              }});
            }}

            chains.forEach((ch, idx) => {{
              const color = REQ_CHAIN
                ? (ch === REQ_CHAIN ? '#1f77b4' : '#c0c0c0')
                : PALETTE[idx % PALETTE.length];

              const row = document.createElement('div'); row.className = 'row';
              const sw  = document.createElement('div'); sw.className = 'swatch'; sw.style.background = color;
              const lab = document.createElement('div'); lab.textContent = 'Chain ' + ch;
              row.appendChild(sw); row.appendChild(lab); legendRows.appendChild(row);
            }});

            viewer.addStyle({{ hetflag: true }}, {{ stick: {{ radius: 0.22 }} }});

            if (Array.isArray(PTM_SITES) && PTM_SITES.length > 0) {{
              for (const site of PTM_SITES) {{
                const ch   = site.chain;
                const resi = site.resnum;
                const name = site.residue_name || '';
                if (!ch || !resi) continue;

                const sel = {{ chain: ch, resi: resi }};
                viewer.addStyle(sel, {{
                  stick: {{
                    radius: 0.4,
                    color: '#d62728'
                  }}
                }});

                const selAtoms = model.selectedAtoms(sel);
                if (selAtoms && selAtoms.length > 0) {{
                  const atom = selAtoms[0];
                  const text = resi + ", " + name;
                  viewer.addLabel(text, {{
                    position: {{ x: atom.x, y: atom.y, z: atom.z }},
                    fontSize: 12,
                    fontFamily: "sans-serif",
                    fontColor: "black",
                    showBackground: true,
                    backgroundColor: "#ffffff",
                    backgroundOpacity: 0.85,
                    borderColor: "#666666",
                    borderThickness: 1,
                    inFront: true
                  }});
                }}
              }}
            }}

            viewer.zoomTo();
            viewer.render();

            let isSyncing = false;
            
            // 🚀 카메라 수신 로직 개선 (내 중심좌표는 지키고 회전/줌만 가져오기)
            window.addEventListener('message', (e) => {{
              if (e.data && e.data.type === 'sync-camera' && e.data.view) {{
                isSyncing = true;
                const incomingView = e.data.view;
                const myView = viewer.getView();

                // 3Dmol.js의 getView 배열 형태: [cx, cy, cz, rx, ry, rz, rw, zoom]
                // index 0, 1, 2는 각각 단백질의 중심 X, Y, Z 좌표입니다.
                if (Array.isArray(incomingView) && incomingView.length >= 8 && 
                    Array.isArray(myView) && myView.length >= 8) {{
                    
                    // 내 중심(0,1,2) 유지 + 상대방 회전(3,4,5,6) 및 줌(7) 병합!
                    const mergedView = [
                        myView[0], myView[1], myView[2],
                        incomingView[3], incomingView[4], incomingView[5], incomingView[6],
                        incomingView[7]
                    ];
                    viewer.setView(mergedView);
                }} else {{
                    // 혹시나 배열이 아닐 경우를 대비한 Fallback (안전장치)
                    viewer.setView(incomingView);
                }}
                
                viewer.render();
              }}
            }});

            const broadcastView = () => {{
              if (isSyncing) {{
                isSyncing = false;
                return;
              }}
              const view = viewer.getView();
              if (window.__lastView && JSON.stringify(window.__lastView) === JSON.stringify(view)) return;
              window.__lastView = view;
              window.parent.postMessage({{ type: 'sync-camera', view }}, '*');
            }};

            const cv = el.querySelector('canvas');
            if (cv) {{
              cv.addEventListener('mouseup', broadcastView);
              cv.addEventListener('wheel', broadcastView);
              cv.addEventListener('mousemove', (e) => {{
                if (e.buttons > 0) broadcastView();
              }});
              cv.addEventListener('touchend', broadcastView);
              cv.addEventListener('touchmove', broadcastView);
            }}

          }} catch (e) {{
            showError('3Dmol load error: ' + (e && e.message ? e.message : e));
          }}
        }})();
      </script>
    </body>
    </html>
    """


# ========= TM-SCORE =========
TMSCORE_BIN = os.getenv(
    "TMSCORE_BIN", "/home/bis/230711_JSG/230711_JSG_ProteinComplex/TMalign"
)


def run_tm_score_paths(path1: str, path2: str) -> float:
    try:
        # TM-align은 한 번만 돌려도 알아서 최적을 찾고 2개의 점수를 줍니다.
        result = subprocess.run(
            [TMSCORE_BIN, path1, path2], # 💡 TMSCORE_BIN 변수 경로를 TM-align으로 꼭 변경하세요!
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            timeout=60,
        )
        out = result.stdout or ""
        
        # TM-align이 뱉어낸 2개의 점수 중 큰 값(짧은 체인 기준 정규화)을 가져옵니다.
        tm_scores = re.findall(r"TM-score\s*=?\s*([0-9.]+)", out)
        if tm_scores:
            return max([float(x) for x in tm_scores])
            
        return 0.0
    except Exception as e:
        print("TMalign error:", e)
        return 0.0


@app.get("/tm_score", include_in_schema=False)
def tm_score(
    pdb1: str = Query(...),
    pdb2: str = Query(...),
    chain: str | None = None,
    chain1: str | None = None,
    chain2: str | None = None,
):
    def split_pc(s: str) -> tuple[str, str | None]:
        s = s.strip()
        if ":" in s:
            a, b = s.split(":", 1)
            return a.strip(), (b.strip() or None)
        return s, None

    p1, c_from1 = split_pc(pdb1)
    p2, c_from2 = split_pc(pdb2)
    c1 = (chain1 or chain or c_from1)
    c2 = (chain2 or chain or c_from2)

    path1 = resolve_mmcif_path(p1, c1)
    path2 = resolve_mmcif_path(p2, c2)

    score = run_tm_score_paths(path1, path2)
    return {
        "pdb1": p1.upper(),
        "pdb2": p2.upper(),
        "chain1": (c1 or ""),
        "chain2": (c2 or ""),
        "tm_score_overall": score,
        "note": "If chain1/chain2 provided, TM-score is chain-vs-chain.",
    }


# ========= SEQUENCE ALIGNMENT API =========
@app.get("/align_sequences", include_in_schema=False)
@app.get("/align", include_in_schema=False)
def align_sequences_api(
    pdb1: Optional[str] = None,
    pdb2: Optional[str] = None,
    seq1: Optional[str] = None,
    seq2: Optional[str] = None,
    chain: Optional[str] = None,
    chain1: Optional[str] = None,
    chain2: Optional[str] = None,
):
    if seq1 is not None and seq2 is not None:
        info1 = {"pdb": "", "mode": "raw", "sequence": seq1, "length": len(seq1)}
        info2 = {"pdb": "", "mode": "raw", "sequence": seq2, "length": len(seq2)}
    else:
        if seq1 is None and pdb1 is None:
            raise HTTPException(status_code=400, detail="Provide seq1 or pdb1")
        if seq2 is None and pdb2 is None:
            raise HTTPException(status_code=400, detail="Provide seq2 or pdb2")

        pdb1_raw, ch_from1 = split_pdb_chain(pdb1) if pdb1 else (None, None)
        pdb2_raw, ch_from2 = split_pdb_chain(pdb2) if pdb2 else (None, None)

        eff_chain1 = chain1 or chain or ch_from1
        eff_chain2 = chain2 or chain or ch_from2

        if seq1 is None:
            info1 = get_sequence_for(pdb1_raw, eff_chain1)
        else:
            info1 = {
                "pdb": pdb1_raw or "",
                "mode": "raw",
                "sequence": seq1,
                "length": len(seq1),
            }

        if seq2 is None:
            info2 = get_sequence_for(pdb2_raw, eff_chain2)
        else:
            info2 = {
                "pdb": pdb2_raw or "",
                "mode": "raw",
                "sequence": seq2,
                "length": len(seq2),
            }

    a_aln, b_aln, mid = compute_alignment_affine(info1["sequence"], info2["sequence"])

    resp1 = {k: v for k, v in info1.items() if k != "sequence"}
    resp2 = {k: v for k, v in info2.items() if k != "sequence"}

    aln_len = min(len(a_aln), len(b_aln)) if a_aln and b_aln else 0

    return {
        "length1": info1["length"],
        "length2": info2["length"],
        "concat1": resp1,
        "concat2": resp2,
        "alignment": {"seq1": a_aln, "midline": mid, "seq2": b_aln},
        "identity_fraction": 0.0,
        "identity_percent": 0.0,
        "identity": 0.0,
        "similarity": 0.0,
        "aligned_length": aln_len,
        "note": "Alignment only. Sequence identity must come from precomputed DB values.",
    }


# ========= SEQUENCES =========
@app.get("/sequences", include_in_schema=False)
def get_sequences(pdb: str, chain: Optional[str] = None):
    data = fetch_all_sequences(pdb)
    pdb_up = pdb.strip().upper()
    if chain:
        ch = chain.strip().upper()
        for r in data:
            if r["chain_id"].upper() == ch:
                return {
                    "pdb": pdb_up,
                    "chain": ch,
                    "sequence": r["sequence"],
                    "length": r["length"],
                }
        raise HTTPException(status_code=404, detail=f"No sequence for {pdb_up}:{ch}")
    return {"pdb": pdb_up, "chains": data}


@app.get("/sequence_concat", include_in_schema=False)
def get_sequence_concat(pdb: str):
    info = concat_pdb_sequence(pdb)
    return {"pdb": pdb.strip().upper(), **info}
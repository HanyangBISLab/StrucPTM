#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import subprocess
import time

# =====================================================================
# [INIT] 0. CONDA ENVIRONMENT BOOTSTRAP 
# =====================================================================
TARGET_ENV = "strucptm"
current_env = os.environ.get("CONDA_DEFAULT_ENV")

if current_env != TARGET_ENV and os.environ.get("STRUCPTM_BOOTSTRAPPED") != "1":
    print(f"[RESTART] [BOOTSTRAP] 현재 환경은 '{current_env}'입니다. 안전한 '{TARGET_ENV}' 환경으로 전환을 시도합니다...")
    try:
        env_list = subprocess.run(["conda", "env", "list"], capture_output=True, text=True, check=True).stdout
        conda_base = subprocess.run(["conda", "info", "--base"], capture_output=True, text=True).stdout.strip()
        
        if TARGET_ENV not in env_list:
            print(f"[SETUP] [BOOTSTRAP] '{TARGET_ENV}' 방을 만듭니다 (순수 Python 3.10 초고속 생성)...")
            subprocess.run(["conda", "create", "-n", TARGET_ENV, "python=3.10", "-y"], check=True)
            
            print(f"[INSTALL] [BOOTSTRAP] 무한 로딩 방지를 위해 'pip'로 필수 패키지를 고속 설치합니다...")
            env_pip = os.path.join(conda_base, "envs", TARGET_ENV, "bin", "pip")
            subprocess.run([env_pip, "install", "numpy<2", "pandas", "biopython", "pymysql", "tqdm", "requests", "pytz"], check=True)
            print(f"[SUCCESS] [BOOTSTRAP] '{TARGET_ENV}' 환경 쾌속 생성 및 패키지 세팅 완료!")
        
        env_python = os.path.join(conda_base, "envs", TARGET_ENV, "bin", "python")
        print(f"[LAUNCH] [BOOTSTRAP] 안전한 환경에서 스크립트를 재시작합니다!\n" + "="*60)
        
        run_env = os.environ.copy()
        run_env["CONDA_DEFAULT_ENV"] = TARGET_ENV
        run_env["STRUCPTM_BOOTSTRAPPED"] = "1"
        sys.exit(subprocess.call([env_python] + sys.argv, env=run_env))
        
    except Exception as e:
        print(f"[ERROR] [BOOTSTRAP] 환경 전환 중 오류가 발생했습니다: {e}")
        sys.exit(1)

# =====================================================================
# [IMPORTS] 외부 라이브러리 임포트
# =====================================================================
import re
import math
import ast 
import pickle
import hashlib
import gzip
import shutil
import urllib.request
import requests
import warnings
import pymysql
import datetime
import pytz
import numpy as np
import pandas as pd
import multiprocessing as mp
from typing import Optional, List, Dict, Tuple, Any
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from pathlib import Path
from tqdm import tqdm

# 💡 [안전한 임포트 처리] 필수 모듈 분리
try:
    from Bio.PDB.MMCIFParser import MMCIFParser
    from Bio.PDB.MMCIF2Dict import MMCIF2Dict
    from Bio.PDB.PDBIO import PDBIO
    from Bio.PDB import Select
except Exception as e:
    raise RuntimeError(f"Biopython 필수 모듈을 불러올 수 없습니다: {e}")

try:
    from Bio.PDB.FastMMCIFParser import FastMMCIFParser
except Exception:
    FastMMCIFParser = None

try:
    from Bio import Align
    BIO_OK = True
except Exception:
    BIO_OK = False

warnings.filterwarnings("ignore")


# =====================================================================
# [GLOBALS] 전역 설정 및 사전 정의
# =====================================================================
MAX_WORKERS = 32

PDB_API_URL = "https://data.rcsb.org/rest/v1/holdings/current/entry_ids"

data_root = '/data1/JSG/'
uniprot_root = Path("/data1/JSG/UniProt/")
mmcif_root = Path("/data1/JSG/mmcifs/")
mmcif_divided_root = mmcif_root / "divided"
mmcif_chain_root = Path("/data1/JSG/mmcif_chains/")
dssp_root = Path("/data1/JSG/DSSP/")

uniprot_csv_path = Path("/data1/JSG/251106_new_PTM_summary/uniprot_sprot.csv")
pdb_chain_uniprot_csv_path = str(uniprot_root / "pdb_chain_uniprot.csv")
diff_df_path = "/data1/JSG/251106_new_PTM_summary/PTM_added_atoms.csv"
ptm_sd_table_path = "/data1/JSG/251106_new_PTM_summary/PTM-SD_correpondence_table.csv"

inter_sequence_df_path = '/data1/JSG/251106_new_PTM_summary/intermediate/251218_sequence_df.csv'
inter_StrucPTM_df_path = '/data1/JSG/251106_new_PTM_summary/intermediate/251218_StrucPTM_df.csv'
inter_PTM_SD_df_path = '/data1/JSG/251106_new_PTM_summary/intermediate/251218_PTM_SD_df.csv'

sequence_df_path = '/data1/JSG/251106_new_PTM_summary/251218_sequence_df.csv'
StrucPTM_df_path = '/data1/JSG/251106_new_PTM_summary/251218_StrucPTM_df.csv'
PTM_SD_df_path = '/data1/JSG/251106_new_PTM_summary/251218_PTM_SD_df.csv'

MYSQL_SEQ_CSV = "/var/lib/mysql-files/251107_Final_sequence_df.csv"
MYSQL_PTM_CSV = "/var/lib/mysql-files/251107_Final_PTM_df.csv"

DB_NAME   = os.getenv("PTM_DB",   "")
DB_HOST   = os.getenv("PTM_HOST", "")
DB_USER   = os.getenv("PTM_USER", "")
DB_PASS   = os.getenv("PTM_PASS", "")

# Dictionaries
three_to_one = {
    "ALA": "A", "CYS": "C", "ASP": "D", "GLU": "E", "PHE": "F", "GLY": "G", "HIS": "H", "ILE": "I", "LYS": "K", "LEU": "L",
    "MET": "M", "ASN": "N", "PRO": "P", "GLN": "Q", "ARG": "R", "SER": "S", "THR": "T", "VAL": "V", "TRP": "W", "TYR": "Y",
    "SEC": "U", "PYL": "O", "ASX": "B", "GLX": "Z", "UNK": "X", "MSE": "M",
}
ptm_to_base = {
    "MLY": "K", "SMC": "C", "M3L": "K", "MLZ": "K", "MEN": "N", "HIC": "H", "MHS": "H", "AGM": "R", "MGN": "Q", "MEA": "E", 
    "CMT": "C", "SEP": "S", "TPO": "T", "PTR": "Y", "HYP": "P", "LYZ": "K", "CSO": "C", "OMT": "M", "KCX": "K", "PCA": "Q", 
    "CGU": "E", "ALY": "K", "SAC": "S", "AYA": "A", "FME": "M", "TYS": "Y", "NIY": "Y", "SNC": "C",
}
Extracted_PTMs = {
    'Glycosylation': {'ASN': 20642, 'SER': 493, 'THR': 333},
    'Methylation': {'MLY': 5603, 'SMC': 257, 'M3L': 221, 'MLZ': 146, 'MEN': 131, 'HIC': 120, 'MME': 82, 'MHS': 43, 'AGM': 40, 'MGN': 38, 'MEA': 32, 'CMT': 10, 'PHE': 1},
    'Phosphorylation': {'SEP': 1194, 'TPO': 973, 'PTR': 773, 'PHD': 37},
    'Hydroxylation': {'HYP': 1422, 'LYZ': 40, 'BHD': 8, 'ARO': 4, 'AHB': 4},
    'Oxidation': {'CSO': 904, 'OMT': 28},
    'N6-carboxylysine': {'KCX': 896},
    'Pyrrolidone carboxylic acid': {'PCA': 634},
    'Gamma-carboxyglutamic acid': {'CGU': 496},
    'Formylation': {'FME': 291},
    'Acetylation': {'ALY': 169, 'SAC': 78, 'AYA': 36},
    'Sulfation': {'TYS': 234},
    'Nitration': {'NIY': 49},
    'S-Nitrosylation': {'SNC': 35},
    'Bromination': {'BTR': 1}
}
PTM_residue_codes = sorted({str(res).upper() for mods in Extracted_PTMs.values() for res in mods.keys()})
PTM_rescode_to_annotation = {'MLY':'Methylation','SMC':'Methylation','M3L':'Methylation','MLZ':'Methylation','MEN':'Methylation','HIC':'Methylation','MHS':'Methylation', 'AGM':'Methylation','MGN':'Methylation','MEA':'Methylation','CMT':'Methylation','SEP':'Phosphorylation','TPO':'Phosphorylation','PTR':'Phosphorylation','HYP':'Hydroxylation','LYZ':'Hydroxylation','CSO':'Oxidation','OMT':'Oxidation','KCX':'N6-carboxylysine','PCA':'Pyrrolidone carboxylic acid','CGU':'Gamma-carboxyglutamic acid','ALY':'Acetylation' ,'SAC':'Acetylation' ,'AYA':'Acetylation' ,'FME':'Formylation' ,'TYS':'Sulfation' ,'NIY':'Nitration' ,'SNC':'S-Nitrosylation'}
ptm_to_canonical_3code = {'MLY': 'LYS', 'SMC': 'CYS', 'M3L': 'LYS', 'MLZ': 'LYS', 'MEN': 'ASN', 'HIC': 'HIS', 'MHS': 'HIS', 'AGM': 'ARG', 'MGN': 'GLN', 'MEA': 'GLU', 'CMT': 'CYS', 'SEP': 'SER', 'TPO': 'THR', 'PTR': 'TYR', 'HYP': 'PRO', 'LYZ': 'LYS', 'CSO': 'CYS', 'OMT': 'MET', 'KCX': 'LYS', 'PCA': 'GLN', 'CGU': 'GLU', 'ALY': 'LYS', 'SAC': 'SER', 'AYA': 'ALA', 'FME': 'MET', 'TYS': 'TYR', 'NIY': 'TYR', 'SNC': 'CYS'}

RES3_TO_ONE = {**three_to_one, **{k.upper(): v for k, v in ptm_to_base.items()}}
STANDARD_AA3 = set(three_to_one.keys())
PTM_TRUE_CODES = {code for code in PTM_residue_codes if code not in STANDARD_AA3}

THREE_TO_FULLNAME = {
    "ALA": "Alanine", "CYS": "Cysteine", "ASP": "Aspartic acid", "GLU": "Glutamic acid", "PHE": "Phenylalanine", "GLY": "Glycine", 
    "HIS": "Histidine", "ILE": "Isoleucine", "LYS": "Lysine", "LEU": "Leucine", "MET": "Methionine", "ASN": "Asparagine",
    "PRO": "Proline", "GLN": "Glutamine", "ARG": "Arginine", "SER": "Serine", "THR": "Threonine", "VAL": "Valine", "TRP": "Tryptophan", 
    "TYR": "Tyrosine", "SEC": "Selenocysteine", "PYL": "Pyrrolysine", "ASX": "Aspartic acid or Asparagine", "GLX": "Glutamic acid or Glutamine", "UNK": "Unknown"
}
FULLNAME_TO_1 = {
    "Alanine":"A", "Cysteine":"C", "Aspartic acid":"D", "Glutamic acid":"E", "Phenylalanine":"F", "Glycine":"G", "Histidine":"H", 
    "Isoleucine":"I", "Lysine":"K", "Leucine":"L", "Methionine":"M", "Asparagine":"N", "Proline":"P", "Glutamine":"Q", "Arginine":"R", 
    "Serine":"S", "Threonine":"T", "Valine":"V", "Tryptophan":"W", "Tyrosine":"Y", "Selenocysteine":"C", "Pyrrolysine":"K",
}
max_ASA = {
    'F': 210, 'I': 175, 'L': 170, 'V': 155, 'P': 145, 'A': 115, 'G': 75, 'M': 185, 'C': 135, 'W': 255, 'Y': 230, 'T': 140, 
    'S': 115, 'Q': 180, 'N': 160, 'E': 190, 'D': 150, 'H': 195, 'K': 200, 'R': 225
}

AA3_TO_AA1 = {'ALA':'A','ARG':'R','ASN':'N','ASP':'D','CYS':'C','GLN':'Q','GLU':'E','GLY':'G','HIS':'H','ILE':'I','LEU':'L','LYS':'K','MET':'M','PHE':'F','PRO':'P','SER':'S','THR':'T','TRP':'W','TYR':'Y','VAL':'V'}
MOD_TO_AA1 = {'SEP':'S','TPO':'T','PTR':'Y','CSS':'C','CSO':'C','CSD':'C','CSE':'C','CSX':'C','CME':'C','CSM':'C','CYX':'C','MSE':'M','FME':'M','HYP':'P','KCX':'K','MLY':'K','M3L':'K','ALY':'K','SEC':'U','PYL':'O'}
NONRES_TOKENS = {'HOH','H2O','WAT','DOD','DMS','GOL','EDO','MPD','PEG','PG4','P4G','ACT','ACE','IPA','BME','ATP','ADP','AMP','GTP','GDP','CTP','CDP','CMP','UTP','UDP','UMP','NAD','NADP','FAD','SAM','SAH','FMN','CL','BR','I','F','NA','K','CA','MG','MN','FE','FE2','FE3','ZN','CU','CO','NI','SR','CS','YB','CD','HG','SO4','PO4','NO3','SCN','CO3','NAG','BMA','MAN','FUC','GAL','GLC','NDG','SIA','HEM','HEC','HEME','A06','AZ7','DMS','GAP'}
INTERNAL_TO_DOT = NONRES_TOKENS - {'GAP'}
FRONT_STRIP_TOKENS = {'GAP'}
AA1_GAP_CHAR = '.'
UNKNOWN_CHAR = 'X'


# =====================================================================
# [FUNCTIONS] 멀티 프로세싱을 위한 최상단 함수 정의 모음 
# =====================================================================
giant_sema = None

def pool_init(sema):
    global giant_sema
    giant_sema = sema

def count_identities(aln, qseq, cseq):
    matches = 0
    for (t_start, t_end), (q_start, q_end) in zip(aln.aligned[0], aln.aligned[1]):
        for i in range(t_end - t_start):
            if qseq[t_start + i] == cseq[q_start + i]:
                matches += 1
    return matches

def _worker_align(task):
    key, qseq, cand_pairs, cand_str = task
    res = []
    l_q = len(qseq)
    
    is_giant = l_q > 3000 or any((cs and len(cs) > 3000) for ck, cs in cand_pairs)
    
    if is_giant and giant_sema is not None:
        giant_sema.acquire()
        
    try:
        if BIO_OK:
            aligner = Align.PairwiseAligner()
            aligner.mode = 'global'
            aligner.match_score = 1.0
            aligner.mismatch_score = -1.0
            aligner.open_gap_score = -5.0
            aligner.extend_gap_score = -1.0

        for ck, cs in cand_pairs:
            if not cs: continue
            l_c = len(cs)
            
            if min(l_q, l_c) / max(l_q, l_c) < 0.75:
                continue
                
            try:
                if not BIO_OK:
                    sc = sum(1 for i in range(min(l_q, l_c)) if qseq[i]==cs[i]) / max(l_q, l_c)
                else:
                    best_aln = aligner.align(qseq, cs)[0]
                    matches = count_identities(best_aln, qseq, cs)
                    sc = matches / max(l_q, l_c)
                
                if sc >= 0.75:
                    res.append((ck, sc))
            except Exception:
                pass 
    finally:
        if is_giant and giant_sema is not None:
            giant_sema.release()
            
    return key, sorted(res, key=lambda x: x[1], reverse=True), cand_str

def download_with_progress(url: str, dest: Path, chunk_size=1024*1024, max_retries=5):
    for attempt in range(1, max_retries+1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as resp:
                total = resp.getheader("Content-Length")
                total = int(total) if total is not None else None
                tmp = dest.with_suffix(dest.suffix + ".part")
                if tmp.exists(): tmp.unlink()
                with open(tmp, "wb") as f, tqdm(total=total, unit="B", unit_scale=True, unit_divisor=1024, desc=dest.name, dynamic_ncols=True) as bar:
                    while True:
                        chunk = resp.read(chunk_size)
                        if not chunk: break
                        f.write(chunk)
                        bar.update(len(chunk))
                tmp.replace(dest)
            return True
        except Exception as e:
            if attempt == max_retries: return False
            time.sleep(2 * attempt)

def parse_uniprot_sprot_func(uniprot_path: Path) -> pd.DataFrame:
    def _push_current(rec_list: List[Dict], cur: Dict):
        if not cur: return
        cur["Description"] = " ".join(cur.get("Description", [])).strip() or None
        cur["Organism"] = " ".join(cur.get("Organism", [])).strip().rstrip(".") or None
        if "Organism_ID" in cur:
            m_id = re.search(r"NCBI_TaxID=(\d+)", cur["Organism_ID"])
            cur["Organism_ID"] = m_id.group(1) if m_id else None
        else: cur["Organism_ID"] = None
        if "PDB" in cur:
            seen, uniq = set(), []
            for x in cur["PDB"]:
                x_up = x.strip().upper()
                if re.fullmatch(r"[0-9A-Z]{4}", x_up) and x_up not in seen:
                    seen.add(x_up); uniq.append(x_up)
            cur["PDB"] = ", ".join(uniq) if uniq else None
        else: cur["PDB"] = None
        cur["amino_acid_sequence"] = cur.get("amino_acid_sequence", None) or None
        cur["IDR_regions"] = cur.get("IDR_regions", [])
        acc = cur.get("Accession")
        if isinstance(acc, list): cur["Accession"] = acc[0] if acc else None
        rec_list.append({"ID": cur.get("ID"), "Accession": cur.get("Accession"), "Description": cur.get("Description"), "Organism": cur.get("Organism"), "Organism_ID": cur.get("Organism_ID"), "amino_acid_sequence": cur.get("amino_acid_sequence"), "IDR_regions": cur.get("IDR_regions"), "PDB": cur.get("PDB")})

    re_id = re.compile(r"^ID\s+(\S+)"); re_ac = re.compile(r"^AC\s+(.+)"); re_de = re.compile(r"^DE\s+(.+)"); re_os = re.compile(r"^OS\s+(.+)")
    re_ox = re.compile(r"^OX\s+(.+)"); re_dr_pdb = re.compile(r"^DR\s+PDB;\s*([0-9A-Za-z]{4});"); re_ft_region = re.compile(r"^FT\s+REGION\s+(\d+)\.\.(\d+)\s+(.*)$", re.IGNORECASE)

    with open(uniprot_path, "r", encoding="utf-8", errors="ignore") as f: lines = f.readlines()
    records, cur, in_seq = [], {}, False
    for line in tqdm(lines, desc="Parsing UniProt", unit="line", dynamic_ncols=True):
        line = line.rstrip("\n")
        if line.startswith("//"): _push_current(records, cur); cur, in_seq = {}, False; continue
        if line.startswith("SQ "): in_seq, cur["amino_acid_sequence"] = True, ""; continue
        if in_seq:
            if line.startswith("  "): cur["amino_acid_sequence"] += re.sub(r"[^A-Za-z]", "", line); continue
            else: in_seq = False
        m = re_id.match(line)
        if m: cur["ID"] = m.group(1).strip(); continue
        m = re_ac.match(line)
        if m:
            parts = [p.strip() for p in m.group(1).strip().split(";") if p.strip()]
            if parts: cur.setdefault("Accession", []).extend(parts)
            continue
        m = re_de.match(line)
        if m: cur.setdefault("Description", []).append(m.group(1).strip()); continue
        m = re_os.match(line)
        if m: cur.setdefault("Organism", []).append(m.group(1).strip()); continue
        m = re_ox.match(line)
        if m: cur["Organism_ID"] = m.group(1).strip(); continue
        m = re_dr_pdb.match(line)
        if m: cur.setdefault("PDB", []).append(m.group(1).upper()); continue
        m = re_ft_region.match(line)
        if m:
            start, end, desc = m.groups()
            if "disordered" in desc.lower():
                try: cur.setdefault("IDR_regions", []).append((int(start), int(end)))
                except: pass
            continue
    if cur: _push_current(records, cur)
    return pd.DataFrame.from_records(records, columns=["ID", "Accession", "Description", "Organism", "Organism_ID", "amino_acid_sequence", "IDR_regions", "PDB"])

def download_and_extract(pdb_id: str):
    url = f"https://files.rcsb.org/download/{pdb_id}.cif.gz"
    target_dir = mmcif_divided_root / "mmCIF" / pdb_id[1:3]
    target_dir.mkdir(parents=True, exist_ok=True)
    local_gz, local_cif, tmp_path = target_dir / f"{pdb_id}.cif.gz", target_dir / f"{pdb_id}.cif", target_dir / f"{pdb_id}.part"
    for attempt in range(1, 4):
        try:
            with requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, stream=True, timeout=30) as r:
                if r.status_code == 404: return (pdb_id, False, "HTTP 404")
                r.raise_for_status()
                with open(tmp_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=1048576):
                        if chunk: f.write(chunk)
                tmp_path.replace(local_gz)
                with gzip.open(local_gz, "rb") as gz_in, open(local_cif, "wb") as f_out: shutil.copyfileobj(gz_in, f_out)
                local_gz.unlink()
                if local_cif.stat().st_size == 0: local_cif.unlink(); raise ValueError("Empty extracted file")
                return (pdb_id, True, "Success")
        except Exception as e: time.sleep(1); last_err = str(e)
    for p in [tmp_path, local_gz, local_cif]:
        if p.exists():
            try: p.unlink()
            except: pass
    return (pdb_id, False, last_err)

def split_mmcif_by_chain_wrapper(file_path: Path):
    structure_id = file_path.stem
    if list(mmcif_chain_root.glob(f"{structure_id}:*.cif")): return
    try:
        if FastMMCIFParser:
            parser = FastMMCIFParser(QUIET=True)
        else:
            parser = MMCIFParser(QUIET=True)
        st = parser.get_structure(structure_id, str(file_path))
        first_model = next(iter(st), None)
        if not first_model: return
        for chain in first_model:
            cid = str(chain.id)
            out_path = mmcif_chain_root / f"{structure_id}:{cid}.cif"
            if out_path.exists() and out_path.stat().st_size > 0: continue
            io = PDBIO(); io.set_structure(st); io.save(str(out_path), select=ChainSelect(cid))
    except: pass

def run_dssp_for_mmcif_wrapper(mmcif_path: Path):
    pdb_id = mmcif_path.stem
    dssp_path = Path(dssp_root) / f"{pdb_id}.dssp"
    if dssp_path.exists() and dssp_path.stat().st_size > 0: return "skip"
    try:
        subprocess.run(["mkdssp", "-i", str(mmcif_path), "-o", str(dssp_path)], check=True, capture_output=True, text=True, timeout=120)
        return "ok"
    except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
        if dssp_path.exists():
            try: dssp_path.unlink()
            except: pass
        return "error"
    except Exception: return "error"

def get_cb_or_ca_coord(residue):
    if "CB" in residue: return np.asarray(residue["CB"].get_coord(), dtype=float)
    if "CA" in residue: return np.asarray(residue["CA"].get_coord(), dtype=float)
    return None

def parse_dssp_to_df_with_ASA(dssp_path: str) -> pd.DataFrame:
    rows, parse = [], False
    with open(dssp_path) as f:
        for l in f:
            if l.startswith("  #  RESIDUE"): parse = True; continue
            if not parse or len(l) < 40: continue
            try: resnum = int(l[5:10].strip())
            except: continue
            chain, sec, asa = l[11].strip().upper(), l[16].strip(), l[34:38].strip()
            rows.append({"chain": chain, "resnum": resnum, "sec_struct": sec, "ASA_dssp": int(asa) if asa.isdigit() else np.nan})
    return pd.DataFrame(rows)

def global_asm_worker(args):
    pdb, ptm_reqs, mmcif_dir = args
    path = os.path.join(mmcif_dir, pdb.lower() + ".cif")
    try:
        if FastMMCIFParser:
            parser = FastMMCIFParser(QUIET=True)
        else:
            parser = MMCIFParser(QUIET=True)
        model = next(parser.get_structure(pdb, path).get_models())
    except Exception:
        return pdb, "Unknown", {}
    
    chain_data = {}
    for chain in model:
        coords, resnums = [], []
        for res in chain:
            c = get_cb_or_ca_coord(res)
            if c is not None: 
                coords.append(c)
                resnums.append(res.id[1])
        if coords: 
            chain_data[str(chain.id).strip().upper()] = (np.asarray(resnums, dtype=int), np.asarray(coords, dtype=float))
    
    asm = "Multimer" if len(chain_data) >= 2 else ("Monomer" if len(chain_data) == 1 else "Unknown")
    loc = {}
    for (ch, rn) in ptm_reqs:
        if ch not in chain_data or len(np.where(chain_data[ch][0] == rn)[0]) == 0: 
            loc[(ch, rn)] = "Unknown"
            continue
        ptm_coord = chain_data[ch][1][int(np.where(chain_data[ch][0] == rn)[0][0])]
        loc[(ch, rn)] = "Interface" if any(np.any(np.linalg.norm(ocoords - ptm_coord, axis=1) < 8.0) for och, (_, ocoords) in chain_data.items() if och != ch) else "Non-interface"
    return pdb, asm, loc

def global_dssp_worker(args):
    pdb, df_sub, dssp_dir, max_asa_dict = args
    dssp_file = os.path.join(dssp_dir, pdb.lower() + ".dssp")
    if not os.path.exists(dssp_file): return None
    dssp = parse_dssp_to_df_with_ASA(dssp_file)
    if dssp.empty: return None
    merged = pd.merge(df_sub, dssp, left_on=["pdb_chain", "pdb_pos"], right_on=["chain", "resnum"], how="left")
    asa = pd.to_numeric(merged["ASA_dssp"], errors="coerce")
    denom = merged["_base_aa1"].astype(str).map(max_asa_dict).astype(float)
    return merged[["orig_idx"]].assign(
        sec_struct=merged["sec_struct"].fillna("C").str.strip().replace({"": "C"}), 
        RSA_dssp=(asa / denom).where(~asa.isna(), 1.0).clip(upper=1.0).values
    )

def _to_list(x): return x if isinstance(x, list) else ([x] if x is not None else [])
def _safe_int(x) -> Optional[int]:
    try: return int(x)
    except: return None
def _norm_chain(chain: Any) -> str: return str(chain).strip()
def _norm_comp(comp: Any) -> str: return str(comp).strip().upper()

def extract_from_mmcif_one_pass(mmcif_file: str):
    seq_rows, modres_rows, resatom_rows, glyco_rows = [], [], [], []
    pdb_path = os.path.join(str(mmcif_root), mmcif_file)
    pdb_id = mmcif_file[:4].upper()
    try:
        cif_dict = MMCIF2Dict(pdb_path)
        if FastMMCIFParser:
            parser = FastMMCIFParser(QUIET=True)
        else:
            parser = MMCIFParser(QUIET=True)
        structure = parser.get_structure(pdb_id, pdb_path)

        has_modres_comp = "_pdbx_struct_mod_residue.label_comp_id" in cif_dict
        if has_modres_comp and "_pdbx_struct_mod_residue.details" in cif_dict:
            for chain, pos, modres, det in zip(_to_list(cif_dict.get("_pdbx_struct_mod_residue.auth_asym_id")), _to_list(cif_dict.get("_pdbx_struct_mod_residue.auth_seq_id")), _to_list(cif_dict.get("_pdbx_struct_mod_residue.label_comp_id")), _to_list(cif_dict.get("_pdbx_struct_mod_residue.details"))):
                chain_id = _norm_chain(chain)
                if not chain_id.isupper(): continue
                modres_rows.append({"pdb_id": pdb_id, "pdb_chain": chain_id, "pdb_pos": _safe_int(pos), "pdb_modres": _norm_comp(modres), "pdb_modres_details": det, "Case": 1})

        atom_asym, atom_seq, atom_comp, atom_name = _to_list(cif_dict.get("_atom_site.auth_asym_id")), _to_list(cif_dict.get("_atom_site.auth_seq_id")), _to_list(cif_dict.get("_atom_site.auth_comp_id")), _to_list(cif_dict.get("_atom_site.label_atom_id"))
        atom_index = {}
        if atom_asym and atom_seq and atom_comp and atom_name:
            for a, s, c, n in zip(atom_asym, atom_seq, atom_comp, atom_name):
                s_int = _safe_int(s)
                if s_int is not None: atom_index.setdefault((_norm_chain(a), s_int, _norm_comp(c)), []).append(str(n))

        roles = _to_list(cif_dict.get("_struct_conn.pdbx_role"))
        if roles:
            p1_asym, p1_seq, p1_comp = _to_list(cif_dict.get("_struct_conn.ptnr1_auth_asym_id")), _to_list(cif_dict.get("_struct_conn.ptnr1_auth_seq_id")), _to_list(cif_dict.get("_struct_conn.ptnr1_auth_comp_id"))
            p2_asym, p2_seq, p2_comp = _to_list(cif_dict.get("_struct_conn.ptnr2_auth_asym_id")), _to_list(cif_dict.get("_struct_conn.ptnr2_auth_seq_id")), _to_list(cif_dict.get("_struct_conn.ptnr2_auth_comp_id"))
            for i, role in enumerate(roles):
                if "Glyco" in str(role) and i < len(p1_comp) and _norm_comp(p1_comp[i]) == "ASN":
                    c_chain = _norm_chain(p1_asym[i])
                    if not c_chain.isupper(): continue
                    c_pos, g_type = _safe_int(p1_seq[i]), _norm_comp(p2_comp[i]) if i < len(p2_comp) else ""
                    if c_pos is None: continue
                    g_chain, g_pos = _norm_chain(p2_asym[i]) if i < len(p2_asym) else "", _safe_int(p2_seq[i]) if i < len(p2_seq) else None
                    g_atoms = atom_index.get((g_chain, g_pos, g_type), []) if g_chain and g_pos is not None else []
                    if not g_atoms:
                        for (a, s, c), atoms in atom_index.items():
                            if c == g_type: g_atoms.extend(atoms)
                    glyco_rows.append({"pdb_id": pdb_id, "pdb_chain": c_chain, "pdb_pos": c_pos, "pdb_restype": "ASN", "Glyco_type": g_type, "details": str(role), "glyco_atoms": list(dict.fromkeys(g_atoms))})

        model = next(iter(structure), None)
        if model:
            for chain in model:
                pdb_chain = chain.get_id()
                if not str(pdb_chain).isupper(): continue
                seq3, seq1, positions, pos_to_res = [], [], [], {}
                for residue in chain.get_unpacked_list():
                    resname = residue.get_resname().upper()
                    if resname == "HOH": continue
                    pdb_pos = residue.get_id()[1]
                    positions.append(pdb_pos)
                    one = RES3_TO_ONE.get(resname, "X")
                    seq3.append(resname); seq1.append(one)
                    pos_to_res.setdefault(pdb_pos, (resname, one))
                    resatom_rows.append({"pdb_id": pdb_id, "pdb_chain": pdb_chain, "pdb_pos": pdb_pos, "pdb_restype": resname, "pdb_modres_details": "PTM" if resname in PTM_TRUE_CODES else "notPTM", "Case": 2 if has_modres_comp else 3, "atom_types": list(dict.fromkeys([atom.get_name() for atom in residue.get_unpacked_list()]))})
                    if resname in PTM_TRUE_CODES: modres_rows.append({"pdb_id": pdb_id, "pdb_chain": pdb_chain, "pdb_pos": pdb_pos, "pdb_modres": resname, "pdb_modres_details": "Unknown", "Case": 2 if has_modres_comp else 3})
                if positions:
                    s_pos, e_pos = min(positions), max(positions)
                    s3_g, s1_g = [], []
                    for p in range(s_pos, e_pos + 1):
                        if p in pos_to_res: r3, r1 = pos_to_res[p]
                        else: r3, r1 = "GAP", "-"
                        s3_g.append(r3); s1_g.append(r1)
                    seq_rows.append({"pdb_id": pdb_id, "pdb_chain": pdb_chain, "sequence_3": "-".join(s3_g), "sequence_1": "".join(s1_g), "start_pdb_pos": s_pos, "end_pdb_pos": e_pos})
    except Exception: pass
    return seq_rows, modres_rows, resatom_rows, glyco_rows

def is_polymer_token(tok: str) -> bool: return tok in AA3_TO_AA1 or tok in MOD_TO_AA1
def map_mod_to_aa1(tok: str, ch: str) -> str: return MOD_TO_AA1[tok] if ch == UNKNOWN_CHAR and tok in MOD_TO_AA1 else ch

def drop_tail_and_map_general(row):
    val1, val3 = row['sequence_1'], row['sequence_3']
    if pd.isna(val1) or pd.isna(val3): return val1
    letters, tokens = list(str(val1).replace(" ", "")), [t.strip().upper() for t in str(val3).split('-') if t]
    if not tokens: return ''.join(letters)
    k = 0
    while k < len(tokens) and tokens[k] in FRONT_STRIP_TOKENS: k += 1
    if k: tokens, letters = tokens[k:], letters[k:]
    if not tokens or not letters: return ''
    n = min(len(letters), len(tokens))
    end = n - 1
    while end >= 0 and not is_polymer_token(tokens[end]): end -= 1
    if end < 0: return ''
    out = []
    for i in range(end + 1):
        tok, ch = tokens[i], letters[i]
        if not is_polymer_token(tok): out.append(AA1_GAP_CHAR if ch == UNKNOWN_CHAR and tok in INTERNAL_TO_DOT else ch)
        else: out.append(map_mod_to_aa1(tok, ch))
    if len(letters) > n: out.extend(letters[n:])
    return ''.join(out)

def parse_atom_types(x):
    if isinstance(x, list): return [str(t).strip().upper() for t in x if str(t).strip()]
    if not x or str(x).lower() == 'nan': return []
    try:
        v = ast.literal_eval(str(x))
        if isinstance(v, list): return [str(t).strip().strip("'").strip('"').upper() for t in v if str(t).strip()]
    except: pass
    return [tok.strip().strip("'").strip('"').upper() for tok in str(x).strip("[]").split(",") if tok.strip()]

def norm_str(v): return None if pd.isna(v) or not str(v).strip() else str(v).strip()
def norm_int(v): return None if pd.isna(v) or not str(v).strip() else int(float(str(v).strip()))
def norm_float(v): return None if pd.isna(v) or not str(v).strip() else float(str(v).strip())


# =====================================================================
# [MAIN] 전체 파이프라인 실행 로직
# =====================================================================
def main():
    for path in [uniprot_root, mmcif_root, mmcif_chain_root, dssp_root, uniprot_csv_path.parent, Path(inter_sequence_df_path).parent]:
        path.mkdir(parents=True, exist_ok=True)

    # -----------------------------------------------------------------
    # [PRE-CHECK] 웹 서비스용 업데이트 날짜 즉시 기록
    # -----------------------------------------------------------------
    try:
        date_file = "/home/bis/230711_JSG/241125_PTM/250818_webservice/backend/snapshot_date.txt"
        os.makedirs(os.path.dirname(date_file), exist_ok=True)
        now_str = datetime.datetime.now(pytz.timezone('Asia/Seoul')).strftime('%Y-%m-%d')
        with open(date_file, "w") as f:
            f.write(now_str)
        print(f"\n[INFO] 웹서비스용 업데이트 날짜({now_str})가 성공적으로 기록되었습니다.")
    except Exception as e:
        print(f"\n[ERROR] 날짜 기록 중 오류 발생: {e}")

    # -----------------------------------------------------------------
    # [PHASE 1] UNIPROT & SIFTS PREP
    # -----------------------------------------------------------------
    print("\n" + "="*60)
    print(" [PHASE 1] UniProt & SIFTS 데이터 준비 (항상 최신화)")
    print("="*60)

    targets = [
        ("https://ftp.uniprot.org/pub/databases/uniprot/current_release/knowledgebase/complete/uniprot_sprot.dat.gz", uniprot_root / "uniprot_sprot.dat.gz"),
        ("https://ftp.ebi.ac.uk/pub/databases/msd/sifts/flatfiles/csv/pdb_chain_uniprot.csv.gz", uniprot_root / "pdb_chain_uniprot.csv.gz"),
        ("https://ftp.ebi.ac.uk/pub/databases/msd/sifts/flatfiles/csv/uniprot_pdb.csv.gz", uniprot_root / "uniprot_pdb.csv.gz"),
    ]

    for url, dest in targets:
        print(f"-> Downloading (Always) {dest.name}...")
        download_with_progress(url, dest)

    gz_list = list(uniprot_root.glob("*.gz"))
    for gz_path in gz_list:
        dest_path = gz_path.with_suffix("")
        print(f"-> Extracting (Always) {gz_path.name}...")
        with gzip.open(gz_path, "rb") as f_in, open(dest_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

    uniprot_dat_path = uniprot_root / "uniprot_sprot.dat"
    print("[PROCESS] UniProt DAT 파싱 및 CSV 변환 중 (항상 최신화)...")
    swiss_prot_df = parse_uniprot_sprot_func(uniprot_dat_path)
    swiss_prot_df = swiss_prot_df.dropna(subset=["amino_acid_sequence"]).dropna()
    swiss_prot_df.to_csv(uniprot_csv_path, index=False)
    print("[SUCCESS] UniProt 파싱 완료")


    # -----------------------------------------------------------------
    # [PHASE 2] PDB DOWNLOAD & FLATTEN
    # -----------------------------------------------------------------
    print("\n" + "="*60)
    print(" [PHASE 2] PDB(mmCIF) 동기화 및 Flatten")
    print("="*60)

    all_ids = set(pid.lower() for pid in requests.get(PDB_API_URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=30).json())
    local_ids = {p.stem.lower() for p in mmcif_root.rglob("*.cif") if p.stat().st_size > 0}
    missing_ids = list(all_ids - local_ids)

    print(f" - 전체 대상: {len(all_ids):,}, 로컬 보유: {len(local_ids):,}, 신규 대상: {len(missing_ids):,}")
    if missing_ids:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            list(tqdm(ex.map(download_and_extract, missing_ids), total=len(missing_ids), desc="Downloading mmCIF"))

    files_to_move = list(mmcif_divided_root.rglob("*.cif"))
    if files_to_move:
        for src in tqdm(files_to_move, desc="Flatten move", unit="file", dynamic_ncols=True):
            dst = mmcif_root / src.name
            if dst.exists():
                if dst.stat().st_size == src.stat().st_size and abs(dst.stat().st_mtime - src.stat().st_mtime) < 2.0: continue
                tmp = mmcif_root / (src.name + ".incoming")
                if tmp.exists(): tmp.unlink()
                shutil.move(str(src), str(tmp)); tmp.replace(dst)
            else:
                shutil.move(str(src), str(dst))


    # -----------------------------------------------------------------
    # [PHASE 3] CHAIN SPLIT & DSSP
    # -----------------------------------------------------------------
    print("\n" + "="*60)
    print(" [PHASE 3] 체인 분할 및 DSSP 2차 구조 계산")
    print("="*60)

    all_mmcifs = list(mmcif_root.glob("*.cif"))
    done_struct_ids = {p.stem.split(":", 1)[0] for p in mmcif_chain_root.glob("*.cif") if ":" in p.name and p.stat().st_size > 0}
    queue_chains = [p for p in all_mmcifs if p.stem not in done_struct_ids]
    if queue_chains:
        with ProcessPoolExecutor(max_workers=MAX_WORKERS) as ex:
            list(tqdm(ex.map(split_mmcif_by_chain_wrapper, queue_chains), total=len(queue_chains), desc="Split Chains"))

    done_dssp_ids = {p.stem for p in Path(dssp_root).glob("*.dssp") if p.stat().st_size > 0}
    queue_dssps = [p for p in all_mmcifs if p.stem not in done_dssp_ids]
    if queue_dssps:
        with ProcessPoolExecutor(max_workers=MAX_WORKERS) as ex:
            list(tqdm(ex.map(run_dssp_for_mmcif_wrapper, queue_dssps, chunksize=100), total=len(queue_dssps), desc="mkdssp"))


    # -----------------------------------------------------------------
    # [PHASE 4] FEATURE EXTRACTION
    # -----------------------------------------------------------------
    print("\n" + "="*60)
    print(" [PHASE 4] Feature Extraction (PTM, Sequence, Structure)")
    print("="*60)

    if os.path.exists(inter_sequence_df_path): inter_sequence_df = pd.read_csv(inter_sequence_df_path)
    else: inter_sequence_df = pd.DataFrame(columns=["PDB_ID", "chain_ID", "1_letter_expressed_sequence"])

    if os.path.exists(inter_PTM_SD_df_path): inter_PTM_SD_df = pd.read_csv(inter_PTM_SD_df_path)
    else: inter_PTM_SD_df = pd.DataFrame()

    if os.path.exists(inter_StrucPTM_df_path): inter_StrucPTM_df = pd.read_csv(inter_StrucPTM_df_path)
    else: inter_StrucPTM_df = pd.DataFrame()

    seq_id_set = set(inter_sequence_df['PDB_ID'].dropna().astype(str).str.strip().str.lower().unique())
    mmcifs = os.listdir(mmcif_root)
    target_cifs = [p for p in mmcifs if os.path.splitext(p)[0].strip().lower() not in seq_id_set and p.endswith(".cif")]
    print(f"Target structures to process: {len(target_cifs)} / {len(mmcifs)}")

    if target_cifs:
        all_seq, all_modres, all_resatoms, all_glyco = [], [], [], []
        with ProcessPoolExecutor(max_workers=MAX_WORKERS) as ex:
            for sq, md, ra, gl in tqdm(ex.map(extract_from_mmcif_one_pass, target_cifs), total=len(target_cifs), desc="Extract Features"):
                all_seq.extend(sq); all_modres.extend(md); all_resatoms.extend(ra); all_glyco.extend(gl)

        new_seq_df = pd.DataFrame(all_seq)
        if not new_seq_df.empty:
            pat = r'(^|-)(?:' + '|'.join(sorted(map(re.escape, set(AA3_TO_AA1.keys()) | set(MOD_TO_AA1.keys()) | NONRES_TOKENS))) + r')(-|$)'
            mask = new_seq_df['sequence_3'].str.contains(pat, na=False)
            new_seq_df.loc[mask, 'sequence_1'] = new_seq_df.loc[mask].apply(drop_tail_and_map_general, axis=1)
            new_seq_df = new_seq_df.rename(columns={"pdb_id": "PDB_ID", "pdb_chain": "chain_ID", "sequence_1": "1_letter_expressed_sequence"})
        
        new_ptm_sd = pd.DataFrame(all_modres)
        if not new_ptm_sd.empty:
            new_ptm_sd = new_ptm_sd.dropna(subset=["pdb_id", "pdb_chain", "pdb_pos", "pdb_modres", "pdb_modres_details"])
            new_ptm_sd = new_ptm_sd[~((new_ptm_sd["pdb_modres"].str.upper() == "MSE") | (new_ptm_sd["pdb_modres_details"].str.upper().str.strip() == "SELENOMETHIONINE"))]
            new_ptm_sd["pdb_pos"] = pd.to_numeric(new_ptm_sd["pdb_pos"], errors="coerce").astype("Int64")
            new_ptm_sd = new_ptm_sd.dropna(subset=["pdb_pos"])
            ptm_sd_table = pd.read_csv(ptm_sd_table_path)
            mod_to_ann = dict(zip(ptm_sd_table["MODRES comment"].str.strip(), ptm_sd_table["PTM-SD annotation"].str.strip().replace({"O-linked Glycosylation": "Glycosylation"})))
            new_ptm_sd["PTM_SD_annotation"] = new_ptm_sd["pdb_modres_details"].map(mod_to_ann).fillna("Unknown")

        resatoms_df = pd.DataFrame(all_resatoms)
        glyco_df = pd.DataFrame(all_glyco)
        diff_df = pd.read_csv(diff_df_path)
        map_df = pd.read_csv(pdb_chain_uniprot_csv_path, comment="#")[["PDB", "CHAIN", "SP_PRIMARY"]].dropna()
        map_df["pdb_id_chain"] = map_df["PDB"].str.upper() + ":" + map_df["CHAIN"].str.upper()
        chain_to_uniprot = map_df.set_index("pdb_id_chain")["SP_PRIMARY"].to_dict()

        if not resatoms_df.empty:
            resatoms_df = resatoms_df[resatoms_df["pdb_restype"].str.upper() != "MSE"].copy()
            resatoms_df["atom_types"] = resatoms_df["atom_types"].apply(parse_atom_types)
            ptm_to_added_atoms = {r["PTM Residue"].strip().upper(): set([a.strip().upper() for a in r["Common Added Atoms"].split(",") if a.strip()]) for _, r in diff_df.dropna(subset=["Common Added Atoms"]).iterrows()}
            
            resatoms_df["Updated_annotation"] = np.nan
            valid_ptm = set(ptm_to_added_atoms.keys()) & set(PTM_rescode_to_annotation.keys()) & set(resatoms_df["pdb_restype"].unique())
            for ptm_code in valid_ptm:
                mask_ptm = (resatoms_df["pdb_restype"] == ptm_code)
                ok_mask = resatoms_df.loc[mask_ptm, "atom_types"].apply(lambda xs: ptm_to_added_atoms[ptm_code].issubset(set(xs)))
                resatoms_df.loc[resatoms_df.loc[mask_ptm].index[ok_mask], "Updated_annotation"] = PTM_rescode_to_annotation[ptm_code]
            
            non_gly = resatoms_df[resatoms_df["Updated_annotation"].notna()].copy()
            non_gly["pdb_id_chain"] = non_gly["pdb_id"] + ":" + non_gly["pdb_chain"]
            non_gly = non_gly.rename(columns={"Updated_annotation": "annotation"})[["pdb_id_chain", "pdb_pos", "pdb_restype", "annotation"]]
            
            out = non_gly
            if not glyco_df.empty:
                glyco_df["pdb_id_chain"] = glyco_df["pdb_id"] + ":" + glyco_df["pdb_chain"]
                glyco_df["annotation"] = "Glycosylation"
                out = pd.concat([non_gly, glyco_df[["pdb_id_chain", "pdb_pos", "pdb_restype", "annotation"]]], ignore_index=True)
            
            out["pdb_pos"] = pd.to_numeric(out["pdb_pos"], errors="coerce").astype("Int64")
            out = out.dropna(subset=["pdb_pos"]).drop_duplicates()
            out["pdb_id"] = out["pdb_id_chain"].astype(str).str[:4]
            out["pdb_chain"] = out["pdb_id_chain"].astype(str).str[5:]
            out["UniProt_Accession_code"] = out["pdb_id_chain"].map(chain_to_uniprot)
            out = out.merge(swiss_prot_df[["Accession", "Organism"]].drop_duplicates(), left_on="UniProt_Accession_code", right_on="Accession", how="left").drop(columns=["Accession"])
            out["base_residue_name"] = out["pdb_restype"].str.upper().map(lambda x: ptm_to_canonical_3code.get(x, x)).map(lambda x: THREE_TO_FULLNAME.get(x, x))

            out["Assembly_type"], out["Location"] = "Unknown", "Unknown"
            ptm_map = {}
            for idx, r in out.iterrows(): ptm_map.setdefault(r["pdb_id"], {}).setdefault((r["pdb_chain"], int(r["pdb_pos"])), []).append(idx)
            
            asm_tasks = [(pdb, list(reqs.keys()), str(mmcif_root)) for pdb, reqs in ptm_map.items()]
            with ProcessPoolExecutor(max_workers=MAX_WORKERS) as exe:
                for pdb, asm, locs in tqdm(exe.map(global_asm_worker, asm_tasks), total=len(asm_tasks), desc="Annotate Assembly (Fast)"):
                    for (ch, rn), idxs in ptm_map[pdb].items():
                        for idx in idxs: 
                            out.at[idx, "Assembly_type"] = asm
                            out.at[idx, "Location"] = locs.get((ch, rn), "Unknown")

            out["Secondary_structure"], out["RSA"], out["_base_aa1"], out["orig_idx"] = np.nan, np.nan, out["base_residue_name"].map(FULLNAME_TO_1), out.index
            dssp_tasks = [(pdb, out[out["pdb_id"]==pdb][["pdb_chain", "pdb_pos", "orig_idx", "_base_aa1"]], str(dssp_root), max_ASA) for pdb in out["pdb_id"].unique()]
            with ProcessPoolExecutor(max_workers=MAX_WORKERS) as exe:
                updates = [r for r in tqdm(exe.map(global_dssp_worker, dssp_tasks), total=len(dssp_tasks), desc="Annotate DSSP (Fast)") if r is not None]
                
            if updates:
                u = pd.concat(updates, ignore_index=True)
                out.loc[u["orig_idx"], "Secondary_structure"] = u["sec_struct"].values
                out.loc[u["orig_idx"], "RSA"] = u["RSA_dssp"].values
            
            out = out.rename(columns={"pdb_id": "PDB_ID", "pdb_chain": "chain_ID", "pdb_pos": "residue_number", "pdb_restype": "3_letter_residue_code", "annotation": "PTM_type_annotation"}).drop(columns=["_base_aa1", "orig_idx"], errors="ignore")
            new_struc_df = out
        else:
            new_struc_df = pd.DataFrame()
            
        sequence_df = pd.concat([new_seq_df, inter_sequence_df], ignore_index=True)
        sequence_df = sequence_df[sequence_df["1_letter_expressed_sequence"].notna() & (sequence_df["1_letter_expressed_sequence"].str.strip() != "")]
        sequence_df = sequence_df.assign(_len=sequence_df["1_letter_expressed_sequence"].str.len()).sort_values("_len", ascending=False).drop_duplicates(["PDB_ID", "chain_ID"]).drop(columns="_len").reset_index(drop=True)
        
        PTM_SD_df = pd.concat([new_ptm_sd, inter_PTM_SD_df], ignore_index=True).drop_duplicates().reset_index(drop=True)
        StrucPTM_df = pd.concat([new_struc_df, inter_StrucPTM_df], ignore_index=True).drop_duplicates().reset_index(drop=True)
        
    else:
        print("[INFO] No new structures to process. Using intermediates directly.")
        sequence_df = inter_sequence_df
        PTM_SD_df = inter_PTM_SD_df
        StrucPTM_df = inter_StrucPTM_df


    # -----------------------------------------------------------------
    # [PHASE 5] ALIGNMENT & HOMOLOG GROUPING
    # -----------------------------------------------------------------
    print("\n" + "="*60)
    print(" [PHASE 5] Alignment & Homolog Grouping")
    print("="*60)

    map_df = pd.read_csv(pdb_chain_uniprot_csv_path, comment="#")[["PDB", "CHAIN", "SP_PRIMARY"]].dropna()
    map_df["pdb_id_chain"] = map_df["PDB"].str.upper() + ":" + map_df["CHAIN"].str.upper()
    u_dict = map_df.dropna(subset=["SP_PRIMARY"]).groupby("SP_PRIMARY")["pdb_id_chain"].apply(lambda s: sorted(set(s.astype(str)))).to_dict()

    StrucPTM_df["PDB_IDs_from_identical_UniProt_Accession_code"] = StrucPTM_df["UniProt_Accession_code"].map(u_dict).apply(lambda x: ", ".join(x) if isinstance(x, list) else "")

    seq_map = (sequence_df["PDB_ID"].str.upper() + ":" + sequence_df["chain_ID"].str.upper()).to_frame(name="__key__").assign(__seq__=sequence_df["1_letter_expressed_sequence"]).set_index("__key__")["__seq__"].to_dict()
    StrucPTM_df["__key__"] = StrucPTM_df["PDB_ID"].str.upper() + ":" + StrucPTM_df["chain_ID"].str.upper()

    os.makedirs("./align_df_ckpt", exist_ok=True)
    
    sorted_map = pickle.load(open("./align_df_ckpt/sorted_map.pkl", "rb")) if os.path.exists("./align_df_ckpt/sorted_map.pkl") else {}
    done_keys = pickle.load(open("./align_df_ckpt/done_keys.pkl", "rb")) if os.path.exists("./align_df_ckpt/done_keys.pkl") else set()
    meta_by_key = pickle.load(open("./align_df_ckpt/meta_by_key.pkl", "rb")) if os.path.exists("./align_df_ckpt/meta_by_key.pkl") else {}

    tasks = []
    for key in tqdm(StrucPTM_df["__key__"].dropna().unique(), desc="Build Align Tasks"):
        if not seq_map.get(key): continue
        
        group = StrucPTM_df.loc[StrucPTM_df["__key__"]==key, "PDB_IDs_from_identical_UniProt_Accession_code"].iloc[0]
        if not group: 
            done_keys.add(key)
            meta_by_key[key] = ""
            continue
            
        cands = sorted([c.strip() for c in group.split(",") if c.strip() != key and seq_map.get(c.strip())])
        cand_str = ",".join(cands)
        
        old_meta = meta_by_key.get(key)
        
        if key in done_keys and old_meta == cand_str:
            continue
            
        if key in done_keys and isinstance(old_meta, dict):
            meta_by_key[key] = cand_str
            continue
            
        if cands: 
            tasks.append((key, seq_map[key], [(c, seq_map[c]) for c in cands], cand_str))
        else:
            done_keys.add(key)
            meta_by_key[key] = cand_str

    if tasks:
        m = mp.Manager()
        sema = m.Semaphore(2)
        
        with mp.Pool(MAX_WORKERS, initializer=pool_init, initargs=(sema,)) as pool:
            save_interval = 2000
            processed = 0
            for key, res, c_str in tqdm(pool.imap_unordered(_worker_align, tasks, chunksize=1), total=len(tasks), desc="Aligning (Safe Mode)"):
                sorted_map[key] = res
                done_keys.add(key)
                meta_by_key[key] = c_str
                processed += 1
                
                if processed % save_interval == 0:
                    with open("./align_df_ckpt/sorted_map.pkl", "wb") as f: pickle.dump(sorted_map, f)
                    with open("./align_df_ckpt/done_keys.pkl", "wb") as f: pickle.dump(done_keys, f)
                    with open("./align_df_ckpt/meta_by_key.pkl", "wb") as f: pickle.dump(meta_by_key, f)
                    
        with open("./align_df_ckpt/sorted_map.pkl", "wb") as f: pickle.dump(sorted_map, f)
        with open("./align_df_ckpt/done_keys.pkl", "wb") as f: pickle.dump(done_keys, f)
        with open("./align_df_ckpt/meta_by_key.pkl", "wb") as f: pickle.dump(meta_by_key, f)

    StrucPTM_df["scores_filtered"] = StrucPTM_df["__key__"].map(lambda k: ", ".join([f"{pc}|{sc:.4f}" for pc, sc in sorted_map.get(k, []) if sc >= 0.75]) if k in sorted_map else "")
    StrucPTM_df = StrucPTM_df.drop(columns=["__key__"])
    if "RSA" in StrucPTM_df.columns:
        StrucPTM_df["RSA"] = StrucPTM_df["RSA"].clip(upper=1.0)

    # Save Files
    sequence_df.to_csv(inter_sequence_df_path, index=False)
    sequence_df.to_csv(sequence_df_path, index=False)
    sequence_df.to_csv(MYSQL_SEQ_CSV, index=False)

    PTM_SD_df.to_csv(inter_PTM_SD_df_path, index=False)
    PTM_SD_df.to_csv(PTM_SD_df_path, index=False)

    StrucPTM_df.to_csv(inter_StrucPTM_df_path, index=False)
    StrucPTM_df.to_csv(StrucPTM_df_path, index=False)
    StrucPTM_df.to_csv(MYSQL_PTM_CSV, index=False)


    # -----------------------------------------------------------------
    # [PHASE 6] MYSQL ZERO-DOWNTIME INSERTION
    # -----------------------------------------------------------------
    print("\n" + "="*60)
    print(" [PHASE 6] MySQL Zero-Downtime Insertion")
    print("="*60)

    conn = pymysql.connect(host=DB_HOST, user=DB_USER, password=DB_PASS, db=DB_NAME, charset="utf8mb4", autocommit=False)
    try:
        with conn.cursor() as cur:
            print("[DB] TRUNCATE TABLE sequence_data_ext ...")
            cur.execute("TRUNCATE TABLE sequence_data_ext;")
            sql_seq = "INSERT INTO sequence_data_ext (pdb_id, chain_id, seq_aa1) VALUES (%s, %s, %s)"
            tot = 0
            for chunk in pd.read_csv(MYSQL_SEQ_CSV, chunksize=50000):
                batch = [(norm_str(r.get("PDB_ID")), norm_str(r.get("chain_ID")), norm_str(r.get("1_letter_expressed_sequence"))) for _, r in chunk.iterrows() if norm_str(r.get("PDB_ID"))]
                if batch: cur.executemany(sql_seq, batch); tot += len(batch)
            conn.commit()
            print(f"[SUCCESS] Sequence Inserted: {tot:,}")

            print("[DB] TRUNCATE TABLE ptm_data_ext ...")
            cur.execute("TRUNCATE TABLE ptm_data_ext;")
            sql_ptm = "INSERT INTO ptm_data_ext (pdb_id, chain_id, uniprot_acc, organism, residue_no, res3, residue_name, ptm_type, assembly_type, location, secondary_structure, rsa, related_pdb_chains_from_SIFTS) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            tot = 0
            for chunk in pd.read_csv(MYSQL_PTM_CSV, chunksize=50000):
                batch = []
                for _, r in chunk.iterrows():
                    pid = norm_str(r.get("PDB_ID"))
                    if not pid: continue
                    batch.append((pid[:4], norm_str(r.get("chain_ID")), norm_str(r.get("UniProt_Accession_code")), norm_str(r.get("Organism")), norm_int(r.get("residue_number")), norm_str(r.get("3_letter_residue_code"))[:3] if norm_str(r.get("3_letter_residue_code")) else None, norm_str(r.get("base_residue_name")), norm_str(r.get("PTM_type_annotation")), norm_str(r.get("Assembly_type")), norm_str(r.get("Location")), norm_str(r.get("Secondary_structure"))[:1] if norm_str(r.get("Secondary_structure")) else None, norm_float(r.get("RSA")), norm_str(r.get("scores_filtered"))))
                if batch: cur.executemany(sql_ptm, batch); tot += len(batch)
            conn.commit()
            print(f"[SUCCESS] PTM Inserted: {tot:,}")
            
    except Exception as e:
        print("[ERROR] Error occurred, rolling back.", e)
        conn.rollback()
    finally:
        conn.close()
        print("\n[FINISHED] MySQL connection closed. Pipeline Complete!")

if __name__ == "__main__":
    main()

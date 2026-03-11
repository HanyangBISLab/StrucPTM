#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import subprocess

# =====================================================================
# 🚀 0. CONDA ENVIRONMENT BOOTSTRAP 
# =====================================================================
TARGET_ENV = "strucptm"
current_env = os.environ.get("CONDA_DEFAULT_ENV")

if current_env != TARGET_ENV and os.environ.get("STRUCPTM_BOOTSTRAPPED") != "1":
    print(f"🔄 [BOOTSTRAP] 현재 환경은 '{current_env}'입니다. 안전한 '{TARGET_ENV}' 환경으로 전환을 시도합니다...")
    try:
        env_list = subprocess.run(["conda", "env", "list"], capture_output=True, text=True, check=True).stdout
        conda_base = subprocess.run(["conda", "info", "--base"], capture_output=True, text=True).stdout.strip()
        
        if TARGET_ENV not in env_list:
            print(f"🛠️ [BOOTSTRAP] '{TARGET_ENV}' 방을 만듭니다 (순수 Python 3.10 초고속 생성)...")
            subprocess.run(["conda", "create", "-n", TARGET_ENV, "python=3.10", "-y"], check=True)
            
            print(f"📦 [BOOTSTRAP] 무한 로딩 방지를 위해 'pip'로 필수 패키지를 고속 설치합니다...")
            env_pip = os.path.join(conda_base, "envs", TARGET_ENV, "bin", "pip")
            subprocess.run([env_pip, "install", "numpy<2", "pandas", "biopython", "pymysql", "tqdm", "requests", "pytz"], check=True)
            print(f"✅ [BOOTSTRAP] '{TARGET_ENV}' 환경 쾌속 생성 및 패키지 세팅 완료!")
        
        env_python = os.path.join(conda_base, "envs", TARGET_ENV, "bin", "python")
        print(f"🚀 [BOOTSTRAP] 안전한 환경에서 스크립트를 재시작합니다!\n" + "="*60)
        
        run_env = os.environ.copy()
        run_env["CONDA_DEFAULT_ENV"] = TARGET_ENV
        run_env["STRUCPTM_BOOTSTRAPPED"] = "1"
        sys.exit(subprocess.call([env_python] + sys.argv, env=run_env))
        
    except Exception as e:
        print(f"❌ [BOOTSTRAP] 환경 전환 중 오류가 발생했습니다: {e}")
        sys.exit(1)

# =====================================================================
# ⬇️ 본 스크립트 시작
# =====================================================================
import re
import math
import ast
import json
import gzip
import time
import shutil
import pickle
import urllib.request
import requests
import hashlib
import datetime
import warnings
from pathlib import Path
from urllib.parse import urlparse, urljoin
from collections import defaultdict
from typing import List, Tuple, Dict, Optional, Set

import pytz
import numpy as np
import pandas as pd
from tqdm import tqdm
import pymysql

import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed

from Bio.PDB import MMCIFParser, FastMMCIFParser, PDBIO, Select
from Bio.PDB.MMCIF2Dict import MMCIF2Dict
from Bio import pairwise2

warnings.filterwarnings("ignore")

# =====================================================================
# ⚙️ 1. GLOBAL CONFIGURATION & DICTIONARIES
# =====================================================================
class CONFIG:
    DATA_ROOT = "/data1/JSG"
    MMCIF_ROOT = f"{DATA_ROOT}/mmcifs"
    MMCIF_CHAIN_ROOT = f"{DATA_ROOT}/mmcif_chains"
    DSSP_ROOT = f"{DATA_ROOT}/DSSP"
    UNIPROT_ROOT = f"{DATA_ROOT}/UniProt"
    
    UNIPROT_DAT = f"{UNIPROT_ROOT}/uniprot_sprot.dat"
    UNIPROT_CSV = f"{DATA_ROOT}/251106_new_PTM_summary/uniprot_sprot.csv"
    SIFTS_CSV = f"{UNIPROT_ROOT}/pdb_chain_uniprot.csv"
    
    INTER_DIR = f"{DATA_ROOT}/251106_new_PTM_summary/intermediate"
    INTER_SEQ = f"{INTER_DIR}/251218_sequence_df.csv"
    INTER_STRUC = f"{INTER_DIR}/251218_StrucPTM_df.csv"
    
    FINAL_SEQ = f"{DATA_ROOT}/251106_new_PTM_summary/251218_sequence_df.csv"
    FINAL_STRUC = f"{DATA_ROOT}/251106_new_PTM_summary/251218_StrucPTM_df.csv"
    
    DIFF_CSV = f"{DATA_ROOT}/251106_new_PTM_summary/PTM_added_atoms.csv"
    PTM_SD_CORR_CSV = f"{DATA_ROOT}/251106_new_PTM_summary/PTM-SD_correpondence_table.csv"
    
    ALIGN_CKPT_DIR = f"{DATA_ROOT}/251106_new_PTM_summary/align_df_ckpt"
    DATE_FILE = "/home/bis/230711_JSG/241125_PTM/250818_webservice/backend/snapshot_date.txt"

    WORKERS = 32
    MAX_DOWNLOAD_WORKERS = 16
    IDENTITY_MIN = 0.8
    SCORING_PRESET = dict(match=1.0, mismatch=-1.0, gap_open=-5.0, gap_extend=-1.0)
    ALIGN_CHUNKSIZE = 1

THREE_TO_ONE = {"ALA":"A", "CYS":"C", "ASP":"D", "GLU":"E", "PHE":"F", "GLY":"G", "HIS":"H", "ILE":"I", "LYS":"K", "LEU":"L", "MET":"M", "ASN":"N", "PRO":"P", "GLN":"Q", "ARG":"R", "SER":"S", "THR":"T", "VAL":"V", "TRP":"W", "TYR":"Y", "SEC":"U", "PYL":"O", "ASX":"B", "GLX":"Z", "UNK":"X", "MSE":"M"}
PTM_TO_BASE_1 = {"MLY":"K", "SMC":"C", "M3L":"K", "MLZ":"K", "MEN":"N", "HIC":"H", "MHS":"H", "AGM":"R", "MGN":"Q", "MEA":"E", "CMT":"C", "SEP":"S", "TPO":"T", "PTR":"Y", "HYP":"P", "LYZ":"K", "CSO":"C", "OMT":"M", "KCX":"K", "PCA":"Q", "CGU":"E", "ALY":"K", "SAC":"S", "AYA":"A", "FME":"M", "TYS":"Y", "NIY":"Y", "SNC":"C"}
RES3_TO_ONE = {**THREE_TO_ONE, **PTM_TO_BASE_1}
STANDARD_AA3 = set(THREE_TO_ONE.keys())

EXTRACTED_PTMS = {'Glycosylation':{'ASN':20642,'SER':493,'THR':333}, 'Methylation':{'MLY':5603,'SMC':257,'M3L':221,'MLZ':146,'MEN':131,'HIC':120,'MME':82,'MHS':43,'AGM':40,'MGN':38,'MEA':32,'CMT':10,'PHE':1}, 'Phosphorylation':{'SEP':1194,'TPO':973,'PTR':773,'PHD':37}, 'Hydroxylation':{'HYP':1422,'LYZ':40,'BHD':8,'ARO':4,'AHB':4}, 'Oxidation':{'CSO':904,'OMT':28}, 'N6-carboxylysine':{'KCX':896}, 'Pyrrolidone carboxylic acid':{'PCA':634}, 'Gamma-carboxyglutamic acid':{'CGU':496}, 'Formylation':{'FME':291}, 'Acetylation':{'ALY':169,'SAC':78,'AYA':36}, 'Sulfation':{'TYS':234}, 'Nitration':{'NIY':49}, 'S-Nitrosylation':{'SNC':35}, 'Bromination':{'BTR':1}}
PTM_RESIDUE_CODES = sorted({str(res).upper() for mods in EXTRACTED_PTMS.values() for res in mods.keys()})
PTM_TRUE_CODES = {code for code in PTM_RESIDUE_CODES if code not in STANDARD_AA3}
PTM_RESCODE_TO_ANNOTATION = {'MLY':'Methylation','SMC':'Methylation','M3L':'Methylation','MLZ':'Methylation','MEN':'Methylation','HIC':'Methylation','MHS':'Methylation','AGM':'Methylation','MGN':'Methylation','MEA':'Methylation','CMT':'Methylation','SEP':'Phosphorylation','TPO':'Phosphorylation','PTR':'Phosphorylation','HYP':'Hydroxylation','LYZ':'Hydroxylation','CSO':'Oxidation','OMT':'Oxidation','KCX':'N6-carboxylysine','PCA':'Pyrrolidone carboxylic acid','CGU':'Gamma-carboxyglutamic acid','ALY':'Acetylation','SAC':'Acetylation','AYA':'Acetylation','FME':'Formylation','TYS':'Sulfation','NIY':'Nitration','SNC':'S-Nitrosylation'}
PTM_TO_CANONICAL_3CODE = {'MLY':'LYS','SMC':'CYS','M3L':'LYS','MLZ':'LYS','MEN':'ASN','HIC':'HIS','MHS':'HIS','AGM':'ARG','MGN':'GLN','MEA':'GLU','CMT':'CYS','SEP':'SER','TPO':'THR','PTR':'TYR','HYP':'PRO','LYZ':'LYS','CSO':'CYS','OMT':'MET','KCX':'LYS','PCA':'GLN','CGU':'GLU','ALY':'LYS','SAC':'SER','AYA':'ALA','FME':'MET','TYS':'TYR','NIY':'TYR','SNC':'CYS'}
THREE_TO_FULLNAME = {"ALA":"Alanine", "CYS":"Cysteine", "ASP":"Aspartic acid", "GLU":"Glutamic acid", "PHE":"Phenylalanine", "GLY":"Glycine", "HIS":"Histidine", "ILE":"Isoleucine", "LYS":"Lysine", "LEU":"Leucine", "MET":"Methionine", "ASN":"Asparagine", "PRO":"Proline", "GLN":"Glutamine", "ARG":"Arginine", "SER":"Serine", "THR":"Threonine", "VAL":"Valine", "TRP":"Tryptophan", "TYR":"Tyrosine", "SEC":"Selenocysteine", "PYL":"Pyrrolysine", "ASX":"Aspartic acid or Asparagine", "GLX":"Glutamic acid or Glutamine", "UNK":"Unknown"}
MAX_ASA = {'F':210,'I':175,'L':170,'V':155,'P':145,'A':115,'G':75,'M':185,'C':135,'W':255,'Y':230,'T':140,'S':115,'Q':180,'N':160,'E':190,'D':150,'H':195,'K':200,'R':225}
FULLNAME_TO_1 = {"Alanine":"A", "Cysteine":"C", "Aspartic acid":"D", "Glutamic acid":"E", "Phenylalanine":"F", "Glycine":"G", "Histidine":"H", "Isoleucine":"I", "Lysine":"K", "Leucine":"L", "Methionine":"M", "Asparagine":"N", "Proline":"P", "Glutamine":"Q", "Arginine":"R", "Serine":"S", "Threonine":"T", "Valine":"V", "Tryptophan":"W", "Tyrosine":"Y", "Selenocysteine":"C", "Pyrrolysine":"K"}

def print_log(msg):
    tz = pytz.timezone('Asia/Seoul')
    print(f"[{datetime.datetime.now(tz).strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def update_snapshot_date():
    os.makedirs(os.path.dirname(CONFIG.DATE_FILE), exist_ok=True)
    now_str = datetime.datetime.now(pytz.timezone('Asia/Seoul')).strftime('%Y-%m-%d')
    with open(CONFIG.DATE_FILE, "w") as f: f.write(now_str)
    print_log(f"✅ Snapshot date updated to: {now_str}")

# =====================================================================
# ⬇️ 3. DOWNLOAD NEW MMCIFs
# =====================================================================
def download_new_mmcifs() -> List[str]:
    print_log("--- STEP 1: Checking for new mmCIFs on FTP ---")
    os.makedirs(CONFIG.MMCIF_ROOT, exist_ok=True)
    roots = ["https://ftp.ebi.ac.uk/pub/databases/pdb/data/structures/divided/mmCIF/", "https://ftp.ebi.ac.uk/pub/databases/pdb/data/structures/all/mmCIF/"]
    
    def fetch_ftp_files(url):
        try:
            r = requests.get(url, timeout=30)
            return [urljoin(url, h) for h in re.findall(r'href=["\']([^"\']+)["\']', r.text, re.I) if h.endswith('.cif.gz') or h.endswith('/')]
        except: return []

    ftp_cifs = set()
    for root in roots:
        with ThreadPoolExecutor(max_workers=32) as ex:
            futs = {ex.submit(fetch_ftp_files, d): d for d in fetch_ftp_files(root) if d.endswith('/') and d != root}
            for fut in as_completed(futs): ftp_cifs.update([f for f in fut.result() if f.endswith('.cif.gz')])

    local_files = {f.lower() for f in os.listdir(CONFIG.MMCIF_ROOT) if f.endswith('.cif')}
    missing_urls = [u for u in ftp_cifs if os.path.basename(u).replace('.gz', '').lower() not in local_files]
    
    print_log(f"Found {len(ftp_cifs)} on FTP. Missing locally: {len(missing_urls)}")
    if not missing_urls: return []

    def dl_file(url):
        dest_gz = os.path.join(CONFIG.MMCIF_ROOT, os.path.basename(url))
        dest_cif = os.path.join(CONFIG.MMCIF_ROOT, os.path.basename(url).replace('.gz', ''))
        try:
            with requests.get(url, stream=True, timeout=30) as r, open(dest_gz, 'wb') as f: shutil.copyfileobj(r.raw, f)
            with gzip.open(dest_gz, 'rb') as f_in, open(dest_cif, 'wb') as f_out: shutil.copyfileobj(f_in, f_out)
            os.remove(dest_gz)
            return os.path.basename(dest_cif)
        except: return None

    new_cifs = []
    with ThreadPoolExecutor(max_workers=CONFIG.MAX_DOWNLOAD_WORKERS) as ex:
        futs = [ex.submit(dl_file, u) for u in missing_urls]
        for fut in tqdm(as_completed(futs), total=len(futs), desc="Downloading"):
            res = fut.result()
            if res: new_cifs.append(res)
            
    print_log(f"✅ Downloaded {len(new_cifs)} new mmCIFs.")
    return new_cifs

# =====================================================================
# ⬇️ 4. CHAIN SPLIT & FULL DSSP 
# =====================================================================
class ChainSelect(Select):
    def __init__(self, chain_id): self.chain_id = str(chain_id)
    def accept_chain(self, chain): return str(chain.id) == self.chain_id

def split_one_cif(fn):
    path = os.path.join(CONFIG.MMCIF_ROOT, fn)
    pid = fn.split('.')
    try:
        parser = FastMMCIFParser(QUIET=True) if 'FastMMCIFParser' in globals() else MMCIFParser(QUIET=True)
        st = parser.get_structure(pid, path)
        model = next(iter(st), None)
        if not model: return
        for chain in model:
            cid = str(chain.id)
            out_path = os.path.join(CONFIG.MMCIF_CHAIN_ROOT, f"{pid}:{cid}.cif")
            if not os.path.exists(out_path):
                io = PDBIO()
                io.set_structure(st)
                io.save(str(out_path), select=ChainSelect(cid))
    except Exception: pass

def run_dssp_full(fn):
    pid = fn.split('.')
    cif_path = os.path.join(CONFIG.MMCIF_ROOT, fn)
    dssp_path = os.path.join(CONFIG.DSSP_ROOT, f"{pid}.dssp")
    if not os.path.exists(dssp_path):
        try:
            subprocess.run(["mkdssp", "-i", cif_path, "-o", dssp_path], capture_output=True, timeout=120)
        except subprocess.TimeoutExpired:
            pass

def process_chain_split_and_dssp(target_cifs: List[str]):
    print_log("--- STEP 2: Chain Split & Full DSSP ---")
    os.makedirs(CONFIG.MMCIF_CHAIN_ROOT, exist_ok=True)
    os.makedirs(CONFIG.DSSP_ROOT, exist_ok=True)

    if target_cifs:
        with ProcessPoolExecutor(max_workers=CONFIG.WORKERS) as ex:
            for _ in tqdm(ex.map(split_one_cif, target_cifs), total=len(target_cifs), desc="Splitting Chains"): pass
        with ProcessPoolExecutor(max_workers=CONFIG.WORKERS) as ex:
            for _ in tqdm(ex.map(run_dssp_full, target_cifs), total=len(target_cifs), desc="Running DSSP"): pass

# =====================================================================
# ⬇️ 5. EXTRACT FEATURES (One-Pass)
# =====================================================================
def _to_list(x): return x if isinstance(x, list) else ([x] if x is not None else [])
def _safe_int(x):
    try: return int(x)
    except: return None
def _norm(x): return str(x).strip().upper()

def extract_one_mmcif(mmcif_file: str) -> Tuple[List[dict], List[dict], List[dict]]:
    seq_rows, atom_rows, gly_rows = [], [], []
    pdb_path = os.path.join(CONFIG.MMCIF_ROOT, mmcif_file)
    pdb_id = mmcif_file.split('.').upper()

    try:
        cif_dict = MMCIF2Dict(pdb_path)
        parser = FastMMCIFParser(QUIET=True) if 'FastMMCIFParser' in globals() else MMCIFParser(QUIET=True)
        st = parser.get_structure(pdb_id, pdb_path)
        
        has_mod = "_pdbx_struct_mod_residue.label_comp_id" in cif_dict and "_pdbx_struct_mod_residue.details" in cif_dict

        atom_asym = _to_list(cif_dict.get("_atom_site.auth_asym_id"))
        atom_seq  = _to_list(cif_dict.get("_atom_site.auth_seq_id"))
        atom_comp = _to_list(cif_dict.get("_atom_site.auth_comp_id"))
        atom_name = _to_list(cif_dict.get("_atom_site.label_atom_id"))
        
        atom_index = {}
        if atom_asym and atom_seq and atom_comp and atom_name:
            for a, s, c, n in zip(atom_asym, atom_seq, atom_comp, atom_name):
                idx_s = _safe_int(s)
                if idx_s is not None: atom_index.setdefault((_norm(a), idx_s, _norm(c)), []).append(str(n))

        roles = _to_list(cif_dict.get("_struct_conn.pdbx_role"))
        if roles:
            p1_asym = _to_list(cif_dict.get("_struct_conn.ptnr1_auth_asym_id"))
            p1_seq  = _to_list(cif_dict.get("_struct_conn.ptnr1_auth_seq_id"))
            p1_comp = _to_list(cif_dict.get("_struct_conn.ptnr1_auth_comp_id"))
            p2_asym = _to_list(cif_dict.get("_struct_conn.ptnr2_auth_asym_id"))
            p2_seq  = _to_list(cif_dict.get("_struct_conn.ptnr2_auth_seq_id"))
            p2_comp = _to_list(cif_dict.get("_struct_conn.ptnr2_auth_comp_id"))
            for i, role in enumerate(roles):
                if "Glyco" in str(role) and i < len(p1_comp) and _norm(p1_comp[i]) == "ASN":
                    cid = _norm(p1_asym[i])
                    if cid.isupper():
                        g_chain = _norm(p2_asym[i]) if i < len(p2_asym) else ""
                        g_pos = _safe_int(p2_seq[i]) if i < len(p2_seq) else None
                        g_type = _norm(p2_comp[i]) if i < len(p2_comp) else ""
                        g_atoms = atom_index.get((g_chain, g_pos, g_type), []) if g_chain and g_pos else []
                        if not g_atoms:
                            for (a, s, c), atoms in atom_index.items():
                                if c == g_type: g_atoms.extend(atoms)
                        gly_rows.append({"pdb_id": pdb_id, "pdb_chain": cid, "pdb_pos": _safe_int(p1_seq[i]), "pdb_restype": "ASN", "annotation": "Glycosylation", "atom_types": list(dict.fromkeys(g_atoms))})

        model = next(iter(st), None)
        if model:
            for chain in model:
                cid = chain.get_id()
                if not str(cid).isupper(): continue
                seq3, seq1, pos_list, pos_to_res = [], [], [], {}

                for res in chain.get_unpacked_list():
                    resname = res.get_resname().upper()
                    if resname == "HOH": continue
                    pos = res.get_id()
                    pos_list.append(pos)
                    seq3.append(resname)
                    seq1.append(RES3_TO_ONE.get(resname, "X"))
                    pos_to_res.setdefault(pos, (resname, RES3_TO_ONE.get(resname, "X")))
                    
                    atom_names = list(dict.fromkeys([a.get_name() for a in res.get_unpacked_list()]))
                    atom_rows.append({"pdb_id": pdb_id, "pdb_chain": cid, "pdb_pos": pos, "pdb_restype": resname, "pdb_modres_details": "PTM" if resname in PTM_TRUE_CODES else "notPTM", "Case": 2 if has_mod else 3, "atom_types": atom_names})

                if pos_list:
                    s_pos, e_pos = min(pos_list), max(pos_list)
                    s3, s1 = [], []
                    for p in range(s_pos, e_pos + 1):
                        r3, r1 = pos_to_res.get(p, ("GAP", "-"))
                        s3.append(r3); s1.append(r1)
                    seq_rows.append({"pdb_id": pdb_id, "pdb_chain": cid, "sequence_3": "-".join(s3), "sequence_1": "".join(s1), "start_pdb_pos": s_pos, "end_pdb_pos": e_pos})
    except Exception: pass
    return seq_rows, atom_rows, gly_rows

def parse_atom_types(x):
    if isinstance(x, list): return [str(t).strip().upper() for t in x if str(t).strip()]
    if not x or str(x).lower() == 'nan': return []
    try:
        v = ast.literal_eval(str(x))
        if isinstance(v, list): return [str(t).strip().strip("'").strip('"').upper() for t in v if str(t).strip()]
    except: pass
    return [tok.strip().strip("'").strip('"').upper() for tok in str(x).strip("[]").split(",") if tok.strip()]

def get_cb_or_ca_coord(residue):
    if "CB" in residue: return np.asarray(residue["CB"].get_coord(), dtype=float)
    if "CA" in residue: return np.asarray(residue["CA"].get_coord(), dtype=float)
    return None

def process_assembly_and_interface_global(task):
    pdb_id, ptm_dict, mmcif_root, cutoff = task
    path = os.path.join(mmcif_root, pdb_id.lower() + ".cif")
    try:
        structure = MMCIFParser(QUIET=True).get_structure(pdb_id, path)
        model = next(structure.get_models())
    except: return pdb_id, "Unknown", {}

    chain_data = {}
    for chain in model:
        ch_id = str(chain.id).strip().upper()
        coords, resnums = [], []
        for res in chain:
            c = get_cb_or_ca_coord(res)
            if c is not None: 
                coords.append(c)
                resnums.append(res.id)
        if coords: chain_data[ch_id] = (np.asarray(resnums, dtype=int), np.asarray(coords, dtype=float))

    asm = "Multimer" if len(chain_data) >= 2 else ("Monomer" if len(chain_data) == 1 else "Unknown")
    loc = {}
    for (ch, rn) in ptm_dict.keys():
        chU, rnI = str(ch).upper(), int(rn)
        if chU not in chain_data: 
            loc[(chU, rnI)] = "Unknown"
            continue
        resnums, coords = chain_data[chU]
        hits = np.where(resnums == rnI)
        if len(hits) == 0: 
            loc[(chU, rnI)] = "Unknown"
            continue
        ptm_coord = coords[int(hits)]
        is_interface = any(np.any(np.linalg.norm(ocoords - ptm_coord, axis=1) < cutoff) for och, (_, ocoords) in chain_data.items() if och != chU)
        loc[(chU, rnI)] = "Interface" if is_interface else "Non-interface"
    return pdb_id, asm, loc

def parse_dssp_to_df(dssp_path):
    rows, parse = [], False
    with open(dssp_path) as f:
        for l in f:
            if l.startswith("  #  RESIDUE"): 
                parse = True
                continue
            if not parse or len(l) < 40: 
                continue
            try: 
                resnum = int(l[5:10].strip())
            except: 
                continue
            asa = l[34:38].strip()
            rows.append({"chain": l.strip().upper(), "resnum": resnum, "sec_struct": l.strip(), "ASA_dssp": int(asa) if asa.isdigit() else np.nan})
    return pd.DataFrame(rows)

def process_dssp_global(task):
    pdb, sub_df, dssp_root = task
    dssp_file = os.path.join(dssp_root, pdb.lower() + ".dssp")
    if not os.path.exists(dssp_file): return None
    dssp = parse_dssp_to_df(dssp_file)
    if dssp.empty: return None
    
    merged = pd.merge(sub_df, dssp, left_on=["pdb_chain", "pdb_pos"], right_on=["chain", "resnum"], how="left")
    asa = pd.to_numeric(merged["ASA_dssp"], errors="coerce")
    denom = merged["_base_aa1"].astype(str).map(lambda a: MAX_ASA.get(a, np.nan)).astype(float)
    rsa = (asa / denom).where(~asa.isna(), 1.0).clip(upper=1.0)
    sec = merged["sec_struct"].fillna("C").astype(str).str.strip().replace({"": "C"})
    return merged[["orig_idx"]].assign(sec_struct=sec.values, RSA_dssp=rsa.values)

def run_feature_extraction(target_cifs: List[str]):
    print_log("--- STEP 3: Extracting Features & Annotating ---")
    os.makedirs(CONFIG.INTER_DIR, exist_ok=True)
    try: inter_seq = pd.read_csv(CONFIG.INTER_SEQ)
    except: inter_seq = pd.DataFrame(columns=["PDB_ID", "chain_ID", "1_letter_expressed_sequence"])
    try: inter_struc = pd.read_csv(CONFIG.INTER_STRUC)
    except: inter_struc = pd.DataFrame(columns=["PDB_ID", "chain_ID", "residue_number", "base_residue_name"])

    if not target_cifs: return inter_seq, inter_struc

    all_seq, all_resatoms, all_glyco = [], [], []
    with ProcessPoolExecutor(max_workers=CONFIG.WORKERS) as ex:
        for sq, ra, gl in tqdm(ex.map(extract_one_mmcif, target_cifs), total=len(target_cifs), desc="Extracting features"):
            all_seq.extend(sq); all_resatoms.extend(ra); all_glyco.extend(gl)

    new_seq_df = pd.DataFrame(all_seq)
    if not new_seq_df.empty: 
        new_seq_df = new_seq_df.rename(columns={"pdb_id": "PDB_ID", "pdb_chain": "chain_ID", "sequence_1": "1_letter_expressed_sequence"})
    
    final_seq_df = pd.concat([new_seq_df, inter_seq], ignore_index=True)
    if not final_seq_df.empty: 
        final_seq_df = final_seq_df.assign(_len=final_seq_df["1_letter_expressed_sequence"].str.len()).sort_values("_len", ascending=False).drop_duplicates(["PDB_ID", "chain_ID"]).drop(columns="_len")
    final_seq_df.to_csv(CONFIG.INTER_SEQ, index=False)
    final_seq_df.to_csv(CONFIG.FINAL_SEQ, index=False)

    df = pd.DataFrame(all_resatoms)
    if df.empty and not all_glyco: return final_seq_df, inter_struc

    df = df[df["pdb_restype"].astype(str).str.upper() != "MSE"]
    df["pdb_pos"] = pd.to_numeric(df["pdb_pos"], errors="coerce").astype("Int64")
    df["atom_types"] = df["atom_types"].apply(parse_atom_types)

    diff_df = pd.read_csv(CONFIG.DIFF_CSV)
    ptm_to_added_atoms = {r["PTM Residue"].strip().upper(): set([a.strip().upper() for a in r["Common Added Atoms"].split(",") if a.strip()]) for _, r in diff_df.dropna(subset=["Common Added Atoms"]).iterrows()}
    
    df["Updated_annotation"] = np.nan
    valid_ptm = set(ptm_to_added_atoms.keys()) & set(PTM_RESCODE_TO_ANNOTATION.keys()) & set(df["pdb_restype"].unique())
    for ptm_code in valid_ptm:
        needed_atoms = ptm_to_added_atoms[ptm_code]
        mask_ptm = (df["pdb_restype"] == ptm_code)
        ok_mask = df.loc[mask_ptm, "atom_types"].apply(lambda xs: needed_atoms.issubset(set(xs)))
        df.loc[df.loc[mask_ptm].index[ok_mask], "Updated_annotation"] = PTM_RESCODE_TO_ANNOTATION[ptm_code]
    
    non_gly = df[df["Updated_annotation"].notna()].copy()
    non_gly["pdb_id_chain"] = non_gly["pdb_id"] + ":" + non_gly["pdb_chain"]
    non_gly = non_gly.rename(columns={"Updated_annotation": "annotation"})[["pdb_id_chain", "pdb_pos", "pdb_restype", "annotation"]]

    out = non_gly
    if all_glyco:
        g = pd.DataFrame(all_glyco)
        g["pdb_id_chain"] = g["pdb_id"].astype(str).str.upper() + ":" + g["pdb_chain"].astype(str).str.upper()
        out = pd.concat([non_gly, g[["pdb_id_chain", "pdb_pos", "pdb_restype", "annotation"]]], ignore_index=True)
    
    out["pdb_pos"] = pd.to_numeric(out["pdb_pos"], errors="coerce").astype("Int64")
    out = out.dropna(subset=["pdb_pos"]).drop_duplicates()
    parts = out["pdb_id_chain"].astype(str).str.split(":", n=1, expand=True)
    out["pdb_id"], out["pdb_chain"] = parts, parts

    map_df = pd.read_csv(CONFIG.SIFTS_CSV, comment="#")[["PDB", "CHAIN", "SP_PRIMARY"]].dropna()
    map_df["pdb_id_chain"] = map_df["PDB"].str.upper() + ":" + map_df["CHAIN"].str.upper()
    out["uniprot_accession"] = out["pdb_id_chain"].map(map_df.set_index("pdb_id_chain")["SP_PRIMARY"].to_dict())

    swiss_df = pd.read_csv(CONFIG.UNIPROT_CSV)[["Accession", "Organism"]].drop_duplicates()
    out = out.merge(swiss_df, how="left", left_on="uniprot_accession", right_on="Accession").drop(columns=["Accession"], errors="ignore")
    out["base_residue_name"] = out["pdb_restype"].astype(str).str.upper().map(lambda x: PTM_TO_CANONICAL_3CODE.get(x, x)).map(lambda x: THREE_TO_FULLNAME.get(x, x))

    out["Assembly_type"], out["Location"] = "Unknown", "Unknown"
    ptm_map = {}
    for idx, r in out.iterrows(): ptm_map.setdefault(r["pdb_id"], {}).setdefault((r["pdb_chain"], r["pdb_pos"]), []).append(idx)
    
    with ThreadPoolExecutor(max_workers=CONFIG.WORKERS) as exe:
        for pdb_id, asm, locs in tqdm(exe.map(process_assembly_and_interface_global, [(p, d, CONFIG.MMCIF_ROOT, 8.0) for p, d in ptm_map.items()]), total=len(ptm_map), desc="Assembly/Interface"):
            for (ch, rn), idxs in ptm_map.get(pdb_id, {}).items():
                for idx in idxs: 
                    out.at[idx, "Assembly_type"] = asm
                    out.at[idx, "Location"] = locs.get((ch, rn), "Unknown")

    out["Secondary_structure"], out["RSA"], out["_base_aa1"], out["orig_idx"] = np.nan, np.nan, out["base_residue_name"].map(FULLNAME_TO_1), out.index
    with ThreadPoolExecutor(max_workers=CONFIG.WORKERS) as exe:
        updates = [r for r in tqdm(exe.map(process_dssp_global, [(p, s, CONFIG.DSSP_ROOT) for p, s in out.groupby("pdb_id")]), total=out["pdb_id"].nunique(), desc="DSSP") if r is not None]
    
    if updates:
        u = pd.concat(updates, ignore_index=True)
        out.loc[u["orig_idx"], "Secondary_structure"] = u["sec_struct"].values
        out.loc[u["orig_idx"], "RSA"] = u["RSA_dssp"].values

    out["Secondary_structure"] = out["Secondary_structure"].apply(lambda x: "C" if pd.isna(x) or str(x).strip() == "" else str(x).strip())
    out["RSA"] = pd.to_numeric(out["RSA"], errors="coerce").clip(upper=1.0)
    out = out.drop(columns=["_base_aa1", "orig_idx"], errors="ignore").rename(columns={"uniprot_accession": "UniProt_Accession_code", "pdb_id": "PDB_ID", "pdb_chain": "chain_ID", "pdb_pos": "residue_number", "pdb_restype": "3_letter_residue_code", "annotation": "PTM_type_annotation"})
    
    out["PDB_IDs_from_identical_UniProt_Accession_code"] = out["UniProt_Accession_code"].map(map_df.groupby("SP_PRIMARY")["pdb_id_chain"].apply(lambda s: sorted(set(s.astype(str)))).to_dict()).apply(lambda x: ", ".join(x) if isinstance(x, list) else "")

    final_struc_df = pd.concat([out, inter_struc], ignore_index=True).drop_duplicates().reset_index(drop=True)
    final_struc_df.to_csv(CONFIG.INTER_STRUC, index=False)
    return final_seq_df, final_struc_df

# =====================================================================
# ⬇️ 6. ALIGNMENTS
# =====================================================================
def align_identity(seq1, seq2):
    try:
        aln = pairwise2.align.globalms(seq1, seq2, 1.0, -1.0, -5.0, -1.0, one_alignment_only=True)
        if not aln: return 0.0
        a, b = aln, aln
        return sum(1 for i in range(len(a)) if a[i] == b[i] and a[i] != '-') / len(a)
    except: return 0.0

def _worker_align(task):
    key, qseq, cand_pairs, meta = task
    results = [(ckey, float(sc01)) for ckey, cseq in cand_pairs if cseq and (sc01 := align_identity(qseq, cseq)) >= CONFIG.IDENTITY_MIN]
    return key, sorted(results, key=lambda x: x, reverse=True), meta

def run_sequence_alignments(struc_df, seq_df):
    print_log("--- STEP 4: Sequence Alignments ---")
    if struc_df.empty or seq_df.empty: return struc_df
    
    os.makedirs(CONFIG.ALIGN_CKPT_DIR, exist_ok=True)
    CKPT_MAP = f"{CONFIG.ALIGN_CKPT_DIR}/sorted_map.pkl"
    CKPT_META = f"{CONFIG.ALIGN_CKPT_DIR}/meta_by_key.pkl"
    sorted_map = pickle.load(open(CKPT_MAP, "rb")) if os.path.exists(CKPT_MAP) else {}
    meta_by_key = pickle.load(open(CKPT_META, "rb")) if os.path.exists(CKPT_META) else {}
    
    seq_u = seq_df.drop_duplicates(subset=["PDB_ID", "chain_ID"]).copy()
    seq_map = (seq_u["PDB_ID"].str.upper() + ":" + seq_u["chain_ID"].str.upper()).to_frame(name="__key__").assign(__seq__=seq_u["1_letter_expressed_sequence"]).set_index("__key__")["__seq__"].to_dict()

    df = struc_df.copy()
    df["__key__"] = df["PDB_ID"].astype(str).str.upper() + ":" + df["chain_ID"].astype(str).str.upper()
    
    tasks = []
    for key in tqdm(df["__key__"].dropna().unique().tolist(), desc="Building align tasks"):
        if not (qseq := seq_map.get(key)): continue
        
        group_series = df.loc[df["__key__"]==key, "PDB_IDs_from_identical_UniProt_Accession_code"]
        if group_series.empty: continue
        group_str = group_series.iloc
        
        if pd.isna(group_str) or not str(group_str).strip(): continue
        cands = sorted(list(set([c.strip() for c in str(group_str).split(",") if c.strip() != key and seq_map.get(c.strip())])))
        meta_sig = hashlib.md5(f"{hashlib.md5(qseq.encode('utf-8')).hexdigest()}|{hashlib.md5(','.join(cands).encode('utf-8')).hexdigest()}".encode('utf-8')).hexdigest()
        
        if key not in sorted_map or meta_by_key.get(key) != meta_sig: tasks.append((key, qseq, [(c, seq_map.get(c)) for c in cands], meta_sig))

    if tasks:
        with mp.Pool(processes=CONFIG.WORKERS) as pool:
            for key, res, meta in tqdm(pool.imap_unordered(_worker_align, tasks, chunksize=CONFIG.ALIGN_CHUNKSIZE), total=len(tasks), desc="Aligning"):
                sorted_map[key] = res; meta_by_key[key] = meta
        with open(CKPT_MAP, "wb") as f: pickle.dump(sorted_map, f)
        with open(CKPT_META, "wb") as f: pickle.dump(meta_by_key, f)

    df["scores_filtered"] = df["__key__"].map(lambda k: ", ".join([f"{pc}|{sc:.4f}" for pc, sc in sorted_map.get(k, [])]))
    struc_df["scores_filtered"] = df["scores_filtered"]
    struc_df.to_csv(CONFIG.FINAL_STRUC, index=False)
    return struc_df

# =====================================================================
# ⬇️ 7. MYSQL UPDATE (무중단 Table Swap 방식)
# =====================================================================
def update_mysql():
    print_log("--- STEP 5: MySQL Update (Zero Downtime) ---")
    DB_HOST, DB_USER, DB_PASS, DB_NAME = os.getenv("PTM_HOST", "localhost"), os.getenv("PTM_USER", "root"), os.getenv("PTM_PASS", "bis4704_29"), os.getenv("PTM_DB", "BIS_PTM")
    
    def safe_swap_table(cur, real_table):
        temp_table = f"{real_table}_new"
        cur.execute(f"DROP TABLE IF EXISTS {temp_table};")
        cur.execute(f"CREATE TABLE {temp_table} LIKE {real_table};")
        return temp_table

    try:
        conn = pymysql.connect(host=DB_HOST, user=DB_USER, password=DB_PASS, db=DB_NAME, charset="utf8mb4", autocommit=False)
        with conn.cursor() as cur:
            if os.path.exists(CONFIG.FINAL_SEQ):
                temp_seq = safe_swap_table(cur, "sequence_data_ext")
                sql_seq = f"INSERT INTO {temp_seq} (pdb_id, chain_id, seq_aa1) VALUES (%s, %s, %s)"
                batch = []
                for chunk in pd.read_csv(CONFIG.FINAL_SEQ, chunksize=50000):
                    for _, r in chunk.iterrows():
                        pid = str(r.get("PDB_ID", "")).strip()
                        if pid and pid.lower() != 'nan': batch.append((pid, str(r.get("chain_ID", "")).strip(), str(r.get("1_letter_expressed_sequence", "")).strip()))
                        if len(batch) >= 10000: cur.executemany(sql_seq, batch); conn.commit(); batch.clear()
                if batch: cur.executemany(sql_seq, batch); conn.commit()
                
                cur.execute(f"RENAME TABLE sequence_data_ext TO sequence_data_ext_old, {temp_seq} TO sequence_data_ext;")
                cur.execute("DROP TABLE IF EXISTS sequence_data_ext_old;")
                conn.commit()
                print_log("✅ Sequence table swap complete.")

            if os.path.exists(CONFIG.FINAL_STRUC):
                temp_ptm = safe_swap_table(cur, "ptm_data_ext")
                sql_ptm = f"INSERT INTO {temp_ptm} (pdb_id, chain_id, uniprot_acc, organism, residue_no, res3, residue_name, ptm_type, assembly_type, location, secondary_structure, rsa, related_pdb_chains_from_SIFTS) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                batch = []
                for chunk in pd.read_csv(CONFIG.FINAL_STRUC, chunksize=50000):
                    for _, r in chunk.iterrows():
                        pid = str(r.get("PDB_ID", "")).strip()[:4]
                        if pid and pid.lower() != 'nan':
                            batch.append((pid, str(r.get("chain_ID", "")).strip() or None, str(r.get("UniProt_Accession_code", "")).strip() or None, str(r.get("Organism", "")).strip() or None, int(float(r.get("residue_number", 0))) if pd.notna(r.get("residue_number")) else None, str(r.get("3_letter_residue_code", ""))[:3] if "3_letter_residue_code" in chunk else None, str(r.get("base_residue_name", "")).strip() or None, str(r.get("PTM_type_annotation", "")).strip() or None, str(r.get("Assembly_type", "")).strip() or None, str(r.get("Location", "")).strip() or None, str(r.get("Secondary_structure", ""))[:1] if pd.notna(r.get("Secondary_structure")) else None, float(r.get("RSA", 1.0)) if pd.notna(r.get("RSA")) else None, str(r.get("scores_filtered", "")).strip() or None))
                        if len(batch) >= 10000: cur.executemany(sql_ptm, batch); conn.commit(); batch.clear()
                if batch: cur.executemany(sql_ptm, batch); conn.commit()
                
                cur.execute(f"RENAME TABLE ptm_data_ext TO ptm_data_ext_old, {temp_ptm} TO ptm_data_ext;")
                cur.execute("DROP TABLE IF EXISTS ptm_data_ext_old;")
                conn.commit()
                print_log("✅ PTM table swap complete.")
    except Exception as e: print_log(f"Database Error: {e}")
    finally:
        if 'conn' in locals() and conn: conn.close()

# =====================================================================
# 🚀 8. MAIN PIPELINE
# =====================================================================
def main():
    print_log("=========================================================")
    print_log("STARTING STRUPTM WEEKLY UPDATE PIPELINE (SAFE MODE)")
    print_log("=========================================================")
    
    new_cifs = download_new_mmcifs()
    
    if not new_cifs:
        print_log("No new mmCIFs downloaded. Skipping parsing and feature extraction.")
    else:
        # ✅ 단일 체인 분리 & 전체 구조 DSSP
        process_chain_split_and_dssp(new_cifs)
        
        # ✅ 새로운 파일들만 파싱 및 가공 (기존 DB와 병합)
        seq_df, struc_df = run_feature_extraction(new_cifs)
        
        # ✅ 서열 유사도 추가 계산
        struc_df = run_sequence_alignments(struc_df, seq_df)
        
        # ✅ 무중단 DB 갱신
        update_mysql()
    
    update_snapshot_date()
    print_log("=========================================================")
    print_log("COMPLETED STRUPTM WEEKLY UPDATE")
    print_log("=========================================================")

if __name__ == "__main__":
    main()

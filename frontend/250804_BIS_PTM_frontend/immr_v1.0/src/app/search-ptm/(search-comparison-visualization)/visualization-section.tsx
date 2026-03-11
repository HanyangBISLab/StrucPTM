// src/app/search-ptm/(comparison)/visualization-section.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, Row, Col, Button, App, AutoComplete } from "antd";
import Visualization3D from "./visualization-3d";
import VisualizationTable from "./visualization-table";
import VisualizationComparison from "./visualization-comparison";

// ===== Types =====
interface PTMData {
  id: string;
  pdb_id_chain: string;
  pdb_pos: string;
  residue_name: string;
  annotation: string;

  secondary_structure?: string;
  rsa?: number;
}
interface ComparisonData {
  pdb1: PTMData[];
  pdb2: PTMData[];
}
interface AlignMetrics {
  identity: number;
  length1: number;
  length2: number;
  alnLen: number;
  alnSeq1: string;
  alnSeq2: string;
  midline: string;
}
interface ComparisonResult {
  id: string;
  pdb_1_sequence: string;
  pdb_2_sequence: string;
  tm_score: number;
  sequence_identity: number;
}
type ACOpt = { value: string; label?: React.ReactNode };

// ===== Utils =====
const normalizePdb = (s: string) => (s ?? "").trim().toUpperCase().replace(/\s+/g, "");
const normKey = (s?: string) => (s ?? "").toUpperCase().trim().replace(/[^0-9A-Z]/g, "");
const validPdb = (s: string) => /^[0-9][A-Z0-9]{3}(:[A-Z0-9])?$/.test(s);
const onlyPdbId = (s: string) => normalizePdb(s).split(":")[0];

const RECOMMEND_THRESHOLD = 0.8;

function parseRelatedList(s?: string) {
  const out: Array<{ key: string; score: number }> = [];
  if (!s) return out;
  for (const rawTok of s.split(",")) {
    const tok = rawTok.trim();
    if (!tok) continue;
    const [key, scoreStr] = tok.split("|").map((x) => x.trim());
    if (!key) continue;
    const sc = Number(scoreStr);
    const score01 = Number.isFinite(sc) ? (sc > 1.0000001 ? sc / 100.0 : sc) : 0;
    if (!Number.isFinite(score01)) continue;
    out.push({ key: normalizePdb(key), score: score01 });
  }
  return out;
}

function aggregateCandidates(rows: any[], selfKey: string, threshold01: number) {
  const self = normalizePdb(selfKey);
  const best = new Map<string, number>();
  for (const r of rows) {
    const s =
      r?.related_pdb_chains ??
      r?.related_pdb_chains_from_SIFTS ??
      r?.Identical_UniProt_sorted_with_scores ??
      r?.scores_filtered ??
      "";
    const pairs = parseRelatedList(s);
    for (const { key, score } of pairs) {
      if (!key || key === self) continue;
      if (score > (best.get(key) ?? -1)) best.set(key, score);
    }
  }
  return Array.from(best.entries())
    .map(([key, score]) => ({ key, score }))
    .filter((x) => x.score >= threshold01)
    .sort((a, b) => b.score - a.score);
}

function findPrecomputedIdentityRobust(rows: any[], selfKey: string, targetKey: string) {
  const self = normalizePdb(selfKey);
  const target = normalizePdb(targetKey);

  const targetIdOnly = onlyPdbId(target);
  const targetNK = normKey(target);
  const targetIdNK = normKey(targetIdOnly);

  let best: number | null = null;

  for (const r of rows) {
    const s =
      r?.related_pdb_chains ??
      r?.related_pdb_chains_from_SIFTS ??
      r?.Identical_UniProt_sorted_with_scores ??
      r?.scores_filtered ??
      "";

    const pairs = parseRelatedList(s);

    for (const { key, score } of pairs) {
      if (!key) continue;
      if (key === self) continue;

      const k = normalizePdb(key);
      const kId = onlyPdbId(k);
      const kNK = normKey(k);
      const kIdNK = normKey(kId);

      const hit =
        k === target ||
        kId === target ||
        k === targetIdOnly ||
        kId === targetIdOnly ||
        kNK === targetNK ||
        kNK === targetIdNK ||
        kIdNK === targetNK ||
        kIdNK === targetIdNK;

      if (hit) {
        if (best === null || score > best) best = score;
      }
    }
  }

  return best;
}

export default function VisualizationSection() {
  const { message } = App.useApp();
  const mountedRef = useRef(true);

  const [selectedPdb1, setSelectedPdb1] = useState("");
  const [selectedPdb2, setSelectedPdb2] = useState("");
  const [submittedPdb1, setSubmittedPdb1] = useState("");
  const [submittedPdb2, setSubmittedPdb2] = useState("");
  const [pdbOptions, setPdbOptions] = useState<ACOpt[]>([]);

  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<ComparisonData>({ pdb1: [], pdb2: [] });
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [alignMetrics, setAlignMetrics] = useState<AlignMetrics | null>(null);

  const [recoForFirst, setRecoForFirst] = useState<ACOpt[]>([]);
  const [recoForSecond, setRecoForSecond] = useState<ACOpt[]>([]);
  const [openFirst, setOpenFirst] = useState(false);
  const [openSecond, setOpenSecond] = useState(false);
  const [hoverOpenFirst, setHoverOpenFirst] = useState(false);
  const [hoverOpenSecond, setHoverOpenSecond] = useState(false);

  const refPdb1 = useRef<HTMLInputElement | null>(null);
  const refPdb2 = useRef<HTMLInputElement | null>(null);

  const autoCompareArmedRef = useRef(false);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    setPdbOptions([]);
  }, []);

  // 🚀 [수정됨] 좀비 백엔드의 쓰레기 데이터(\n)를 여기서도 씻어냅니다.
  const fetchJson = useCallback(async (input: RequestInfo, init?: RequestInit) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    try {
      const res = await fetch(input, { cache: "no-store", ...init, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const text = await res.text();
      const cleaned = text.replace(/\\n/g, ""); // 백엔드 쓰레기 문자 제거
      return JSON.parse(cleaned);
      
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const loadPdbRowsRaw = useCallback(
    async (pdbIdOrChain: string) => {
      const norm = normalizePdb(pdbIdOrChain);
      const data = await fetchJson("/api/search_ptm_data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdb_id_chain: norm }),
      });
      return Array.isArray(data) ? data : Array.isArray((data as any)?.results) ? (data as any).results : [];
    },
    [fetchJson]
  );

  const loadPdbData = useCallback(
    async (pdbIdOrChain: string): Promise<PTMData[]> => {
      try {
        const norm = normalizePdb(pdbIdOrChain);
        const rows = await loadPdbRowsRaw(norm);
        const out: PTMData[] = rows.map((item: any, i: number) => {
          const pdb_id_chain =
            item.pdb_id_chain ??
            (item.pdb_id
              ? item.chain_id
                ? `${String(item.pdb_id).toUpperCase()}:${String(item.chain_id).toUpperCase()}`
                : String(item.pdb_id).toUpperCase()
              : norm);

          const pdb_pos_val = Number.isFinite(item.pdb_pos)
            ? item.pdb_pos
            : Number.isFinite(item.residue_no)
              ? item.residue_no
              : item.pdb_pos ?? item.residue_no ?? "";

          return {
            id: item.id ?? `${pdb_id_chain}_${pdb_pos_val ?? ""}_${i}`,
            pdb_id_chain,
            pdb_pos: String(pdb_pos_val ?? ""),
            residue_name: item.residue_name ?? "",
            annotation: item.annotation ?? item.ptm_type ?? "",
            secondary_structure: item.secondary_structure ?? "",
            rsa:
              typeof item.rsa === "number"
                ? item.rsa
                : typeof item.RSA === "number"
                  ? item.RSA
                  : undefined,
          };
        });
        return out;
      } catch (e) {
        console.error("[loadPdbData] error:", e);
        return [];
      }
    },
    [loadPdbRowsRaw]
  );

  const makeRecoOptions = useCallback(
    (arr: Array<{ key: string; score: number }>): ACOpt[] =>
      arr.map(({ key, score }) => ({
        value: key,
        label: (
          <div className="flex justify-between">
            <span>{key}</span>
            <span
              className="text-gray-500"
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
              }}
            >
              {Number(score).toFixed(4)}
            </span>
          </div>
        ),
      })),
    []
  );

  const fetchAlignment = useCallback(
    async (p1Raw: string, p2Raw: string): Promise<AlignMetrics> => {
      const p1 = normalizePdb(p1Raw);
      const p2 = normalizePdb(p2Raw);
      const [pid1, ch1] = p1.split(":");
      const [pid2, ch2] = p2.split(":");

      const qs = new URLSearchParams({
        pdb1: pid1,
        ...(ch1 ? { chain1: ch1 } : {}),
        pdb2: pid2,
        ...(ch2 ? { chain2: ch2 } : {}),
      }).toString();

      const a = await fetchJson(`/api/align_sequences?${qs}`);

      const frac = typeof (a as any)?.identity_fraction === "number" ? (a as any).identity_fraction : 0;
      
      // 🚀 백엔드(mysql.py) 구조에 맞게 매핑 수정
      const alnSeq1 = String((a as any)?.alignment?.seq1 ?? "");
      const alnSeq2 = String((a as any)?.alignment?.seq2 ?? "");
      const midline = String((a as any)?.alignment?.midline ?? "");
      const alnLen = alnSeq1.length;

      return {
        identity: Number.isFinite(frac) ? frac : 0,
        length1: Number((a as any)?.length1 ?? 0),
        length2: Number((a as any)?.length2 ?? 0),
        alnLen,
        alnSeq1,
        alnSeq2,
        midline,
      };
    },
    [fetchJson]
  );

  const fetchTmScore = useCallback(
    async (p1Raw: string, p2Raw: string): Promise<number> => {
      const p1 = onlyPdbId(p1Raw);
      const p2 = onlyPdbId(p2Raw);
      try {
        const qs = new URLSearchParams({ pdb1: p1, pdb2: p2 }).toString();
        const r = await fetchJson(`/api/tm_score?${qs}`);
        const v = Number((r as any)?.tm_score_overall ?? (r as any)?.tm_score ?? 0);
        return v <= 1 ? v * 100 : v;
      } catch {
        return 0;
      }
    },
    [fetchJson]
  );

  const runCompare = useCallback(
    (p1Raw: string, p2Raw: string) => {
      const p1 = normalizePdb(p1Raw);
      const p2 = normalizePdb(p2Raw);

      if (!p1 && !p2) return message.info("Enter at least one PDB ID.");
      if (p1 && !validPdb(p1)) return message.error("PDB 1 format is invalid.");
      if (p2 && !validPdb(p2)) return message.error("PDB 2 format is invalid.");

      setSubmittedPdb1(p1);
      setSubmittedPdb2(p2);
    },
    [message]
  );

  const handleCompare = () => runCompare(selectedPdb1, selectedPdb2);

  useEffect(() => {
    const handler = (e: Event) => {
      const { mode, pdb } = (e as CustomEvent).detail || {};
      if (!pdb) return;

      const norm = normalizePdb(pdb);
      autoCompareArmedRef.current = true;

      if (mode === "first") {
        setSelectedPdb1(norm);
        message.success(`First set to ${norm}`);
        setTimeout(() => refPdb1.current?.focus(), 0);
      } else if (mode === "second") {
        setSelectedPdb2(norm);
        message.success(`Second set to ${norm}`);
        setTimeout(() => refPdb2.current?.focus(), 0);
      } else {
        if (!selectedPdb1) setSelectedPdb1(norm);
        else setSelectedPdb2(norm);
      }
    };

    window.addEventListener("ptm:setPdb", handler as EventListener);
    return () => window.removeEventListener("ptm:setPdb", handler as EventListener);
  }, [message, selectedPdb1]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { pdb1, pdb2 } = (e as CustomEvent).detail || {};
      if (!pdb1 || !pdb2) return;

      const p1 = normalizePdb(pdb1);
      const p2 = normalizePdb(pdb2);

      setSelectedPdb1(p1);
      setSelectedPdb2(p2);
      runCompare(p1, p2);
    };

    window.addEventListener("ptm:runCompare", handler as EventListener);
    window.addEventListener("ptm:exampleCompare", handler as EventListener);

    return () => {
      window.removeEventListener("ptm:runCompare", handler as EventListener);
      window.removeEventListener("ptm:exampleCompare", handler as EventListener);
    };
  }, [runCompare]);

  useEffect(() => {
    if (!autoCompareArmedRef.current) return;

    const p1 = normalizePdb(selectedPdb1);
    const p2 = normalizePdb(selectedPdb2);

    if (!p1 || !p2) return;
    if (!validPdb(p1) || !validPdb(p2)) return;

    if (p1 === submittedPdb1 && p2 === submittedPdb2) {
      autoCompareArmedRef.current = false;
      return;
    }

    autoCompareArmedRef.current = false;
    runCompare(p1, p2);
  }, [selectedPdb1, selectedPdb2, submittedPdb1, submittedPdb2, runCompare]);

  useEffect(() => {
    let stop = false;
    (async () => {
      setRecoForSecond([]);
      if (!selectedPdb1) return;
      try {
        const rows = await loadPdbRowsRaw(selectedPdb1);
        const agg = aggregateCandidates(rows, selectedPdb1, RECOMMEND_THRESHOLD);
        if (!stop) setRecoForSecond(makeRecoOptions(agg));
      } catch (e) {
        console.warn("reco(second) error:", e);
      }
    })();
    return () => {
      stop = true;
    };
  }, [selectedPdb1, loadPdbRowsRaw, makeRecoOptions]);

  useEffect(() => {
    let stop = false;
    (async () => {
      setRecoForFirst([]);
      if (!selectedPdb2) return;
      try {
        const rows = await loadPdbRowsRaw(selectedPdb2);
        const agg = aggregateCandidates(rows, selectedPdb2, RECOMMEND_THRESHOLD);
        if (!stop) setRecoForFirst(makeRecoOptions(agg));
      } catch (e) {
        console.warn("reco(first) error:", e);
      }
    })();
    return () => {
      stop = true;
    };
  }, [selectedPdb2, loadPdbRowsRaw, makeRecoOptions]);

  const clearComparison = () => {
    setSelectedPdb1("");
    setSelectedPdb2("");
    setSubmittedPdb1("");
    setSubmittedPdb2("");
    setComparisonData({ pdb1: [], pdb2: [] });
    setComparisonResults([]);
    setAlignMetrics(null);
    setRecoForFirst([]);
    setRecoForSecond([]);
    setOpenFirst(false);
    setOpenSecond(false);
    setHoverOpenFirst(false);
    setHoverOpenSecond(false);
    autoCompareArmedRef.current = false;
    message.info("Cleared");
  };

  useEffect(() => {
    if (!submittedPdb1 && !submittedPdb2) {
      setComparisonData({ pdb1: [], pdb2: [] });
      setAlignMetrics(null);
      setComparisonResults([]);
      return;
    }

    const onlyOne = (submittedPdb1 && !submittedPdb2) || (!submittedPdb1 && submittedPdb2);

    (async () => {
      setLoading(true);
      try {
        if (onlyOne) {
          const pdbSolo = submittedPdb1 || submittedPdb2;
          const data = await loadPdbData(pdbSolo);
          setComparisonData(submittedPdb1 ? { pdb1: data, pdb2: [] } : { pdb1: [], pdb2: data });
          setAlignMetrics(null);
          setComparisonResults([]);
        } else {
          const [rows1Raw, rows2Raw, pdb1Data, pdb2Data, align, tm] = await Promise.all([
            loadPdbRowsRaw(submittedPdb1),
            loadPdbRowsRaw(submittedPdb2),
            loadPdbData(submittedPdb1),
            loadPdbData(submittedPdb2),
            fetchAlignment(submittedPdb1, submittedPdb2),
            fetchTmScore(submittedPdb1, submittedPdb2),
          ]);

          setComparisonData({ pdb1: pdb1Data, pdb2: pdb2Data });
          setAlignMetrics(align);

          const db1 = findPrecomputedIdentityRobust(rows1Raw, submittedPdb1, submittedPdb2);
          const db2 = findPrecomputedIdentityRobust(rows2Raw, submittedPdb2, submittedPdb1);
          const dbIdentity =
            typeof db1 === "number" && Number.isFinite(db1)
              ? db1
              : typeof db2 === "number" && Number.isFinite(db2)
                ? db2
                : 0;

          const ann1 = new Set(pdb1Data.map((r) => r.annotation).filter(Boolean));
          const ann2 = new Set(pdb2Data.map((r) => r.annotation).filter(Boolean));
          const common = Array.from(ann1).filter((a) => ann2.has(a));

          const rows: ComparisonResult[] = (common.length ? common : ["__ALL__"]).map((annotation, i) => {
            const n1 =
              annotation === "__ALL__" ? pdb1Data.length : pdb1Data.filter((r) => r.annotation === annotation).length;
            const n2 =
              annotation === "__ALL__" ? pdb2Data.length : pdb2Data.filter((r) => r.annotation === annotation).length;

            return {
              id: "comparison_" + i,
              pdb_1_sequence:
                annotation === "__ALL__" ? `${submittedPdb1}` : `${submittedPdb1} - ${annotation} (${n1} sites)`,
              pdb_2_sequence:
                annotation === "__ALL__" ? `${submittedPdb2}` : `${submittedPdb2} - ${annotation} (${n2} sites)`,
              tm_score: tm,
              sequence_identity: dbIdentity,
            };
          });

          setComparisonResults(rows);
        }
      } catch (e) {
        console.error(e);
        message.error("Failed to load data.");
        setAlignMetrics(null);
        setComparisonResults([]);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [submittedPdb1, submittedPdb2, loadPdbData, loadPdbRowsRaw, fetchAlignment, fetchTmScore, message]);

  const optionsFirst = useMemo<ACOpt[]>(() => (recoForFirst.length ? recoForFirst : pdbOptions), [recoForFirst, pdbOptions]);
  const optionsSecond = useMemo<ACOpt[]>(() => (recoForSecond.length ? recoForSecond : pdbOptions), [recoForSecond, pdbOptions]);

  return (
    <div className="space-y-6 p-4">
      <Card title="PDB selection for comparison" className="mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={12}>
            <label className="block mb-2 font-medium">First PDB ID (PDB or PDB:chain):</label>
            <AutoComplete
              id="comparePdb1"
              value={selectedPdb1}
              onChange={(v) => {
                setSelectedPdb1(v);
                setHoverOpenFirst(false);
                autoCompareArmedRef.current = false;
              }}
              onSelect={(v) => {
                setSelectedPdb1(v);
                setHoverOpenFirst(false);
                autoCompareArmedRef.current = false;
              }}
              placeholder="e.g., 132L or 132L:A"
              className="w-full"
              options={optionsFirst}
              allowClear
              open={openFirst}
              onDropdownVisibleChange={(o) => {
                setOpenFirst(o);
                if (!o) setHoverOpenFirst(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
              onMouseEnter={() => {
                if (recoForFirst.length) {
                  setHoverOpenFirst(true);
                  setOpenFirst(true);
                }
              }}
              onFocus={(e) => {
                refPdb1.current = e.target as HTMLInputElement;
                if (recoForFirst.length) {
                  setHoverOpenFirst(true);
                  setOpenFirst(true);
                }
              }}
              onBlur={() => {
                setOpenFirst(false);
                setHoverOpenFirst(false);
              }}
              filterOption={(input, option) =>
                hoverOpenFirst ? true : (option?.value ?? "").toLowerCase().includes((input ?? "").toLowerCase())
              }
            />
          </Col>

          <Col xs={24} lg={12}>
            <label className="block mb-2 font-medium">Second PDB ID (PDB or PDB:chain):</label>
            <AutoComplete
              id="comparePdb2"
              value={selectedPdb2}
              onChange={(v) => {
                setSelectedPdb2(v);
                setHoverOpenSecond(false);
                autoCompareArmedRef.current = false;
              }}
              onSelect={(v) => {
                setSelectedPdb2(v);
                setHoverOpenSecond(false);
                autoCompareArmedRef.current = false;
              }}
              placeholder="e.g., 1A0H or 1A0H:B"
              className="w-full"
              options={optionsSecond}
              allowClear
              open={openSecond}
              onDropdownVisibleChange={(o) => {
                setOpenSecond(o);
                if (!o) setHoverOpenSecond(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
              onMouseEnter={() => {
                if (recoForSecond.length) {
                  setHoverOpenSecond(true);
                  setOpenSecond(true);
                }
              }}
              onFocus={(e) => {
                refPdb2.current = e.target as HTMLInputElement;
                if (recoForSecond.length) {
                  setHoverOpenSecond(true);
                  setOpenSecond(true);
                }
              }}
              onBlur={() => {
                setOpenSecond(false);
                setHoverOpenSecond(false);
              }}
              filterOption={(input, option) =>
                hoverOpenSecond ? true : (option?.value ?? "").toLowerCase().includes((input ?? "").toLowerCase())
              }
            />
          </Col>
        </Row>

        <Row style={{ marginTop: 12 }} justify="center">
          <Col span={24} style={{ textAlign: "center" as const }}>
            <div style={{ display: "inline-flex", gap: 12 }}>
              <Button type="primary" onClick={handleCompare} loading={loading}>
                Compare
              </Button>
              <Button onClick={clearComparison}>Clear</Button>
            </div>
          </Col>
        </Row>
      </Card>

      {(submittedPdb1 || submittedPdb2) && <Visualization3D selectedPdb1={submittedPdb1} selectedPdb2={submittedPdb2} />}

      {submittedPdb1 && submittedPdb2 && (
        <>
          <VisualizationTable
            selectedPdb1={submittedPdb1}
            selectedPdb2={submittedPdb2}
            comparisonData={comparisonData}
            loading={loading}
          />
          <VisualizationComparison
            comparisonResults={comparisonResults}
            loading={loading}
            selectedPdb1={submittedPdb1}
            selectedPdb2={submittedPdb2}
            alignMetrics={alignMetrics}
            tmScore={comparisonResults.length > 0 ? comparisonResults[0].tm_score : null}
          />
        </>
      )}
    </div>
  );
}
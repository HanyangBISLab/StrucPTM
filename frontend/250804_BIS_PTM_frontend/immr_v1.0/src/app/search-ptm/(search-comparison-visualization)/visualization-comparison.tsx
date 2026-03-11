// src/app/search-ptm/(comparison)/visualization-comparison.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Spin, Row, Col, Statistic, Tooltip } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

interface ComparisonResult {
  id: string;
  pdb_1_sequence: string; 
  pdb_2_sequence: string; 
  tm_score: number;
  sequence_identity: number; 
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

interface VisualizationComparisonProps {
  comparisonResults: ComparisonResult[];
  loading: boolean;
  selectedPdb1?: string;
  selectedPdb2?: string;
  alignMetrics: AlignMetrics | null;
  tmScore?: number | null; 
}

const digits = (n: number) =>
  Math.max(1, Math.floor(Math.log10(Math.max(1, Math.abs(n)))) + 1);

// 🚀 [수정됨] TM-score를 0-1 스케일로 유지 (100을 곱하지 않음)
function extractTm(resp: any): number {
  const raw =
    resp?.tm_score ?? resp?.tm_score_overall ?? resp?.tmScore ?? resp?.score;
  const num = Number(raw);
  if (!Number.isFinite(num)) return 0;
  
  // 백엔드에서 100이 넘는 스케일로 잘못 넘어오는 경우를 대비한 방어 코드
  if (num > 1.0000001) return num / 100;
  return num;
}

function measureAvgCharWidth(font: string) {
  if (typeof document === "undefined") return 8;
  const s =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_| ";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 8;
  ctx.font = font;
  const w = ctx.measureText(s.repeat(6)).width;
  return w / (s.length * 6);
}

function chunkAlignment(seq1: string, seq2: string, width: number) {
  const out: Array<{
    s1: string;
    s2: string;
    idx1Start: number;
    idx1End: number;
    idx2Start: number;
    idx2End: number;
  }> = [];

  let i1 = 0,
    i2 = 0;

  for (let i = 0; i < seq1.length; i += width) {
    const s1 = seq1.slice(i, i + width);
    const s2 = seq2.slice(i, i + width);

    const start1 = i1 + 1;
    const start2 = i2 + 1;

    const inc1 = (s1.match(/[^-]/g) || []).length;
    const inc2 = (s2.match(/[^-]/g) || []).length;

    const end1 = i1 + inc1;
    const end2 = i2 + inc2;

    out.push({
      s1,
      s2,
      idx1Start: start1,
      idx1End: end1,
      idx2Start: start2,
      idx2End: end2,
    });

    i1 += inc1;
    i2 += inc2;
  }

  return out;
}

function buildRulerLine(s1: string, startIdx: number) {
  let res = "";
  let idx = startIdx;
  for (let i = 0; i < s1.length; i++) {
    const c = s1[i];
    if (c === "-") {
      res += " ";
    } else {
      res += idx % 5 === 0 ? String(idx % 10) : " ";
      idx++;
    }
  }
  return res;
}

function buildMidline(s1: string, s2: string) {
  let res = "";
  for (let i = 0; i < s1.length; i++) {
    const a = s1[i];
    const b = s2[i];
    if (a === "-" || b === "-") res += " ";
    else if (a === b) res += "|";
    else res += "*";
  }
  return res;
}

const normKey = (s?: string) =>
  (s ?? "")
    .toUpperCase()
    .trim()
    .replace(/[^0-9A-Z]/g, "");

function normalizeIdentity(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 1.0000001) return Math.max(0, Math.min(1, n));
  if (n <= 100.0000001) return Math.max(0, Math.min(1, n / 100));
  return null;
}

function extractPairFromRow(row?: ComparisonResult): { p1?: string; p2?: string } {
  if (!row) return {};

  const candStrings = [
    row.id,
    row.pdb_1_sequence,
    row.pdb_2_sequence,
    JSON.stringify(row),
  ]
    .filter(Boolean)
    .map(String);

  const re = /([0-9A-Za-z]{4})\s*[:_\-]\s*([0-9A-Za-z])/g;

  for (const s of candStrings) {
    const hits: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const pdb = (m[1] ?? "").toUpperCase();
      const ch = (m[2] ?? "").toUpperCase();
      hits.push(`${pdb}:${ch}`);
      if (hits.length >= 2) break;
    }
    if (hits.length >= 2) return { p1: hits[0], p2: hits[1] };
  }

  const rePdbOnly = /\b([0-9A-Za-z]{4})\b/g;
  for (const s of candStrings) {
    const hits: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = rePdbOnly.exec(s)) !== null) {
      hits.push((m[1] ?? "").toUpperCase());
      if (hits.length >= 2) break;
    }
    if (hits.length >= 2) return { p1: hits[0], p2: hits[1] };
  }

  return {};
}

export default function VisualizationComparison({
  comparisonResults,
  loading,
  selectedPdb1,
  selectedPdb2,
  alignMetrics,
  tmScore,
}: VisualizationComparisonProps) {
  
  const [localSelected, setLocalSelected] = useState<{ p1?: string; p2?: string }>({
    p1: selectedPdb1,
    p2: selectedPdb2,
  });

  useEffect(() => {
    if (selectedPdb1 || selectedPdb2) {
      setLocalSelected({ p1: selectedPdb1, p2: selectedPdb2 });
      return;
    }

    if (comparisonResults && comparisonResults.length > 0) {
      const { p1, p2 } = extractPairFromRow(comparisonResults[0]);
      if (p1 || p2) setLocalSelected({ p1, p2 });
    }
  }, [selectedPdb1, selectedPdb2, comparisonResults]);

  const effSelectedPdb1 = localSelected.p1 ?? selectedPdb1;
  const effSelectedPdb2 = localSelected.p2 ?? selectedPdb2;

  const identityFromDb = useMemo(() => {
    if (!comparisonResults || comparisonResults.length === 0) return null;

    const a = normKey(effSelectedPdb1);
    const b = normKey(effSelectedPdb2);

    if (comparisonResults.length === 1) {
      return normalizeIdentity(comparisonResults[0]?.sequence_identity);
    }

    if (a && b) {
      const hit = comparisonResults.find((r) => {
        const cand = [
          r?.id,
          r?.pdb_1_sequence,
          r?.pdb_2_sequence,
          r?.pdb_3_sequence, // 오타였을수도 있어서 안전하게 둠
          JSON.stringify(r),
        ]
          .filter(Boolean)
          .map((x) => normKey(String(x)));

        const joined = cand.join(" ");
        return joined.includes(a) && joined.includes(b);
      });

      if (hit) return normalizeIdentity(hit.sequence_identity);
    }

    return normalizeIdentity(comparisonResults[0]?.sequence_identity);
  }, [comparisonResults, effSelectedPdb1, effSelectedPdb2]);

  const identityFraction = useMemo(() => {
    return identityFromDb ?? 0;
  }, [identityFromDb]);

  // ---------- TM-score ---------- //
  // 🚀 [수정됨] 100을 곱하지 않고 원래 값을 사용
  const [tmLocal, setTmLocal] = useState<number>(() => {
      const ts = Number(tmScore ?? 0);
      if (ts > 1.0000001) return ts / 100;
      return ts;
  });
  const [tmLoading, setTmLoading] = useState<boolean>(false);

  useEffect(() => {
    if (tmScore != null && Number.isFinite(Number(tmScore))) {
      const ts = Number(tmScore);
      setTmLocal(ts > 1.0000001 ? ts / 100 : ts);
      setTmLoading(false);
    }
  }, [tmScore]);

  useEffect(() => {
    if (tmScore != null && Number.isFinite(Number(tmScore))) return;

    if (!effSelectedPdb1 || !effSelectedPdb2) {
      setTmLocal(0);
      setTmLoading(false);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({
      pdb1: effSelectedPdb1,
      pdb2: effSelectedPdb2,
    }).toString();
    const url = `/api/tm_score?${query}`;

    setTmLoading(true);
    (async () => {
      try {
        const r = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) throw new Error(`tm_score HTTP ${r.status}`);
        const j = await r.json();
        const tm = extractTm(j);
        setTmLocal(Number.isFinite(tm) ? tm : 0);
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("TM-score fetch failed:", e);
        setTmLocal(0);
      } finally {
        setTmLoading(false);
      }
    })();

    return () => controller.abort();
  }, [effSelectedPdb1, effSelectedPdb2, tmScore]);

  // ---------- Alignment Fetch ---------- //
  const [alignLocal, setAlignLocal] = useState<AlignMetrics | null>(null);
  const [alignLoading, setAlignLoading] = useState(false);

  const effAlign = alignMetrics ?? alignLocal;

  useEffect(() => {
    if (alignMetrics) return;

    if (!effSelectedPdb1 || !effSelectedPdb2) {
      setAlignLocal(null);
      setAlignLoading(false);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({
      pdb1: effSelectedPdb1,
      pdb2: effSelectedPdb2,
    }).toString();

    const url = `/api/align_sequences?${query}`;

    setAlignLoading(true);
    (async () => {
      try {
        const r = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!r.ok) throw new Error(`align_sequences HTTP ${r.status}`);
        const j = await r.json();

        const m: AlignMetrics = {
          identity: Number(j?.identity ?? j?.seq_identity ?? 0) || 0,
          length1: Number(j?.length1 ?? j?.len1 ?? 0) || 0,
          length2: Number(j?.length2 ?? j?.len2 ?? 0) || 0,
          alnLen: Number(j?.aligned_length ?? j?.alnLen ?? j?.aln_len ?? 0) || 0,
          alnSeq1: String(j?.alignment?.seq1 ?? j?.alnSeq1 ?? ""),
          alnSeq2: String(j?.alignment?.seq2 ?? j?.alnSeq2 ?? ""),
          midline: String(j?.alignment?.midline ?? j?.midline ?? ""),
        };

        if ((!m.midline || m.midline.length === 0) && m.alnSeq1 && m.alnSeq2) {
          m.midline = buildMidline(m.alnSeq1, m.alnSeq2);
        }

        if (!m.alnSeq1 || !m.alnSeq2 || m.alnSeq1.length !== m.alnSeq2.length) {
          setAlignLocal(null);
        } else {
          setAlignLocal(m);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") console.error("Alignment fetch failed:", e);
        setAlignLocal(null);
      } finally {
        setAlignLoading(false);
      }
    })();

    return () => controller.abort();
  }, [alignMetrics, effSelectedPdb1, effSelectedPdb2]);

  // ---------- Pairwise alignment 레이아웃 ---------- //
  const preRef = useRef<HTMLPreElement | null>(null);
  const [containerPx, setContainerPx] = useState<number>(800);

  const fontSizePx = 14;
  const fontFamily =
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace";
  const font = `${fontSizePx}px ${fontFamily}`;

  const charWidthPx = useMemo(() => measureAvgCharWidth(font), [font]);

  useEffect(() => {
    if (!preRef.current) return;
    const el = preRef.current;
    const parent = el.parentElement || el;

    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        if (w > 0) setContainerPx(w);
      }
    });

    obs.observe(parent);
    const w0 = (parent as HTMLElement).clientWidth || 800;
    setContainerPx(w0);

    return () => obs.disconnect();
  }, []);

  const seqColsPerLine = useMemo(() => {
    if (!effAlign) return 80;

    const effLen1 = effAlign.alnSeq1.replace(/-/g, "").length || 1;
    const effLen2 = effAlign.alnSeq2.replace(/-/g, "").length || 1;

    const pad = Math.max(4, digits(effLen1), digits(effLen2));
    const leftCols = pad + 4; 
    const rightCols = 4; 
    const nonSeqCols = leftCols + rightCols;

    const totalCols = Math.floor(containerPx / charWidthPx) - nonSeqCols - 2;
    const boosted = Math.floor(totalCols * 1.0);

    const maxLen = Math.max(effLen1, effLen2);
    return Math.max(60, Math.min(boosted, maxLen));
  }, [effAlign, containerPx, charWidthPx]);

  const blocks = useMemo(() => {
    if (!effAlign?.alnSeq1 || !effAlign?.alnSeq2) return [];
    return chunkAlignment(effAlign.alnSeq1, effAlign.alnSeq2, seqColsPerLine);
  }, [effAlign, seqColsPerLine]);

  const effLen1FromBlocks = useMemo(() => {
    if (!blocks.length) {
      return effAlign?.alnSeq1 ? effAlign.alnSeq1.replace(/-/g, "").length : 0;
    }
    return blocks[blocks.length - 1].idx1End;
  }, [blocks, effAlign]);

  const effLen2FromBlocks = useMemo(() => {
    if (!blocks.length) {
      return effAlign?.alnSeq2 ? effAlign.alnSeq2.replace(/-/g, "").length : 0;
    }
    return blocks[blocks.length - 1].idx2End;
  }, [blocks, effAlign]);

  const alignedLen = effAlign?.alnLen ?? 0;

  const alignmentText = useMemo(() => {
    if (!effAlign || blocks.length === 0) return "Alignment not available.";

    const padWidth = Math.max(4, digits(effLen1FromBlocks), digits(effLen2FromBlocks));

    let text = "";

    for (let bi = 0; bi < blocks.length; bi++) {
      const b = blocks[bi];

      const leftPad = " ".repeat(padWidth + 4);

      const ruler = buildRulerLine(b.s1, b.idx1Start);
      const mid = buildMidline(b.s1, b.s2);

      text += `${leftPad}${ruler}\n`;
      text += `${b.idx1Start.toString().padStart(padWidth, " ")}  > ${b.s1}  ${b.idx1End}\n`;
      text += `${leftPad}${mid}\n`;
      text += `${b.idx2Start.toString().padStart(padWidth, " ")}  > ${b.s2}  ${b.idx2End}\n\n`;
    }

    return text;
  }, [effAlign, blocks, effLen1FromBlocks, effLen2FromBlocks]);

  const showLoading = loading || alignLoading;

  return (
    <Card title={`Comparison results: ${effSelectedPdb1 ?? ""} <> ${effSelectedPdb2 ?? ""}`}>
      <style jsx>{`
        .ptmAlignPre {
          white-space: pre !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          word-wrap: normal !important;
          overflow-x: auto !important;
          overflow-y: auto !important;
          font-variant-ligatures: none !important;
          letter-spacing: 0 !important;
          tab-size: 4 !important;
          display: block;
        }
      `}</style>

      {showLoading ? (
        <div className="text-center py-8">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div className="mt-2">Analyzing sequences...</div>
        </div>
      ) : (
        <>
          <Row gutter={[16, 16]} className="mb-4">
            <Col xs={24} md={6}>
              <Card size="small" style={{ height: "100%" }}>
                <Tooltip title="Identity (0–1), loaded from precomputed DB table (no recomputation).">
                  <Statistic
                    title="Sequence identity"
                    value={Number(identityFraction.toFixed(4))}
                    precision={4}
                    valueStyle={{ fontSize: 22 }}
                  />
                </Tooltip>
              </Card>
            </Col>

            <Col xs={24} md={6}>
              <Card size="small" style={{ height: "100%" }}>
                <Statistic
                  title="Length (PDB1, aligned)"
                  value={effLen1FromBlocks}
                  valueStyle={{ fontSize: 22 }}
                />
              </Card>
            </Col>

            <Col xs={24} md={6}>
              <Card size="small" style={{ height: "100%" }}>
                <Statistic
                  title="Length (PDB2, aligned)"
                  value={effLen2FromBlocks}
                  valueStyle={{ fontSize: 22 }}
                />
              </Card>
            </Col>

            <Col xs={24} md={6}>
              <Card size="small" style={{ height: "100%" }}>
                <Statistic
                  title="Aligned length"
                  value={alignedLen}
                  valueStyle={{ fontSize: 22 }}
                />
              </Card>
            </Col>
          </Row>

          <Card className="mb-4" size="small">
            <Spin spinning={tmLoading} indicator={<LoadingOutlined style={{ fontSize: 18 }} spin />}>
              {/* 🚀 [수정됨] % 제거 및 precision 4, 설명 텍스트 수정 */}
              <Statistic
                title="TM-score"
                value={tmLocal ?? 0}
                precision={4}
                valueStyle={{ fontSize: 22 }}
              />
              <div className="text-xs text-gray-500">(0.0 – 1.0)</div>
            </Spin>
          </Card>

          <Card className="mt-4" size="small" title="Pairwise alignment">
            <pre
              ref={preRef}
              className="ptmAlignPre"
              style={{
                fontFamily,
                fontSize: fontSizePx,
                lineHeight: 1.6,
                margin: 0,
                maxHeight: 420,
                minHeight: 220,
              }}
            >
              {effSelectedPdb1 ? `> ${effSelectedPdb1}\n` : ""}
              {effSelectedPdb2 ? `> ${effSelectedPdb2}\n\n` : ""}
              {alignmentText}
            </pre>

            <div className="mt-2 text-xs text-gray-600">
              <div>
                <strong>Legend:</strong> <span>|</span> = match, <span>*</span> = mismatch,{" "}
                <span style={{ fontFamily: "monospace" }}>-</span> = gap.
              </div>
              <div>
                The top ruler line shows residue indices for the first sequence (numbers every 5 residues). A leading{" "}
                <span style={{ fontFamily }}>&gt;</span> marks the beginning of each aligned sequence.
              </div>
            </div>
          </Card>
        </>
      )}
    </Card>
  );
}
"use client";

import { useEffect, useState } from "react";
import { Card, Empty, Typography } from "antd";
import SectionContainer from "@/components/section-container";
import { apiUrl, viewerUrlFor } from "@/lib/api";

const { Paragraph, Text } = Typography;

/* ---------- 로고 / 동영상 경로 ---------- */

const LOGO_SRC = "/strucptm/StrucPTMlogo.png";

/**
 * 동영상은 Spring → FastAPI 프록시(/movies/**)를 타게 만들었으므로
 * 상대 경로만 사용한다.
 *
 * 브라우저:
 *   https://prix.hanyang.ac.kr/strucptm  (홈)
 *   └ /movies/From_1IRK_to_1IR3.mp4 로 요청
 */
const IRK_MOVIE_URL = "/movies/From_1IRK_to_1IR3.mp4";

/** PDB 스냅샷 날짜: .env 에서 NEXT_PUBLIC_PDB_SNAPSHOT 로 설정 (YYYY-MM-DD) */
const PDB_SNAPSHOT_DATE_ENV =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_PDB_SNAPSHOT &&
  process.env.NEXT_PUBLIC_PDB_SNAPSHOT.trim()
    ? process.env.NEXT_PUBLIC_PDB_SNAPSHOT.trim()
    : "unknown";

/* ---------- 공통 유틸 ---------- */

function numberFmt(n: number | undefined) {
  if (typeof n !== "number" || Number.isNaN(n)) return "–";
  return n.toLocaleString();
}
function percentFmt(p: number) {
  if (typeof p !== "number" || Number.isNaN(p)) return "–";
  return `${(p * 100).toFixed(p >= 0.1 ? 1 : 2)}%`;
}

const SEG_COLORS = [
  "#4F7CAC",
  "#5FB49C",
  "#F4A259",
  "#E06C75",
  "#8E6C8A",
  "#17A2B8",
  "#7ACC7A",
  "#D9A441",
  "#B266FF",
  "#3C6E71",
  "#E2E8F0",
  "#A78BFA",
  "#60A5FA",
  "#34D399",
];

export type PieItem = { label: string; value?: number };

function buildConicGradient(items: PieItem[]) {
  const values = items.map((d) => d.value ?? 0);
  const sum = values.reduce((a, b) => a + b, 0);
  const n = items.length || 1;
  let acc = 0;
  const segs: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const color = SEG_COLORS[i % SEG_COLORS.length];
    const portion = sum > 0 ? values[i] / sum : 1 / n;
    const start = acc * 100;
    const end = (acc + portion) * 100;
    segs.push(`${color} ${start}% ${end}%`);
    acc += portion;
  }
  return `conic-gradient(${segs.join(", ")})`;
}

/** 좌: 도넛 / 우: 범례 */
function PieChartRow({
  title,
  items,
  size = 180,
}: {
  title: string;
  items: PieItem[];
  size?: number;
}) {
  const values = items.map((d) => d.value ?? 0);
  const sum = values.reduce((a, b) => a + b, 0);
  const bg = buildConicGradient(items);
  const centerHole = size * 0.56;

  return (
    <Card
      title={<span className="text-base md:text-lg font-semibold">{title}</span>}
      headStyle={{ padding: "8px 14px" }}
      bodyStyle={{ padding: 16 }}
    >
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
      ) : (
        <div className="flex flex-col md:flex-row md:items-start items-center gap-5">
          {/* Donut */}
          <div className="shrink-0">
            <div
              className="relative rounded-full border border-gray-200"
              style={{ background: bg, width: size, height: size }}
            >
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm"
                style={{ width: centerHole, height: centerHole }}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="w-full md:flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1.5">
              {items.map((it, idx) => {
                const v = values[idx];
                const pct = sum ? v / sum : 0;
                return (
                  <div
                    key={`${title}-${it.label}`}
                    className="flex min-w-0 items-center gap-2.5 text-[13px] leading-6"
                    title={`${it.label} • ${numberFmt(v)} (${percentFmt(pct)})`}
                  >
                    <span
                      className="inline-block rounded"
                      style={{
                        width: 11,
                        height: 11,
                        background: SEG_COLORS[idx % SEG_COLORS.length],
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.12) inset",
                      }}
                    />
                    <span className="flex-1 min-w-0 text-gray-800 truncate">
                      {it.label}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-700">
                      {numberFmt(v)}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-500">
                      ({percentFmt(pct)})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Page ---------- */

export default function HomePage() {
  const [ptmStats, setPtmStats] = useState<PieItem[]>([]);
  const [resStats, setResStats] = useState<PieItem[]>([]);
  const [orgStats, setOrgStats] = useState<PieItem[]>([]);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [uniqueStructures, setUniqueStructures] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setStatsLoading(true);
        const res = await fetch(apiUrl("/api/stats_overview"), {
          cache: "no-store",
        });
        if (!res.ok) {
          console.error("stats_overview HTTP", res.status);
          return;
        }
        const data: any = await res.json();
        setPtmStats((data?.ptm_type || []) as PieItem[]);
        setResStats((data?.residue_type || []) as PieItem[]);
        setOrgStats((data?.organism || []) as PieItem[]);

        // unique PTM-containing structures 수
        if (typeof data?.unique_mmcif_count === "number") {
          setUniqueStructures(data.unique_mmcif_count);
        }

        // 백엔드에서 snapshot_date 를 주면 우선 사용, 없으면 환경변수 사용
        if (typeof data?.snapshot_date === "string" && data.snapshot_date) {
          setSnapshotDate(data.snapshot_date);
        } else {
          setSnapshotDate(PDB_SNAPSHOT_DATE_ENV);
        }
      } catch (e) {
        console.error("stats_overview error:", e);
        setSnapshotDate(PDB_SNAPSHOT_DATE_ENV);
      } finally {
        setStatsLoading(false);
      }
    })();
  }, []);

  // 전체 PTM 사이트 수 (ptmStats 합)
  const totalPtmSites = ptmStats.reduce(
    (acc, item) => acc + (item.value ?? 0),
    0
  );

  return (
    <div className="space-y-5 p-4 text-[15px] leading-relaxed">
      {/* 헤더 정보 */}
      <SectionContainer className="space-y-3">
        <Card
          bodyStyle={{ padding: 20 }}
          className="border border-gray-200 shadow-sm"
        >
          {/* 로고 + 타이틀 */}
          <div className="flex items-center gap-4 mb-3">
            <img src={LOGO_SRC} alt="StrucPTM logo" className="h-11 w-auto" />
            <div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900">
                StrucPTM Database
              </div>
              <div className="text-[13px] md:text-sm text-gray-600">
                Structurally validated PTM residues and their conformational
                variation
              </div>
            </div>
          </div>

          {/* 소개 문단 */}
          <Paragraph className="text-[14px] md:text-[15px] text-gray-800 mb-0">
            StrucPTM database provides integrated information on
            post-translationally modified (PTM) residues by examining residue
            names and validating their atom composition in PDB structures. Using
            SIFTS (Structure Integration with Function, Taxonomy and Sequences),
            we first assemble sets of related PDB chains; we then perform
            sequence alignment among those chains to identify highly similar or
            identical sequences. This allows direct comparison of structures
            that share the same sequence but differ in PTM states, thereby
            enabling the analysis of structural alterations induced by PTMs.
          </Paragraph>
        </Card>
      </SectionContainer>

      {/* PTM로 인한 구조 변화: IRK inactive → active morph 영상 */}
      <SectionContainer
        title={
          <span className="text-base md:text-lg font-semibold">
            PTM-driven conformational change: insulin receptor kinase
          </span>
        }
        className="space-y-3.5"
      >
        <Card
          size="small"
          className="border border-gray-200"
          bodyStyle={{ padding: 18 }}
        >
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-center">
            {/* 설명 텍스트 (왼쪽) */}
            <div className="lg:flex-1 text-[14px] md:text-[15px] text-gray-800">
              <Paragraph className="mb-3">
                Phosphorylation can reorganize the three-dimensional structure
                of a signaling protein in a highly coordinated manner. The movie
                on the right visualizes an interpolation between an inactive
                insulin receptor kinase structure (<Text code>1IRK</Text>) and
                an active, phosphorylated state (<Text code>1IR3</Text>),
                highlighting how activation-loop phosphorylation is coupled to
                large rigid-body motions.
              </Paragraph>
              <Paragraph className="text-[12px] text-gray-600 leading-relaxed mb-0">
                Morph between inactive (1IRK) and active (1IR3) insulin receptor
                kinase structures. The trajectory illustrates how
                phosphorylation of the activation loop can propagate through the
                kinase core and reorganize the overall conformation. (Daily MD,
                Gray JJ (2009) Allosteric Communication Occurs via Networks of
                Tertiary and Quaternary Motions in Proteins. PLoS Comput Biol
                5(2): e1000293.{" "}
                <a
                  href="https://doi.org/10.1371/journal.pcbi.1000293"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  https://doi.org/10.1371/journal.pcbi.1000293
                </a>
                )
              </Paragraph>
            </div>

            {/* 영상 (오른쪽) */}
            <div className="lg:w-[300px] xl:w-[320px] flex justify-center lg:justify-end">
              <div className="w-full max-w-[320px] rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
                <div
                  className="relative w-full bg-white"
                  style={{ aspectRatio: "4 / 3" }}
                >
                  <video
                    src={IRK_MOVIE_URL}
                    autoPlay
                    loop
                    muted
                    controls
                    playsInline
                    className="absolute inset-0 w-full h-full object-contain bg-white"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </SectionContainer>

      {/* PTM 대표 사례 섹션: Src kinase 예시 */}
      <SectionContainer
        title={
          <span className="text-base md:text-lg font-semibold">
            Why PTMs matter
          </span>
        }
        className="space-y-3.5"
      >
        <Paragraph className="text-[14px] md:text-[15px] text-gray-800">
          In StrucPTM, each PTM site is annotated at residue level on deposited
          structures. This makes it possible to compare &quot;OFF-like&quot; and
          &quot;ON-like&quot; conformations along with their PTM status. Src
          kinase is a classic example where phosphorylation at a regulatory
          tyrosine and changes in activation-loop conformation together control
          signaling output. Comparing 1Y57 (an ON-like active conformation) and
          2SRC (an OFF-like autoinhibited, phosphorylated conformation)
          illustrates how phosphorylation at the regulatory tyrosine can switch
          Src from an ON to an OFF state.
        </Paragraph>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LEFT: 1Y57 (ON-like, no regulatory phosphorylation) */}
          <Card
            size="small"
            title={
              <span className="text-sm md:text-[15px] font-semibold">
                Src kinase active-like conformation without regulatory
                phosphorylation (1Y57)
              </span>
            }
          >
            <div className="text-[13px] md:text-[14px] text-gray-700 mb-2 leading-relaxed">
              This structure adopts an open activation loop and represents an
              &quot;ON-like&quot; active conformation of Src kinase. In the
              current StrucPTM data, no inhibitory phosphorylation at the
              regulatory tail is annotated for this PDB ID. By placing 1Y57
              side-by-side with 2SRC, users can examine how loss of regulatory
              phosphorylation correlates with activation of the kinase domain.
            </div>
            <div className="w-full h-[320px] rounded-lg overflow-hidden border border-gray-200">
              <iframe
                src={viewerUrlFor("1Y57:A")}
                title="Src kinase active-like conformation (1Y57)"
                loading="lazy"
                referrerPolicy="no-referrer"
                style={{ width: "100%", height: "100%", border: "0" }}
              />
            </div>
          </Card>

          {/* RIGHT: 2SRC (OFF-like, phosphorylated Tyr527) */}
          <Card
            size="small"
            title={
              <span className="text-sm md:text-[15px] font-semibold">
                Src kinase autoinhibited conformation with regulatory
                phosphorylation (2SRC)
              </span>
            }
          >
            <div className="text-[13px] md:text-[14px] text-gray-700 mb-2 leading-relaxed">
              This structure contains a phosphorylated regulatory tyrosine (for
              example, Tyr527 in chain A), annotated as a PTM residue. The
              overall fold represents an autoinhibited, &quot;OFF-like&quot;
              conformation in which intramolecular interactions involving the
              phosphorylated tail keep the kinase domain restrained. StrucPTM
              highlights such phosphorylated residues directly on the structure
              viewer, making it easy to relate PTM status to conformational
              state.
            </div>
            <div className="w-full h-[320px] rounded-lg overflow-hidden border border-gray-200">
              <iframe
                src={viewerUrlFor("2SRC:A")}
                title="Src kinase with regulatory phosphorylation (2SRC)"
                loading="lazy"
                referrerPolicy="no-referrer"
                style={{ width: "100%", height: "100%", border: "0" }}
              />
            </div>
          </Card>
        </div>
      </SectionContainer>

      {/* 통계 섹션 */}
      <SectionContainer
        title={
          <span className="text-base md:text-lg font-semibold">Statistics</span>
        }
        className="space-y-3.5"
      >
        {/* 설명 문단을 제일 위로 이동 */}
        <Paragraph className="text-[14px] md:text-[15px] text-gray-600 mb-1">
          All statistics below summarize PTM sites that have passed the StrucPTM
          processing and validation pipeline. The underlying structural data
          originate from{" "}
          <Text strong>Protein Data Bank (PDB)</Text> mmCIF entries. In the
          current build, StrucPTM contains{" "}
          <Text strong>{numberFmt(totalPtmSites)}</Text> PTM sites that satisfied
          our filtering criteria, distributed across{" "}
          <Text strong>
            {numberFmt(uniqueStructures ?? undefined)}
          </Text>{" "}
          unique mmCIF structures with at least one PTM annotation. The PDB
          snapshot used for this build corresponds to entries available as of{" "}
          <Text code>{snapshotDate ?? "unknown"}</Text>.
        </Paragraph>

        <PieChartRow title="PTM Type" items={ptmStats} />
        <PieChartRow title="Residue Type" items={resStats} />
        <PieChartRow title="Organism" items={orgStats} />
      </SectionContainer>

      {/* BIS Lab 정보 */}
      <SectionContainer
        title={
          <span className="text-base md:text-lg font-semibold">BIS Lab</span>
        }
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-[14px]">
          <Card title="About" size="small">
            <div className="text-gray-700 leading-relaxed">
              Bioinformatics and Intelligent Systems Lab (BIS Lab)
              <br />
              Department of Computer Science, Hanyang University
            </div>
          </Card>
          <Card title="Address" size="small">
            <div className="text-gray-700 leading-relaxed">
              R&amp;D Building 405, 222
              <br />
              Wangsimni-ro, Seongdong-gu
              <br />
              Seoul, Republic of Korea
            </div>
          </Card>
          <Card title="Contact info" size="small">
            <div className="text-gray-700 leading-relaxed">
              prix@hanyang.ac.kr
            </div>
          </Card>
        </div>
      </SectionContainer>
    </div>
  );
}

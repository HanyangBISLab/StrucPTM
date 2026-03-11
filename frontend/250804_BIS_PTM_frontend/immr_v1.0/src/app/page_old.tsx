"use client";

import { Card, Empty, Typography } from "antd";
import SectionContainer from "@/components/section-container";

const { Paragraph } = Typography;

/* ---------- 데이터 ---------- */
const PIE_ORGANISM = [
  { label: "Human", value: 31611 },
  { label: "Mouse", value: 6614 },
  { label: "Chicken", value: 3283 },
  { label: "Rat", value: 2673 },
  { label: "Yeast", value: 1784 },
  { label: "E. coli", value: 802 },
  { label: "Arabidopsis", value: 943 },
  { label: "Zebrafish", value: 278 },
  { label: "Others", value: 126958 },
];

const PIE_RESIDUE_TYPE = [
  { label: "Asparagine", value: 136164 },
  { label: "Lysine", value: 11639 },
  { label: "Serine", value: 6021 },
  { label: "Proline", value: 4192 },
  { label: "Threonine", value: 4158 },
  { label: "Methionine", value: 3524 },
  { label: "Cysteine", value: 2614 },
  { label: "Tyrosine", value: 2458 },
  { label: "Glutamine", value: 1478 },
  { label: "Histidine", value: 1290 },
  { label: "Glutamic acid", value: 852 },
  { label: "Alanine", value: 489 },
  { label: "Arginine", value: 67 },
];

const PIE_PTM_TYPE = [
  { label: "Glycosylation", value: 134291 },
  { label: "Methylation", value: 14946 },
  { label: "Phosphorylation", value: 9047 },
  { label: "Hydroxylation", value: 4243 },
  { label: "Formylation", value: 3483 },
  { label: "Oxidation", value: 2190 },
  { label: "N6-carboxylysine", value: 2108 },
  { label: "Acetylation", value: 1877 },
  { label: "Pyrrolidone carboxylic acid", value: 1423 },
  { label: "Gamma-carboxyglutamic acid", value: 695 },
  { label: "Sulfation", value: 469 },
  { label: "S-Nitrosylation", value: 98 },
  { label: "Nitration", value: 76 },
];

/* ---------- 유틸 ---------- */
function numberFmt(n: number) {
  return n.toLocaleString();
}
function percentFmt(p: number) {
  return `${(p * 100).toFixed(p >= 0.1 ? 1 : 2)}%`;
}
const SEG_COLORS = [
  "#4F7CAC", "#5FB49C", "#F4A259", "#E06C75", "#8E6C8A",
  "#17A2B8", "#7ACC7A", "#D9A441", "#B266FF", "#3C6E71", "#E2E8F0",
  "#A78BFA", "#60A5FA", "#34D399",
];
type PieItem = { label: string; value?: number };

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
  size = 170, // ⬅ 전체 비중을 낮추기 위해 조금 더 축소
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
      title={<span className="text-base font-semibold">{title}</span>}
      headStyle={{ padding: "8px 12px" }}
      bodyStyle={{ padding: 14 }}
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
                    className="flex min-w-0 items-center gap-2.5 text-[12px] leading-6"
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
  return (
    <div className="space-y-4 p-4">
      {/* 헤더 정보: 폰트 축소 */}
      <SectionContainer
        title={<span className="text-lg md:text-xl font-bold">BIS PTM Database</span>}
        className="space-y-1.5"
      >
        <Paragraph className="text-sm">
          This service provides integrated information on PTM residues extracted from PDB files,
          along with their mapping to UniProt IDs obtained from SIFTS.
        </Paragraph>
      </SectionContainer>

      {/* 섹션 타이틀도 축소 */}
      <SectionContainer
        title={<span className="text-base md:text-lg font-semibold">Statistics</span>}
        className="space-y-3.5"
      >
        <PieChartRow title="PTM Type" items={PIE_PTM_TYPE} />
        <PieChartRow title="Residue Type" items={PIE_RESIDUE_TYPE} />
        <PieChartRow title="Organism" items={PIE_ORGANISM} />
      </SectionContainer>

      <SectionContainer
        title={<span className="text-base md:text-lg font-semibold">BIS Lab</span>}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card title="About" size="small">
            <div className="text-[12px] text-gray-700 leading-relaxed">
              Bioinformatics and Intelligent Systems Lab (BIS Lab)<br />
              Department of Computer Science and Engineering, Hanyang University
            </div>
          </Card>
          <Card title="Address" size="small">
            <div className="text-[12px] text-gray-700 leading-relaxed">
              R&amp;D Building 405, 222<br />
              Wangsimni-ro, Seongdong-gu<br />
              Seoul, Republic of Korea
            </div>
          </Card>
          <Card title="Phone" size="small">
            <div className="text-[12px] text-gray-700 leading-relaxed">
              +82-2-2220-4704
            </div>
          </Card>
        </div>
      </SectionContainer>
    </div>
  );
}

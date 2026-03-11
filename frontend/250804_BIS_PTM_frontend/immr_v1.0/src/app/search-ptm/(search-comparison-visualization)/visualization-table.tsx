// src/app/search-ptm/(comparison)/visualization-table.tsx
"use client";

import { Table, Card, Row, Col, Tag } from "antd";
import { getAnnotationColor } from "../(search-results)/search-results-config";

interface PTMData {
  id: string;
  pdb_id_chain: string;   // 예: "1A0H:A" 또는 "1A0H"
  pdb_pos: string;        // residue number (string 유지, 정렬 시 Number 변환)
  residue_name: string;   // canonical residue name
  annotation: string;     // PTM type
  uniprot_accession?: string;
  pdb_restype?: string;

  // 추가 정보
  secondary_structure?: string; // e.g. H / E / C ...
  rsa?: number;                 // 0~1
}

interface ComparisonData {
  pdb1: PTMData[];
  pdb2: PTMData[];
}

interface VisualizationTableProps {
  selectedPdb1: string;
  selectedPdb2: string;
  comparisonData: ComparisonData;
  loading: boolean;
}

// 체인 추출: "132L:A" -> "A", "1A0H" -> "-"
const getChain = (pdb_id_chain: string): string => {
  if (!pdb_id_chain) return "-";
  const i = pdb_id_chain.indexOf(":");
  if (i < 0) return "-";
  const ch = pdb_id_chain.slice(i + 1).trim();
  return ch || "-";
};

function buildColumns() {
  return [
    {
      // 🔹 Chain 은 한 줄로 나오게
      title: (
        <span style={{ whiteSpace: "nowrap" }}>
          Chain
        </span>
      ),
      key: "chain",
      width: "10%",
      align: "center" as const,
      sorter: (a: PTMData, b: PTMData) =>
        getChain(a.pdb_id_chain).localeCompare(getChain(b.pdb_id_chain)),
      render: (_: unknown, record: PTMData) => (
        <span
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
          }}
        >
          {getChain(record.pdb_id_chain)}
        </span>
      ),
    },
    {
      title: "Residue number",
      dataIndex: "pdb_pos",
      key: "pdb_pos",
      sorter: (a: PTMData, b: PTMData) =>
        Number(a.pdb_pos) - Number(b.pdb_pos),
      width: "14%",
      align: "center" as const,
    },
    {
      title: "Residue name",
      dataIndex: "residue_name",
      key: "residue_name",
      sorter: (a: PTMData, b: PTMData) =>
        (a.residue_name || "").localeCompare(b.residue_name || ""),
      width: "22%",
    },
    {
      // 🔹 Secondary / structure 를 예쁘게 두 줄로
      title: (
        <span style={{ display: "inline-block", textAlign: "center" }}>
          <span>Secondary</span>
          <br />
          <span>structure</span>
        </span>
      ),
      dataIndex: "secondary_structure",
      key: "secondary_structure",
      width: "16%",
      align: "center" as const,
      sorter: (a: PTMData, b: PTMData) =>
        (a.secondary_structure || "").localeCompare(
          b.secondary_structure || ""
        ),
      render: (value: string | undefined) => value || "-",
    },
    {
      title: "RSA",
      dataIndex: "rsa",
      key: "rsa",
      width: "13%",
      align: "center" as const,
      sorter: (a: PTMData, b: PTMData) =>
        (a.rsa ?? -1) - (b.rsa ?? -1),
      render: (value: number | undefined) =>
        value === null || value === undefined ? "-" : value.toFixed(3),
    },
    {
      title: "PTM type",
      dataIndex: "annotation",
      key: "annotation",
      sorter: (a: PTMData, b: PTMData) =>
        (a.annotation || "").localeCompare(b.annotation || ""),
      width: "25%",
      render: (annotation: string) => (
        <Tag color={getAnnotationColor(annotation)}>{annotation}</Tag>
      ),
    },
  ];
}

export default function VisualizationTable({
  selectedPdb1,
  selectedPdb2,
  comparisonData,
  loading,
}: VisualizationTableProps) {
  const columns = buildColumns();

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={12}>
        <Card
          title={`${selectedPdb1} - PTM Data (${comparisonData.pdb1.length} entries)`}
          className="h-full"
        >
          <Table
            columns={columns}
            dataSource={comparisonData.pdb1}
            rowKey="id"
            size="small"
            scroll={{ y: 400 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} entries`,
            }}
            loading={loading}
            locale={{
              emptyText: loading
                ? "Loading..."
                : "No PTM data found for this PDB ID",
            }}
          />
        </Card>
      </Col>

      <Col xs={24} xl={12}>
        <Card
          title={`${selectedPdb2} - PTM Data (${comparisonData.pdb2.length} entries)`}
          className="h-full"
        >
          <Table
            columns={columns}
            dataSource={comparisonData.pdb2}
            rowKey="id"
            size="small"
            scroll={{ y: 400 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} entries`,
            }}
            loading={loading}
            locale={{
              emptyText: loading
                ? "Loading..."
                : "No PTM data found for this PDB ID",
            }}
          />
        </Card>
      </Col>
    </Row>
  );
}

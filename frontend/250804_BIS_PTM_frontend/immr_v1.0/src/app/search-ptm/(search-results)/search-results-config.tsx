// src/app/search-ptm/(search-results)/search-results-config.tsx
import { Tag, Tooltip, Button, Space, Dropdown } from "antd";
import { DownOutlined, SendOutlined } from "@ant-design/icons";
import { PTMRecord } from "./search-results-types";

/** PTM Tag 색상 매핑 */
export const getAnnotationColor = (annotation: string) => {
  const colors: Record<string, string> = {
    Phosphorylation: "blue",
    Methylation: "green",
    Acetylation: "orange",
    Ubiquitination: "red",
    Sumoylation: "purple",
    Glycosylation: "cyan",
    Hydroxylation: "lime",
    Oxidation: "gold",
    Formylation: "magenta",
    Sulfation: "volcano",
    Nitration: "geekblue",
    "S-Nitrosylation": "purple",
  };
  return colors[annotation] || "default";
};

/** 공백 제거 + 끝의 마침표 제거 (여러 개도 안전하게 제거) */
const cleanOrganism = (s?: string) => {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t.replace(/\.+\s*$/, ""); // 뒤쪽의 '.'들 및 뒤 공백 제거
};

type SelectMode = "first" | "second";

/** 테이블 컬럼 팩토리: onSelectPdb 콜백을 옵션으로 주입 */
export const getTableColumns = (opts?: {
  onSelectPdb?: (pdbChain: string, mode: SelectMode) => void;
}) => [
    {
      title: (
        <span style={{ whiteSpace: "nowrap" }}>
          PDB ID:chain
        </span>
      ),
      dataIndex: "pdb_id_chain",
      key: "pdb_id_chain",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        (a.pdb_id_chain || "").localeCompare(
          b.pdb_id_chain || ""
        ),
      width: 190,
      align: "left" as const,
      onHeaderCell: () => ({
        style: {
          textAlign: "left" as const,
        },
      }),
      render: (val?: string, record?: PTMRecord) => {
        if (!val)
          return <span style={{ color: "#bbb" }}>—</span>;
        const pdbId = val.split(":")[0]; // 체인(:) 앞부분만 추출
        const pdbUrl = `https://www.rcsb.org/structure/${pdbId}`;

        const items = [
          { key: "first", label: "Send to First" },
          { key: "second", label: "Send to Second" },
        ];

        return (
          <Space
            size={6}
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <a
              href={pdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in RCSB PDB"
            >
              {val}
            </a>
            <Dropdown
              menu={{
                items,
                onClick: (e) => {
                  const mode = e.key as SelectMode;
                  opts?.onSelectPdb?.(
                    record?.pdb_id_chain || val,
                    mode
                  );
                },
              }}
              trigger={["click"]}
            >
              <Tooltip title="Send this PDB:chain to the comparison inputs">
                <Button
                  size="small"
                  type="link"
                  icon={<SendOutlined />}
                >
                  Compare{" "}
                  <DownOutlined style={{ fontSize: 10 }} />
                </Button>
              </Tooltip>
            </Dropdown>
          </Space>
        );
      },
    },
    {
      title: "Residue number",
      dataIndex: "pdb_pos",
      key: "pdb_pos",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        Number(a.pdb_pos) - Number(b.pdb_pos),
      width: 110,
      align: "center" as const,
    },
    {
      title: "Residue name",
      dataIndex: "residue_name",
      key: "residue_name",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        (a.residue_name || "").localeCompare(
          b.residue_name || ""
        ),
      width: 140,
      align: "center" as const,
    },
    {
      title: "PTM type",
      dataIndex: "annotation",
      key: "annotation",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        (a.annotation || "").localeCompare(
          b.annotation || ""
        ),
      width: 140,
      align: "center" as const,
      render: (annotation?: string) => (
        <Tag color={getAnnotationColor(annotation || "")}>
          {annotation || "—"}
        </Tag>
      ),
    },
    // --- 새로 추가된 컬럼들 ---
    {
      title: "Assembly type",
      dataIndex: "assembly_type",
      key: "assembly_type",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        (a.assembly_type || "").localeCompare(
          b.assembly_type || ""
        ),
      width: 140,
      align: "center" as const,
      render: (text?: string) =>
        text ? (
          <span>{text}</span>
        ) : (
          <span style={{ color: "#bbb" }}>—</span>
        ),
    },
    {
      title: "Location",
      dataIndex: "location",
      key: "location",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        (a.location || "").localeCompare(
          b.location || ""
        ),
      width: 130,
      align: "center" as const,
      render: (text?: string) =>
        text ? (
          <span>{text}</span>
        ) : (
          <span style={{ color: "#bbb" }}>—</span>
        ),
    },
    {
      title: "Secondary structure",
      dataIndex: "secondary_structure",
      key: "secondary_structure",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        (a.secondary_structure || "").localeCompare(
          b.secondary_structure || ""
        ),
      width: 150,
      align: "center" as const,
      render: (text?: string) =>
        text ? (
          <span>{text}</span>
        ) : (
          <span style={{ color: "#bbb" }}>—</span>
        ),
    },
    {
      title: "RSA",
      dataIndex: "rsa",
      key: "rsa",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        (Number(a.rsa ?? -1) || 0) -
        (Number(b.rsa ?? -1) || 0),
      width: 90,
      align: "center" as const,
      render: (val?: number) =>
        val !== undefined && val !== null ? (
          val.toFixed(3)
        ) : (
          <span style={{ color: "#bbb" }}>—</span>
        ),
    },
    // --- 기존 컬럼들 ---
    {
      title: "UniProt ID",
      dataIndex: "uniprot_accession",
      key: "uniprot_accession",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        (a.uniprot_accession || "").localeCompare(
          b.uniprot_accession || ""
        ),
      width: 120,
      align: "center" as const,
      render: (acc?: string) =>
        acc ? (
          <a
            href={`https://www.uniprot.org/uniprotkb/${acc}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {acc}
          </a>
        ) : (
          <span style={{ color: "#bbb" }}>—</span>
        ),
    },
    {
      title: "Organism",
      dataIndex: "organism",
      key: "organism",
      sorter: (a: PTMRecord, b: PTMRecord) =>
        cleanOrganism(a.organism).localeCompare(
          cleanOrganism(b.organism)
        ),
      width: 190,
      align: "center" as const,
      render: (text?: string) => {
        const cleaned = cleanOrganism(text);
        return cleaned ? (
          cleaned
        ) : (
          <span style={{ color: "#bbb" }}>—</span>
        );
      },
    },
    {
      /** 헤더가 잘리지 않도록 두 줄로 표기 + 전체는 Tooltip로 제공 */
      title: (
        <Tooltip title="Sequence-homologous chains; format: PDB:chain | sequence identity (e.g., 4N0J:A|1.0000)">
          <span style={{ whiteSpace: "normal" }}>
            Homologous chains
            <span
              style={{
                display: "block",
                fontWeight: 400,
                fontSize: 12,
                color: "#666",
                lineHeight: 1.1,
              }}
            >
              (PDB:chain | sequence identity)
            </span>
          </span>
        </Tooltip>
      ),
      dataIndex: "related_pdb_chains",
      key: "related_pdb_chains",
      width: 320,
      onHeaderCell: () => ({
        style: {
          whiteSpace: "normal" as const,
          textAlign: "center" as const,
        },
      }),
      align: "left" as const,
      ellipsis: true,
      render: (text?: string) =>
        text ? (
          <Tooltip title={text}>
            <span style={{ cursor: "default" }}>{text}</span>
          </Tooltip>
        ) : (
          <span style={{ color: "#bbb" }}>—</span>
        ),
    },
  ];

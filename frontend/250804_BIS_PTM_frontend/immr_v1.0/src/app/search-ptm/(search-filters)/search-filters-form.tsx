// src/app/search-ptm/(search-filters)/search-filters-form.tsx
"use client";

import {
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Tooltip,
  Space,
  InputNumber,
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { SearchFilters } from "../(search-results)/search-results-types";
import { useCallback, useEffect } from "react";

/** ─────────────────────────────────────────────────────────────
 *  Canonical mappings for linked dropdowns (PTM ↔ Residue)
 *  ───────────────────────────────────────────────────────────── */
const RESIDUES_BY_PTM: Record<string, string[]> = {
  Methylation: [
    "Lysine",
    "Histidine",
    "Arginine",
    "Glutamine",
    "Cysteine",
    "Glutamic acid",
    "Asparagine",
  ],
  Phosphorylation: ["Threonine", "Serine", "Tyrosine"],
  Hydroxylation: ["Proline", "Lysine"],
  "Pyrrolidone carboxylic acid": ["Glutamine"],
  Oxidation: ["Cysteine", "Methionine"],
  "N6-carboxylysine": ["Lysine"],
  Sulfation: ["Tyrosine"],
  "Gamma-carboxyglutamic acid": ["Glutamic acid"],
  Formylation: ["Methionine"],
  Acetylation: ["Serine", "Alanine", "Lysine"],
  Nitration: ["Tyrosine"],
  "S-Nitrosylation": ["Cysteine"],
  Glycosylation: [
    "Asparagine",
    "Tyrosine",
    "Serine",
    "Threonine",
    "Cysteine",
    "Arginine",
  ],
};

const PTMS_BY_RESIDUE: Record<string, string[]> = {
  Lysine: ["Methylation", "N6-carboxylysine", "Acetylation", "Hydroxylation"],
  Threonine: ["Phosphorylation", "Glycosylation"],
  Proline: ["Hydroxylation"],
  Serine: ["Phosphorylation", "Acetylation", "Glycosylation"],
  Histidine: ["Methylation"],
  Arginine: ["Methylation", "Glycosylation"],
  Glutamine: ["Methylation", "Pyrrolidone carboxylic acid"],
  Cysteine: ["Methylation", "Oxidation", "S-Nitrosylation", "Glycosylation"],
  Tyrosine: ["Phosphorylation", "Sulfation", "Nitration", "Glycosylation"],
  "Glutamic acid": ["Gamma-carboxyglutamic acid", "Methylation"],
  Methionine: ["Formylation", "Oxidation"],
  Alanine: ["Acetylation"],
  Asparagine: ["Methylation", "Glycosylation"],
};

/** 전체 옵션(매핑 기반 자동 생성: PTM 없는 잔기는 제외) */
const ALL_RESIDUES: string[] = Array.from(
  new Set(Object.keys(PTMS_BY_RESIDUE))
).sort();
const ALL_PTMS: string[] = Array.from(
  new Set(Object.keys(RESIDUES_BY_PTM))
).sort();

/** UI 입력 → 백엔드/DB 캐논컬 라벨 매핑 */
const normalizeOrganismForApi = (s?: string): string | undefined => {
  if (!s) return s;
  const key = s.trim().toLowerCase().replace(/\.+\s*$/, "");
  const map: Record<string, string> = {
    human: "Human",
    mouse: "Mouse",
    yeast: "Yeast",
    arabidopsis: "Arabidopsis",
    zebrafish: "Zebrafish",
    chicken: "Chicken",
    rat: "Rattus norvegicus",
    "e. coli": "Escherichia coli",
    "e coli": "Escherichia coli",
    coli: "Escherichia coli",
  };
  return map[key] || s;
};

interface SearchFiltersFormProps {
  onFiltersChange: (filters: SearchFilters) => void;
}

export default function SearchFiltersForm({
  onFiltersChange,
}: SearchFiltersFormProps) {
  const [form] = Form.useForm();

  // 현재 선택값 감시
  const selectedResidue: string | undefined = Form.useWatch(
    "residue_name",
    form
  );
  const selectedPtm: string | undefined = Form.useWatch("annotation", form);

  // 선택에 따라 옵션 축소
  const residueOptions = (
    selectedPtm ? RESIDUES_BY_PTM[selectedPtm] || [] : ALL_RESIDUES
  ).map((v) => ({
    value: v,
    label: v,
  }));

  const ptmOptions = (
    selectedResidue ? PTMS_BY_RESIDUE[selectedResidue] || [] : ALL_PTMS
  ).map((v) => ({
    value: v,
    label: v,
  }));

  // 상충되는 값 자동 해제: PTM 선택 시 Residue 유효성 체크
  useEffect(() => {
    const rn = form.getFieldValue("residue_name");
    if (selectedPtm && rn && !(RESIDUES_BY_PTM[selectedPtm] || []).includes(rn)) {
      form.setFieldValue("residue_name", undefined);
    }
  }, [selectedPtm, form]);

  // 상충되는 값 자동 해제: Residue 선택 시 PTM 유효성 체크
  useEffect(() => {
    const ptm = form.getFieldValue("annotation");
    if (
      selectedResidue &&
      ptm &&
      !(PTMS_BY_RESIDUE[selectedResidue] || []).includes(ptm)
    ) {
      form.setFieldValue("annotation", undefined);
    }
  }, [selectedResidue, form]);

  // 입력값 정리 + organism 캐논컬 변환
  const cleanFormValues = (values: any): SearchFilters => {
    const cleaned: SearchFilters = {} as SearchFilters;

    if (values.pdb_id_chain?.trim())
      cleaned.pdb_id_chain = values.pdb_id_chain.trim();
    if (values.residue_name) cleaned.residue_name = values.residue_name;
    if (values.annotation) cleaned.annotation = values.annotation;
    if (values.uniprot_accession?.trim())
      cleaned.uniprot_accession = values.uniprot_accession.trim();
    if (values.organism)
      cleaned.organism = normalizeOrganismForApi(values.organism);

    // 새 필터들
    if (values.assembly_type) cleaned.assembly_type = values.assembly_type;
    if (values.location) cleaned.location = values.location;
    if (values.secondary_structure)
      cleaned.secondary_structure = values.secondary_structure;
    if (typeof values.rsa_min === "number") cleaned.rsa_min = values.rsa_min;
    if (typeof values.rsa_max === "number") cleaned.rsa_max = values.rsa_max;

    return cleaned;
  };

  const handleSubmit = useCallback(
    (values: any) => {
      onFiltersChange(cleanFormValues(values));
    },
    [onFiltersChange]
  );

  const handleReset = () => {
    form.resetFields();
    onFiltersChange({});
  };

  // ★ Example 버튼: 예제 필터 적용 + (중요) 비교 섹션 자동 입력/실행 이벤트 발행
  const handleExample = () => {
    const exampleValues = {
      pdb_id_chain: "132L",
      residue_name: "Lysine",
      annotation: "Methylation",
      uniprot_accession: "P00698",
      organism: "Chicken",
      assembly_type: "Monomer",
      location: "Non-interface",
      secondary_structure: "H",
      rsa_min: 0.5,
      rsa_max: 1.0,
    };

    form.setFieldsValue(exampleValues);
    const cleaned = cleanFormValues(exampleValues);
    onFiltersChange(cleaned);

    // ✅ 여기부터가 핵심 수정:
    // VisualizationSection은 ptm:setPdb 이벤트를 듣고 selectedPdb1/2를 채운 뒤 자동 compare를 수행함.
    // 기존 ptm:exampleCompare는 VisualizationSection이 듣지 않아서 아무 효과가 없었음.
    const EX_PDB1 = "132L:A";
    const EX_PDB2 = "4PRU:A";

    if (typeof window !== "undefined") {
      // 1) 비교 입력 자동 채우기
      window.dispatchEvent(
        new CustomEvent("ptm:setPdb", { detail: { mode: "first", pdb: EX_PDB1 } })
      );
      window.dispatchEvent(
        new CustomEvent("ptm:setPdb", { detail: { mode: "second", pdb: EX_PDB2 } })
      );

      // 2) (안전장치) runCompare 이벤트도 같이 쏨
      // - 현재 VisualizationSection이 이 이벤트를 듣지 않아도,
      //   ptm:setPdb만으로도 autoCompareArmedRef 로직이 돌게 되어 있음.
      // - 추후 ptm:runCompare 리스너를 붙여두면 더 견고해짐.
      window.dispatchEvent(
        new CustomEvent("ptm:runCompare", { detail: { pdb1: EX_PDB1, pdb2: EX_PDB2 } })
      );
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <Form
        form={form}
        autoComplete="off"
        layout="vertical"
        style={{ width: "100%" }}
        onFinish={handleSubmit}
      >
        {/* 1행: PDB / Residue / PTM */}
        <Row gutter={[24, 16]} style={{ width: "100%" }}>
          <Col span={8}>
            <Form.Item
              label={
                <span>
                  PDB ID Chain:{" "}
                  <Tooltip title="Enter PDB ID chain (e.g., 132L or 132L:A)">
                    <QuestionCircleOutlined style={{ color: "#1890ff" }} />
                  </Tooltip>
                </span>
              }
              name="pdb_id_chain"
            >
              <Input
                placeholder="Enter PDB ID chain (e.g., 132L or 132L:A)"
                onPressEnter={() => form.submit()}
                allowClear
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item
              label={
                <span>
                  Residue name:{" "}
                  <Tooltip title="Select residue name (e.g., serine)">
                    <QuestionCircleOutlined style={{ color: "#1890ff" }} />
                  </Tooltip>
                </span>
              }
              name="residue_name"
            >
              <Select
                allowClear
                placeholder="Select residue name (e.g., serine)"
                onKeyDown={(e) => e.key === "Enter" && form.submit()}
                style={{ width: "100%" }}
                options={residueOptions}
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item
              label={
                <span>
                  PTM type:{" "}
                  <Tooltip title="Select PTM type">
                    <QuestionCircleOutlined style={{ color: "#1890ff" }} />
                  </Tooltip>
                </span>
              }
              name="annotation"
            >
              <Select
                allowClear
                placeholder="Select PTM type"
                onKeyDown={(e) => e.key === "Enter" && form.submit()}
                style={{ width: "100%" }}
                options={ptmOptions}
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
        </Row>

        {/* 2행: UniProt / Organism / Assembly type */}
        <Row gutter={[24, 16]} style={{ width: "100%" }}>
          <Col span={8}>
            <Form.Item
              label={
                <span>
                  UniProt ID:{" "}
                  <Tooltip title="Enter UniProt ID (e.g., P00698)">
                    <QuestionCircleOutlined style={{ color: "#1890ff" }} />
                  </Tooltip>
                </span>
              }
              name="uniprot_accession"
            >
              <Input
                placeholder="Enter UniProt ID (e.g., P00698)"
                onPressEnter={() => form.submit()}
                allowClear
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item
              label={
                <span>
                  Organism:{" "}
                  <Tooltip title="Select organism">
                    <QuestionCircleOutlined style={{ color: "#1890ff" }} />
                  </Tooltip>
                </span>
              }
              name="organism"
            >
              <Select
                allowClear
                placeholder="Select organism"
                onKeyDown={(e) => e.key === "Enter" && form.submit()}
                style={{ width: "100%" }}
                options={[
                  { value: "Human", label: "Human" },
                  { value: "Mouse", label: "Mouse" },
                  { value: "Rat", label: "Rat" }, // → Rattus norvegicus 로 변환됨
                  { value: "Yeast", label: "Yeast" },
                  { value: "E. coli", label: "E. coli" }, // → Escherichia coli 로 변환됨
                  { value: "Arabidopsis", label: "Arabidopsis" },
                  { value: "Zebrafish", label: "Zebrafish" },
                  { value: "Chicken", label: "Chicken" },
                ]}
                showSearch
                filterOption={(input, option) =>
                  (option?.label as string)
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item
              label={
                <span>
                  Assembly type:{" "}
                  <Tooltip title="Select assembly type (e.g., Monomer / Multimer)">
                    <QuestionCircleOutlined style={{ color: "#1890ff" }} />
                  </Tooltip>
                </span>
              }
              name="assembly_type"
            >
              <Select
                allowClear
                placeholder="Select assembly type"
                onKeyDown={(e) => e.key === "Enter" && form.submit()}
                style={{ width: "100%" }}
                options={[
                  { value: "Monomer", label: "Monomer" },
                  { value: "Multimer", label: "Multimer" },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* 3행: Location / Secondary structure / RSA 범위 */}
        <Row gutter={[24, 16]} style={{ width: "100%" }}>
          <Col span={8}>
            <Form.Item
              label={
                <span>
                  Location:{" "}
                  <Tooltip title="Interface vs Non-interface">
                    <QuestionCircleOutlined style={{ color: "#1890ff" }} />
                  </Tooltip>
                </span>
              }
              name="location"
            >
              <Select
                allowClear
                placeholder="Select location"
                onKeyDown={(e) => e.key === "Enter" && form.submit()}
                style={{ width: "100%" }}
                options={[
                  { value: "Interface", label: "Interface" },
                  { value: "Non-interface", label: "Non-interface" },
                ]}
              />
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item
              label={
                <span>
                  Secondary structure:{" "}
                  <Tooltip title="DSSP secondary-structure code at the PTM site">
                    <QuestionCircleOutlined style={{ color: "#1890ff" }} />
                  </Tooltip>
                </span>
              }
              name="secondary_structure"
            >
              <Select
                allowClear
                placeholder="Select secondary structure"
                onKeyDown={(e) => e.key === "Enter" && form.submit()}
                style={{ width: "100%" }}
                options={[
                  { value: "H", label: "H (α-helix)" },
                  { value: "E", label: "E (β-strand)" },
                  { value: "C", label: "C (coil / other)" },
                  { value: "T", label: "T (turn)" },
                  { value: "S", label: "S (bend)" },
                  { value: "G", label: "G (3₁₀-helix)" },
                  { value: "B", label: "B (β-bridge)" },
                  { value: "I", label: "I (π-helix)" },
                ]}
              />
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item
              label={
                <span>
                  RSA range:{" "}
                  <Tooltip title="Relative solvent accessibility (0–1)">
                    <QuestionCircleOutlined style={{ color: "#1890ff" }} />
                  </Tooltip>
                </span>
              }
            >
              <Space>
                <Form.Item name="rsa_min" noStyle>
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.05}
                    placeholder="Min"
                    style={{ width: 90 }}
                  />
                </Form.Item>
                <span>~</span>
                <Form.Item name="rsa_max" noStyle>
                  <InputNumber
                    min={0}
                    max={1}
                    step={0.05}
                    placeholder="Max"
                    style={{ width: 90 }}
                  />
                </Form.Item>
              </Space>
            </Form.Item>
          </Col>
        </Row>

        {/* 4행: 버튼만 별도 행으로 */}
        <Row gutter={[24, 0]} style={{ width: "100%" }}>
          <Col span={24}>
            <Form.Item label=" " colon={false}>
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <Space size="middle">
                  <Button type="primary" htmlType="submit">
                    Apply
                  </Button>
                  <Button htmlType="button" onClick={handleExample}>
                    Apply example filters
                  </Button>
                  <Button htmlType="button" onClick={handleReset}>
                    Clear Filters
                  </Button>
                </Space>
              </div>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </div>
  );
}

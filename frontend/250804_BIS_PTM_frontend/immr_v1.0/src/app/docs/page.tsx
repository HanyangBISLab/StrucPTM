"use client";

import { Typography, Card, Table } from "antd";
import SectionContainer from "@/components/section-container";

const { Title, Paragraph, Text } = Typography;

// ---------- Atomic composition rules table data ----------
const atomicColumns = [
  { title: "PTM Type", dataIndex: "ptmType", key: "ptmType", width: 140 },
  {
    title: "Canonical Residue",
    dataIndex: "canonicalResidueLabel",
    key: "canonicalResidueLabel",
    width: 200,
  },
  {
    title: "Canonical Atoms",
    dataIndex: "canonicalAtoms",
    key: "canonicalAtoms",
    width: 220,
  },
  {
    title: "PTM Residue (PDB code)",
    dataIndex: "ptmResidueLabel",
    key: "ptmResidueLabel",
    width: 240,
  },
  {
    title: "Added Atoms",
    dataIndex: "addedAtoms",
    key: "addedAtoms",
    width: 220,
  },
];

const atomicData = [
  {
    ptmType: "Acetylation",
    canonicalResidueLabel: "Alanine (ALA)",
    canonicalAtoms: "N, CA, C, O, CB",
    ptmResidueLabel: "N-acetyl-alanine (AYA)",
    addedAtoms: "OT, CT, CM",
  },
  {
    ptmType: "Acetylation",
    canonicalResidueLabel: "Lysine (LYS)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, CE, NZ",
    ptmResidueLabel: "N6-acetyl-lysine (ALY)",
    addedAtoms: "CH, CH3, OH",
  },
  {
    ptmType: "Acetylation",
    canonicalResidueLabel: "Serine (SER)",
    canonicalAtoms: "N, CA, C, O, CB, OG",
    ptmResidueLabel: "O-acetyl-serine (SAC)",
    addedAtoms: "C2A, C1A, OAC",
  },
  {
    ptmType: "Formylation",
    canonicalResidueLabel: "Methionine (MET)",
    canonicalAtoms: "N, CA, C, O, CB, CG, SD, CE",
    ptmResidueLabel: "N-formyl-methionine (FME)",
    addedAtoms: "O1, CN",
  },
  {
    ptmType: "Gamma-carboxyglutamic acid",
    canonicalResidueLabel: "Glutamic acid (GLU)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, OE1, OE2",
    ptmResidueLabel: "carboxy-glutamic acid (CGU)",
    addedAtoms: "OE21, OE22, OE11, CD2, OE12, CD1",
  },
  {
    ptmType: "Hydroxylation",
    canonicalResidueLabel: "Lysine (LYS)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, CE, NZ",
    ptmResidueLabel: "Hydroxy-lysine (LYZ)",
    addedAtoms: "OH",
  },
  {
    ptmType: "Hydroxylation",
    canonicalResidueLabel: "Proline (PRO)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD",
    ptmResidueLabel: "4-hydroxy-proline (HYP)",
    addedAtoms: "OD1",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Arginine (ARG)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, NE, CZ, NH1, NH2",
    ptmResidueLabel: "Methyl-arginine (AGM)",
    addedAtoms: "NE1, CE2",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Asparagine (ASN)",
    canonicalAtoms: "N, CA, C, O, CB, CG, OD1, ND2",
    ptmResidueLabel: "Methyl-asparagine (MEN)",
    addedAtoms: "CE2",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Cysteine (CYS)",
    canonicalAtoms: "N, CA, C, O, CB, SG",
    ptmResidueLabel: "S-methyl-cysteine (SMC)",
    addedAtoms: "CS",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Cysteine (CYS)",
    canonicalAtoms: "N, CA, C, O, CB, SG",
    ptmResidueLabel: "S-methyl-cysteine (CMT)",
    addedAtoms: "C1",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Glutamine (GLN)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, OE1, NE2",
    ptmResidueLabel: "Methyl-glutamine (MGN)",
    addedAtoms: "CB1, CB2",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Glutamic acid (GLU)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, OE1, OE2",
    ptmResidueLabel: "Methyl-glutamic acid (MEA)",
    addedAtoms: "C1, CD2, CZ, CE2, CE1, CD1",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Histidine (HIS)",
    canonicalAtoms: "N, CA, C, O, CB, CG, ND1, CD2, CE1, NE2",
    ptmResidueLabel: "Methyl-histidine (HIC)",
    addedAtoms: "CZ",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Histidine (HIS)",
    canonicalAtoms: "N, CA, C, O, CB, CG, ND1, CD2, CE1, NE2",
    ptmResidueLabel: "Methyl-histidine (MHS)",
    addedAtoms: "CM",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Lysine (LYS)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, CE, NZ",
    ptmResidueLabel: "N6-methyl-lysine (MLY)",
    addedAtoms: "CH2, CH1",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Lysine (LYS)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, CE, NZ",
    ptmResidueLabel: "N6,N6,N6-trimethyl-lysine (M3L)",
    addedAtoms: "CM3, CM1, CM2",
  },
  {
    ptmType: "Methylation",
    canonicalResidueLabel: "Lysine (LYS)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, CE, NZ",
    ptmResidueLabel: "Methyl-lysine (MLZ)",
    addedAtoms: "CM",
  },
  {
    ptmType: "N6-carboxylysine",
    canonicalResidueLabel: "Lysine (LYS)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, CE, NZ",
    ptmResidueLabel: "N6-carboxy-lysine (KCX)",
    addedAtoms: "OQ2, OQ1, CX",
  },
  {
    ptmType: "Nitration",
    canonicalResidueLabel: "Tyrosine (TYR)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD1, CD2, CE1, CE2, CZ, OH",
    ptmResidueLabel: "3-nitro-tyrosine (NIY)",
    addedAtoms: "O2, NN, O1",
  },
  {
    ptmType: "Oxidation",
    canonicalResidueLabel: "Cysteine (CYS)",
    canonicalAtoms: "N, CA, C, O, CB, SG",
    ptmResidueLabel: "Cysteine sulfenic acid (CSO)",
    addedAtoms: "OD",
  },
  {
    ptmType: "Oxidation",
    canonicalResidueLabel: "Methionine (MET)",
    canonicalAtoms: "N, CA, C, O, CB, CG, SD, CE",
    ptmResidueLabel: "Methionine sulfoxide (OMT)",
    addedAtoms: "OD1, OD2",
  },
  {
    ptmType: "Phosphorylation",
    canonicalResidueLabel: "Serine (SER)",
    canonicalAtoms: "N, CA, C, O, CB, OG",
    ptmResidueLabel: "O-phospho-serine (SEP)",
    addedAtoms: "O3P, P, O1P, O2P",
  },
  {
    ptmType: "Phosphorylation",
    canonicalResidueLabel: "Threonine (THR)",
    canonicalAtoms: "N, CA, C, O, CB, OG1, CG2",
    ptmResidueLabel: "O-phospho-threonine (TPO)",
    addedAtoms: "O3P, P, O1P, O2P",
  },
  {
    ptmType: "Phosphorylation",
    canonicalResidueLabel: "Tyrosine (TYR)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD1, CD2, CE1, CE2, CZ, OH",
    ptmResidueLabel: "O-phospho-tyrosine (PTR)",
    addedAtoms: "O3P, P, O1P, O2P",
  },
  {
    ptmType: "Pyrrolidone carboxylic acid",
    canonicalResidueLabel: "Glutamine (GLN)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD, OE1, NE2",
    ptmResidueLabel: "Pyro-glutamate (PCA)",
    addedAtoms: "OE",
  },
  {
    ptmType: "S-Nitrosylation",
    canonicalResidueLabel: "Cysteine (CYS)",
    canonicalAtoms: "N, CA, C, O, CB, SG",
    ptmResidueLabel: "S-nitroso-cysteine (SNC)",
    addedAtoms: "OE, ND",
  },
  {
    ptmType: "Sulfation",
    canonicalResidueLabel: "Tyrosine (TYR)",
    canonicalAtoms: "N, CA, C, O, CB, CG, CD1, CD2, CE1, CE2, CZ, OH",
    ptmResidueLabel: "O-sulfo-tyrosine (TYS)",
    addedAtoms: "O2, O3, S, O1",
  },
];

export default function DocsPage() {
  const API_BASE = "https://prix.hanyang.ac.kr/strucptm/api";
  const SWAGGER_URL = "https://prix.hanyang.ac.kr/strucptm/api/docs";

  // ✅ 문서에 보여줄 “고급 예시” (네가 말한 조건 그대로)
  const exampleBody = `{
  "pdb_id_chain": "132L:A",
  "annotation": "Methylation",
  "organism": "Chicken",
  "assembly_type": ["Monomer", "Multimer"],
  "secondary_structure": ["H", "E"],
  "rsa_min": 0.2,
  "rsa_max": 1.0
}`;

  const exampleHttp = `POST ${API_BASE}/search_ptm_data
Content-Type: application/json

${exampleBody}`;

  const examplePowerShell = `$body = @'
${exampleBody}
'@

Invoke-RestMethod -Method Post \`
  -Uri "${API_BASE}/search_ptm_data" \`
  -ContentType "application/json" \`
  -Body $body`;

  const exampleCurl = `curl -X POST "${API_BASE}/search_ptm_data" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -d '${exampleBody.replace(/\n/g, " ")}'`;

  return (
    <SectionContainer>
      <Typography style={{ padding: "24px 0 40px 0" }}>
        {/* ---------- 1. Updates ---------- */}
        <Card bordered={false} style={{ marginBottom: 24 }}>
          <Title level={3}>1. Updates</Title>
          <Paragraph>
            <Text strong>Weekly updates.</Text> StrucPTM is rebuilt on a{" "}
            <Text strong>weekly</Text> basis using the latest PDB mmCIF, SIFTS,
            and UniProt releases; DSSP-derived annotations are recomputed for
            each build.
          </Paragraph>
        </Card>

        {/* ---------- 2. Web interface usage ---------- */}
        <Card bordered={false} style={{ marginBottom: 24 }}>
          <Title level={3}>2. Web interface usage</Title>
          <Paragraph>
            The StrucPTM web interface can be understood in four parts:{" "}
            <Text strong>search filters</Text>, <Text strong>search results</Text>,{" "}
            <Text strong>PDB selection for comparison</Text>, and{" "}
            <Text strong>comparison view</Text>.
          </Paragraph>
          <ol>
            <li>
              <Text strong>Search filters.</Text> In the <Text code>Search</Text>{" "}
              tab, specify <Text code>UniProt ID</Text> or{" "}
              <Text code>PDB ID:Chain</Text> (e.g. <Text code>132L:A</Text>),
              then optionally refine by PTM type, assembly type, location,
              secondary structure, and RSA range.
            </li>
            <li>
              <Text strong>Search results.</Text> The results table lists curated
              PTM entries matching the filters. Each row shows identifiers and
              structural context.
            </li>
            <li>
              <Text strong>PDB selection for comparison.</Text> Clicking{" "}
              <Text strong>Compare</Text> opens a view where you can select
              homologous PDB chains (from the same UniProt) as comparison targets.
            </li>
            <li>
              <Text strong>Comparison view.</Text> Selected structures are shown
              in a 3D viewer. The PTM residue is highlighted with residue number
              and residue name, and the sequence alignment results are displayed
              below the viewer.
            </li>
          </ol>
        </Card>

        {/* ---------- 3. Atomic composition rules ---------- */}
        <Card bordered={false} style={{ marginBottom: 24 }}>
          <Title level={3}>3. Atomic composition rules for PTM validation</Title>
          <Paragraph>
            For selected PTM types, StrucPTM validates each modified residue by
            checking that the atom set in the mmCIF file matches an expected{" "}
            <Text strong>canonical&nbsp;+&nbsp;added atoms</Text> pattern. The
            table below lists the atomic composition rules used in this release.
          </Paragraph>

          <Table
            dataSource={atomicData}
            columns={atomicColumns}
            size="small"
            pagination={false}
            scroll={{ x: true }}
            rowKey={(row) => `${row.ptmType}-${row.ptmResidueLabel}`}
          />

          <Paragraph type="secondary" style={{ marginTop: 8 }}>
            Canonical atoms correspond to the backbone and side-chain atoms of
            the unmodified residue. “Added atoms” represent additional atoms
            introduced by the PTM group and must be present for a residue to be
            considered a valid instance of that PTM.
          </Paragraph>
        </Card>

        {/* ---------- 4. API access ---------- */}
        <Card bordered={false} style={{ marginBottom: 24 }}>
          <Title level={3}>4. API access</Title>

          <Paragraph>
            StrucPTM provides programmatic access via a REST API. Interactive API
            documentation (Swagger UI) is available at{" "}
            <Text code>{SWAGGER_URL}</Text>.
          </Paragraph>

          <Paragraph>
            The API base URL is <Text code>{API_BASE}</Text>. The primary endpoint is{" "}
            <Text code>POST /search_ptm_data</Text>, which returns curated PTM entries
            using the same filters as the web interface.
          </Paragraph>

          <Title level={4} style={{ marginTop: 8 }}>
            4.1 <Text code>POST /search_ptm_data</Text>
          </Title>

          <Paragraph>
            Example request body (multiple filters):
          </Paragraph>

          <pre
            style={{
              background: "#fafafa",
              padding: "12px 16px",
              borderRadius: 8,
              overflowX: "auto",
              marginBottom: 12,
            }}
          >
            {exampleHttp}
          </pre>

          <Paragraph style={{ marginTop: 10 }}>
            <Text strong>Example (PowerShell)</Text>
          </Paragraph>
          <pre
            style={{
              background: "#fafafa",
              padding: "12px 16px",
              borderRadius: 8,
              overflowX: "auto",
              marginBottom: 12,
            }}
          >
            {examplePowerShell}
          </pre>

          <Paragraph style={{ marginTop: 10 }}>
            <Text strong>Example (curl, bash/Linux/macOS)</Text>
          </Paragraph>
          <pre
            style={{
              background: "#fafafa",
              padding: "12px 16px",
              borderRadius: 8,
              overflowX: "auto",
              marginBottom: 0,
            }}
          >
            {exampleCurl}
          </pre>

          <Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
            Note: On Windows PowerShell, using <Text code>Invoke-RestMethod</Text>{" "}
            is recommended for POST requests to avoid JSON quoting issues. In bash
            environments, <Text code>curl</Text> is typically the simplest option.
          </Paragraph>
        </Card>

        {/* ---------- 5. Citation ---------- */}
        <Card bordered={false} style={{ marginBottom: 24 }}>
          <Title level={3}>5. Citation</Title>
          <Paragraph>
            When using StrucPTM in your work, please cite the StrucPTM database
            paper:
          </Paragraph>
          <ul>
            <li>
              <Text strong>“StrucPTM” – main database and curation manuscript.</Text>{" "}
              <Text type="secondary">(link to be added after publication)</Text>
            </li>
          </ul>
        </Card>
      </Typography>
    </SectionContainer>
  );
}

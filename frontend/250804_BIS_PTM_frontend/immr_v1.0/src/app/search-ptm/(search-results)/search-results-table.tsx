// src/app/search-ptm/(search-results)/search-results-table.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LoadingOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import {
  App,
  Spin,
  Table,
  Button,
  Space,
  Tooltip,
} from "antd";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  PTMRecord,
  SearchFilters,
} from "./search-results-types";
import { loadPTMData } from "./search-results-api";
import {
  applyFiltersToData,
  hasActiveFilters,
} from "./search-results-filters";
import { getTableColumns } from "./search-results-config";

type SelectMode = "first" | "second";

export default function SearchResultsTable({
  filters,
}: {
  filters?: SearchFilters;
}) {
  const { message } = App.useApp();

  const [data, setData] = useState<PTMRecord[]>([]);
  const [allData, setAllData] = useState<PTMRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  // 결과 테이블 → 비교 입력창으로 값 보내기(커스텀 이벤트)
  const emitSendToCompare = useCallback(
    (pdbChain: string, mode: SelectMode) => {
      window.dispatchEvent(
        new CustomEvent("ptm:setPdb", {
          detail: { mode, pdb: pdbChain },
        })
      );
      message.success(
        `Sent ${pdbChain} to ${mode === "first" ? "First" : "Second"} input`
      );
    },
    [message]
  );

  /**
   * organism 문자열 정리 (보수적, 특수 케이스만 처리):
   * - "CSA)." / "CSA)" 꼬리 → "CSA"
   * - "thermoautotrophicum)." / "thermoautotrophicum)" 꼬리 → "thermoautotrophicum"
   * - 그 외는 건드리지 않음
   */
  const sanitizeOrganismString = (
    val: unknown
  ): string => {
    if (typeof val !== "string") return val as any;
    let t = val.trim();

    // 1) C2A 꼬리 정리: "C2A)." 또는 "C2A)" (중간 공백 허용)
    t = t.replace(
      /\bC2A\)\s*\.?\s*$/i,
      "C2A"
    );

    // 2) thermoautotrophicum 꼬리 정리
    t = t.replace(
      /\bthermoautotrophicum\)\s*\.?\s*$/i,
      "thermoautotrophicum"
    );

    // 2-보강) 단어 끝이 'cum'이고 바로 ")"/")."로 끝나는 특이 꼬리도 정리
    t = t.replace(
      /\bcum\)\s*\.?\s*$/i,
      "cum"
    );

    return t;
  };

  const sanitizeOrganismField = (
    rec: PTMRecord
  ): PTMRecord => {
    const cleaned = sanitizeOrganismString(rec.organism);
    return { ...rec, organism: cleaned };
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const ptmData = await loadPTMData(filters);
      const cleanedData = ptmData.map(
        sanitizeOrganismField
      );

      setAllData(cleanedData);

      const filtered = applyFiltersToData(
        cleanedData,
        filters
      );
      setData(filtered);
      setPagination((p) => ({
        ...p,
        total: filtered.length,
        current: 1,
      }));

      // 🚀 조건에 따른 스마트 알림 메시지 로직 복구
      if (hasActiveFilters(filters)) {
        if (filtered.length >= 30000) {
          message.warning({
            key: "ptm-search-toast",
            content: `Found ${filtered.length.toLocaleString()} PTM records (Results limited to 30,000 for stability)`,
            duration: 4, // 메시지가 길어 4초 유지
          });
        } else if (filtered.length > 0) {
          message.success({
            key: "ptm-search-toast",
            content: `Found ${filtered.length.toLocaleString()} PTM records`,
            duration: 2,
          });
        } else {
          message.info({
            key: "ptm-search-toast",
            content: "No PTM records match the criteria",
            duration: 2,
          });
        }
      }
    } catch (err: any) {
      console.error("Error loading PTM data:", err);
      message.error(
        `Failed to load PTM data: ${err?.message || err}`
      );
      setAllData([]);
      setData([]);
      setPagination((p) => ({
        ...p,
        total: 0,
        current: 1,
      }));
    } finally {
      setLoading(false);
    }
  }, [filters, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTableChange = useCallback(
    (newPagination: any) => {
      setPagination(newPagination);
    },
    []
  );

  const handleDownloadJson = useCallback(() => {
    if (!data?.length) {
      message.info("No filtered records to download.");
      return;
    }
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "");
    const filename = `ptm_search_results_filtered_${stamp}.json`;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    message.success(
      `Downloading ${data.length.toLocaleString()} filtered records as ${filename}`
    );
  }, [data, message]);

  const handleDownloadZip = useCallback(async () => {
    if (!data?.length) {
      message.info("No filtered records to download.");
      return;
    }
    try {
      setLoading(true);
      message.loading({ content: `Preparing ZIP download for ${data.length.toLocaleString()} records...`, key: "zip-download", duration: 0 });

      const zip = new JSZip();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");

      // 1. Add JSON data
      zip.file(`results_${stamp}.json`, JSON.stringify(data, null, 2));

      // 2. Add CIFs and FASTAs
      const cifFolder = zip.folder("cif");
      const fastaFolder = zip.folder("fasta");

      // Extract unique PDBs and PDB:Chain pairs
      const uniquePdbs = new Set<string>();
      const uniqueStructs = new Set<string>();

      data.forEach((r) => {
        if (r.pdb_id_chain) {
          const parts = r.pdb_id_chain.split(":");
          if (parts.length >= 2) {
            const pdb = parts[0].trim().toUpperCase();
            const chain = parts[1].trim().toUpperCase();
            if (pdb) uniquePdbs.add(pdb);
            if (pdb && chain) uniqueStructs.add(`${pdb}_${chain}`);
          }
        }
      });

      const fetchInChunks = async (items: string[], fn: (item: string) => Promise<void>, chunkSize = 5) => {
        for (let i = 0; i < items.length; i += chunkSize) {
          await Promise.all(items.slice(i, i + chunkSize).map(fn));
        }
      };

      // Fetch CIFs (Whole PDB)
      await fetchInChunks(Array.from(uniquePdbs), async (pdb) => {
        try {
          const res = await fetch(`/api/cif/${pdb.toLowerCase()}`);
          if (res.ok) {
            const text = await res.text();
            cifFolder?.file(`${pdb}.cif`, text);
          }
        } catch (e) {
          console.error(`Failed to fetch CIF for ${pdb}`, e);
        }
      });

      // Fetch FASTAs specific to Chain (using /api/sequences?pdb=...&chain=...)
      await fetchInChunks(Array.from(uniqueStructs), async (structStr) => {
        const [pdb, chain] = structStr.split("_");
        try {
          const res = await fetch(`/api/sequences?pdb=${pdb.toLowerCase()}&chain=${chain}`);
          if (res.ok) {
            const json = await res.json();
            if (json.sequence) {
              const header = `>${pdb}:${chain}|length=${json.length}`;
              fastaFolder?.file(`${pdb}_${chain}.fasta`, `${header}\n${json.sequence}\n`);
            }
          }
        } catch (e) {
          console.error(`Failed to fetch FASTA for ${structStr}`, e);
        }
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `strucptm_download_${stamp}.zip`);

      message.success({ content: "ZIP download complete!", key: "zip-download", duration: 3 });
    } catch (err: any) {
      console.error(err);
      message.error({ content: `Error creating ZIP file: ${err.message || err}`, key: "zip-download", duration: 3 });
    } finally {
      setLoading(false);
    }
  }, [data, message]);

  // onSelectPdb 콜백을 컬럼에 주입
  const columns = useMemo(
    () =>
      getTableColumns({
        onSelectPdb: (key, mode) =>
          emitSendToCompare(key, mode),
      }),
    [emitSendToCompare]
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        {/* 🚀 테이블 제목도 30,000개일 때만 동적으로 (maximum 30,000) 표시 */}
        <h3 className="text-lg font-semibold">
          PTM Search Results ({data.length.toLocaleString()} of{" "}
          {allData.length.toLocaleString()} records){allData.length >= 30000 ? " (maximum 30,000)" : ""}
        </h3>
        <Space size="middle" align="center">
          {hasActiveFilters(filters) && (
            <span className="text-sm text-gray-600">
              Filters applied:{" "}
              {Object.keys(filters || {}).filter(
                (k) => (filters as any)?.[k]
              ).length}
            </span>
          )}

          {/* 💡 테이블 데이터만 다운로드하는 버튼으로 이름/툴팁 변경 */}
          <Tooltip title="Download the results table metadata">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadJson}
            >
              Download Table (JSON)
            </Button>
          </Tooltip>

          {/* 💡 파일 전체 압축 다운로드 버튼으로 이름/툴팁 변경 */}
          <Tooltip title="Includes result table, .cif, and .fasta files">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadZip}
            >
              Download All Files (ZIP)
            </Button>
          </Tooltip>
        </Space>
      </div>

      <Table
        loading={{
          indicator: (
            <Spin
              indicator={
                <LoadingOutlined
                  style={{ fontSize: 24 }}
                  spin
                />
              }
            />
          ),
          tip: "Loading PTM data...",
          spinning: loading,
        }}
        columns={columns}
        dataSource={data}
        rowKey="id"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total.toLocaleString()} entries`,
        }}
        onChange={handleTableChange}
        scroll={{ y: "calc(100vh - 300px)" }}
        size="middle"
        bordered
        rowClassName={(_, idx) =>
          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
        }
      />
    </div>
  );
}
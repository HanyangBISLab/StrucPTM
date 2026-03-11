"use client";

import { Card, Row, Col, Switch, Space } from "antd";
import { useEffect, useRef, useState } from "react";
import { viewerUrlFor } from "@/lib/api";

interface Visualization3DProps {
  selectedPdb1: string; // 제출된 값(확정)
  selectedPdb2: string; // 제출된 값(확정)
}

const normalizePdb = (s: string) =>
  (s ?? "").trim().toUpperCase().replace(/\s+/g, "");

export default function Visualization3D({
  selectedPdb1,
  selectedPdb2,
}: Visualization3DProps) {
  const iframe1Ref = useRef<HTMLIFrameElement | null>(null);
  const iframe2Ref = useRef<HTMLIFrameElement | null>(null);
  
  // Sync/Async 상태를 관리하는 State
  const [isSynced, setIsSynced] = useState<boolean>(true);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Async 모드일 경우 시점 동기화 이벤트를 무시
      if (!isSynced) return; 

      if (e.data && e.data.type === "sync-camera") {
        const { view } = e.data;
        if (iframe1Ref.current?.contentWindow === e.source && iframe2Ref.current?.contentWindow) {
          iframe2Ref.current.contentWindow.postMessage({ type: "sync-camera", view }, "*");
        } else if (iframe2Ref.current?.contentWindow === e.source && iframe1Ref.current?.contentWindow) {
          iframe1Ref.current.contentWindow.postMessage({ type: "sync-camera", view }, "*");
        }
      }
    };
    
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isSynced]);

  useEffect(() => {
    const v = normalizePdb(selectedPdb1);
    if (iframe1Ref.current)
      iframe1Ref.current.src = v ? viewerUrlFor(v) : "about:blank";
    return () => {
      if (iframe1Ref.current) iframe1Ref.current.src = "about:blank";
    };
  }, [selectedPdb1]);

  useEffect(() => {
    const v = normalizePdb(selectedPdb2);
    if (iframe2Ref.current)
      iframe2Ref.current.src = v ? viewerUrlFor(v) : "about:blank";
    return () => {
      if (iframe2Ref.current) iframe2Ref.current.src = "about:blank";
    };
  }, [selectedPdb2]);

  return (
    <Card title="3D Visualization" className="mb-6">
      
      {/* 🚀 중앙 정렬 & 크기 확대한 토글 스위치 UI */}
      <div className="flex justify-center items-center mb-8 mt-2">
        <Space size="large">
          <span className="text-lg font-bold text-gray-700">
            Camera Mode:
          </span>
          <Switch
            checkedChildren={<span style={{ fontSize: "14px" }}>Sync</span>}
            unCheckedChildren={<span style={{ fontSize: "14px" }}>Async</span>}
            checked={isSynced}
            onChange={(checked) => setIsSynced(checked)}
            style={{ transform: "scale(1.3)", transformOrigin: "left center" }}
          />
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold">
              {normalizePdb(selectedPdb1) || "-"}
            </h3>
          </div>
          <iframe
            ref={iframe1Ref}
            title={`viewer-${normalizePdb(selectedPdb1) || "left"}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "420px", border: "none" }}
          />
        </Col>

        <Col xs={24} lg={12}>
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold">
              {normalizePdb(selectedPdb2) || "-"}
            </h3>
          </div>
          <iframe
            ref={iframe2Ref}
            title={`viewer-${normalizePdb(selectedPdb2) || "right"}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "420px", border: "none" }}
          />
        </Col>
      </Row>
    </Card>
  );
}
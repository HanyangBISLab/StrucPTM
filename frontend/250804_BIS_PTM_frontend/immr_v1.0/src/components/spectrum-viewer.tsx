"use client";

import { useRef } from "react";

import { SpectrumData } from "@/types/search";

interface Props {
  data: SpectrumData;
}

// 스펙트럼을 넣는 컴포넌트
export default function SpectrumViewer({ data }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <iframe
      ref={iframeRef}
      src={"/use/UniversalSpectrumExplorer.html"}
      width="100%"
      height="350px"
      onLoad={() => {
        if (iframeRef.current) {
          const iframeWindow = iframeRef.current.contentWindow;
          iframeWindow?.postMessage(data, "*");
        }
      }}
    />
  );
}

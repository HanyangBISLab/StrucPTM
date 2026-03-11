"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SectionContainerProps = React.PropsWithChildren<{
  className?: string;
  title?: string;
}>;

// 흰 바탕에 테두리가 있는 섹션 컨테이너
export default function SectionContainer({
  title,
  className,
  children,
}: SectionContainerProps) {
  return (
    <section
      className={cn(
        "rounded bg-white p-6 shadow-[0_1px_4px_0_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {title ? <h2 className="mb-4">{title}</h2> : null}
      {children}
    </section>
  );
}

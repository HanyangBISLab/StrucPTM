// src/components/nav-bar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MenuProps } from "antd";
import { getBasePath } from "@/lib/utils";

export default function Navbar() {
  const pathname = usePathname();
  // getBasePath 가 "/strucptm/search-ptm" -> "/search-ptm" 으로 정리해 주는 헬퍼라고 가정
  const selectedKey = getBasePath(pathname) || "/";

  // 👉 이 빌드는 항상 https://prix.hanyang.ac.kr/strucptm 밑에서 쓴다고 가정
  const prefix = "/strucptm";

  const items: MenuProps["items"] = [
    {
      label: (
        <Link href={`${prefix}`} className="nav-link">
          Home
        </Link>
      ),
      // 라우팅 기준 key는 basePath 제거한 값으로 유지
      key: "/",
    },
    {
      label: (
        <Link href={`${prefix}/search-ptm`} className="nav-link">
          Search
        </Link>
      ),
      key: "/search-ptm",
    },
    {
      label: (
        <Link href={`${prefix}/docs`} className="nav-link">
          Documentation
        </Link>
      ),
      key: "/docs",
    },
  ];

  return (
    <Menu
      mode="horizontal"
      selectedKeys={[selectedKey]}
      items={items}
      className="w-full justify-center bg-transparent border-b-0"
      rootClassName="app-nav"
    />
  );
}

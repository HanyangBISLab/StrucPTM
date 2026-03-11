import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { Layout } from "antd";
import { Content, Header } from "antd/es/layout/layout";

import Navbar from "@/components/nav-bar";

import "@/styles/style.scss";

import { ChildrenOnly } from "@/types";

import Providers from "@/lib/providers";

import { cn } from "../lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "StrucPTM database",
  description: "StrucPTM database",
};

// 공통 레이아웃 및 주요 설정 적용
export default function RootLayout({ children }: ChildrenOnly) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "min-h-screen")}>
        <Providers>
          <Layout className="h-full min-h-screen min-w-[1140px] px-6">
            <Header className="flex h-[60px] items-center border-b border-gray-200 bg-transparent px-6">
              {/*<Link href="/">
                <Image
                  src={"/logo.png"}
                  alt="IMMUNO RESOURCES"
                  width={180}
                  height={16}
                />
              </Link>
              */}
              <Navbar />
            </Header>
            <Content className="mx-auto size-full max-w-screen-2xl py-4">
              {children}
            </Content>
          </Layout>
        </Providers>
      </body>
    </html>
  );
}

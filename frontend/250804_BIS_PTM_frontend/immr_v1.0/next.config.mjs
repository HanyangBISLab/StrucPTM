import path from "path";
import { fileURLToPath } from "url";

/** @type {import('next').NextConfig} */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  // Dev에서 useEffect 두 번 도는 거 방지
  reactStrictMode: false,

  // ✅ 정적 리소스(_next 이하)를 /strucptm 밑에서 서빙
  //    - chunk URL: /strucptm/_next/static/...
  assetPrefix: "/strucptm",

  sassOptions: {
    includePaths: [path.join(__dirname, "styles")],
  },

  webpack(config) {
    // 기존 SVG rule 찾기
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.(".svg")
    );

    config.module.rules.push(
      // *.svg?url 은 기존 file-loader 사용
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // 나머지 *.svg 는 React 컴포넌트로
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
        use: ["@svgr/webpack"],
      }
    );

    // 기존 file-loader 는 svg 제외
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },
};

export default nextConfig;

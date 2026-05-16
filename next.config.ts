import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Agent 프롬프트 .txt 파일은 런타임에 fs로 읽으므로 @vercel/nft가 정적 추적하지 못한다.
  // 배포 산출물(standalone/serverless)에 명시적으로 포함시킨다.
  outputFileTracingIncludes: {
    "/api/agent/interact": ["src/game-core/agent/prompts/**/*.txt"],
  },
};

export default nextConfig;

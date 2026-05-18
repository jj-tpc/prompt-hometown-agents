import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 게임 화면을 스튜디오 iframe에 임베드할 때 좌하단 dev 인디케이터가 보이지 않도록 끈다.
  devIndicators: false,
  // Agent 프롬프트 .txt 파일은 런타임에 fs로 읽으므로 @vercel/nft가 정적 추적하지 못한다.
  // 배포 산출물(standalone/serverless)에 명시적으로 포함시킨다.
  outputFileTracingIncludes: {
    "/api/agent/interact": ["src/game-core/agent/prompts/**/*.txt"],
    "/api/prompts/npc/[npcId]": ["src/game-core/agent/prompts/npcs/*.txt"],
  },
};

export default nextConfig;

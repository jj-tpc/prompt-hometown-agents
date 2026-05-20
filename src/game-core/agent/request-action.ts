import type { NPCAction, NpcDestinationKind } from "@/game-core/types/game"

const DESTINATION_KEYWORDS: Array<{ kind: NpcDestinationKind; keywords: string[] }> = [
  { kind: "waterfront", keywords: ["물가", "강가", "호수", "물가 근처"] },
  { kind: "forest", keywords: ["숲", "나무", "숲 근처"] },
  { kind: "sand", keywords: ["모래", "모래밭", "모래 지형"] },
  { kind: "house", keywords: ["집", "집 주변", "건물", "문 앞"] },
  { kind: "grass", keywords: ["잔디", "잔디밭", "풀밭"] },
]

function compactKorean(input: string): string {
  return input.toLocaleLowerCase("ko-KR").replace(/\s+/g, "")
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(compactKorean(keyword)))
}

export function actionFromAcceptedRequest(
  userRequest: string,
  modelAction: NPCAction | undefined
): NPCAction | undefined {
  if (modelAction) return modelAction

  const normalized = compactKorean(userRequest)
  if (
    normalized.includes("따라와") ||
    normalized.includes("따라와줘") ||
    normalized.includes("따라와주세요") ||
    normalized.includes("나를따라") ||
    normalized.includes("저를따라") ||
    normalized.includes("날따라")
  ) {
    return { type: "follow_player" }
  }

  const destination = DESTINATION_KEYWORDS.find(({ keywords }) => includesAny(normalized, keywords))
  return destination ? { type: "move_to_tile", destinationKind: destination.kind } : undefined
}

export function withAcceptedRequestAction<T extends { decision: "ok" | "not_ok"; action?: NPCAction }>(
  userRequest: string,
  result: T
): T {
  if (result.decision !== "ok") return { ...result, action: undefined }
  return { ...result, action: actionFromAcceptedRequest(userRequest, result.action) }
}

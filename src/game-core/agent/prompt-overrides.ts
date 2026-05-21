// 웹 인터페이스에서 수정한 프롬프트 오버라이드.
// 원본 .txt 파일은 절대 건드리지 않는다. 요청 시 이 값이 있으면 파일 대신 사용한다.
// worldKnowledge는 파일이 없는 신규 항목 — interact 시스템 프롬프트에 컨텍스트로 주입된다.
export type PromptOverrides = {
  interact?: string
  validate?: string
  personality?: string
  failure?: string
  decision?: string
  worldKnowledge?: string
}

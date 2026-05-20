import { actionFromAcceptedRequest } from "@/game-core/agent/request-action"

describe("actionFromAcceptedRequest", () => {
  it("turns explicit follow requests into follow_player actions after approval", () => {
    expect(actionFromAcceptedRequest("나를 따라와요", undefined)).toEqual({
      type: "follow_player",
    })
    expect(actionFromAcceptedRequest("저 좀 따라와 주세요", undefined)).toEqual({
      type: "follow_player",
    })
  })

  it("turns tile destination requests into move_to_tile actions after approval", () => {
    expect(actionFromAcceptedRequest("모래로 가주세요", undefined)).toEqual({
      type: "move_to_tile",
      destinationKind: "sand",
    })
    expect(actionFromAcceptedRequest("물가로 가줘", undefined)).toEqual({
      type: "move_to_tile",
      destinationKind: "waterfront",
    })
  })

  it("preserves model-provided actions over inferred actions", () => {
    expect(
      actionFromAcceptedRequest("나를 따라와요", {
        type: "give_item",
        itemId: "apple",
        quantity: 1,
      })
    ).toEqual({ type: "give_item", itemId: "apple", quantity: 1 })
  })
})

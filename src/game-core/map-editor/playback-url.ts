export function buildWorldPlaybackUrl(input: {
  embed?: boolean
  draftMap?: boolean
  mapId?: string
}): string {
  const params = new URLSearchParams()
  if (input.embed) params.set("embed", "1")
  if (input.draftMap) params.set("draftMap", "1")
  if (input.mapId) params.set("mapId", input.mapId)

  const query = params.toString()
  return query ? `/dev/world?${query}` : "/dev/world"
}

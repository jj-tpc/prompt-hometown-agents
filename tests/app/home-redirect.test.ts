import { readFileSync } from "fs"
import { join } from "path"

const pageSource = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8")

it("redirects the home route to the studio page", () => {
  expect(pageSource).toContain('import { redirect } from "next/navigation"')
  expect(pageSource).toContain('redirect("/studio")')
})

import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dest = join(root, "public", "tinymce")
const core = join(root, "node_modules", "tinymce")
const premium = join(root, "node_modules", "tinymce-premium", "plugins")

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })

for (const name of ["tinymce.min.js", "icons", "models", "plugins", "skins", "themes"]) {
  cpSync(join(core, name), join(dest, name), { recursive: true })
}

for (const name of readdirSync(premium)) {
  cpSync(join(premium, name), join(dest, "plugins", name), { recursive: true })
}

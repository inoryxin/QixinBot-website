#!/usr/bin/env node
/**
 * 插件发布程序：往 Gitea 插件仓库提交 .anzu 包，或整个插件目录（源码 + 说明 + 包）。
 *
 * 用法：
 *   node tools/upload-plugin.mjs <file.anzu> [选项]          只传 .anzu 包
 *   node tools/upload-plugin.mjs <plugin-dir> [选项]         传整个插件目录（推荐）
 *       目录须含 manifest.toml；目录里所有文件提交到 src/<id>/，
 *       README.md 一起上去；--anzu 指定包（或自动找目录旁的 <id>.anzu）
 *
 * 选项：
 *   --yes            真正提交（默认 dry-run 预览）
 *   --anzu <file>    目录模式下同时提交的 .anzu 包
 *   --token <tok>    Gitea token；否则读环境变量 GITEA_TOKEN；
 *                    否则读 ~/.gitea_nas_token.txt（支持裸 token 或凭据 URL）
 *   --repo <name>    目标仓库（默认 QixinBot-go-plugins）
 *   --owner <name>   仓库属主（默认 inoryxin）
 *   --branch <name>  目标分支（默认 main）
 *   --gitea <url>    Gitea 地址（默认 http://10.0.0.140:30008）
 *
 * 提交成功后 mirror 自动同步 GitHub；商店展示记得更新 docs/plugins/registry.json。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, basename, resolve } from 'node:path'
import { homedir } from 'node:os'
import { readZipEntry, parseManifest } from './lib-anzu.mjs'
import process from 'node:process'

// ---------- 参数 ----------
const args = process.argv.slice(2)
function opt(name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const target = args.find((a) => !a.startsWith('--'))
const yes = args.includes('--yes')
const anzuOpt = opt('--anzu')
const owner = opt('--owner') ?? 'inoryxin'
const repo = opt('--repo') ?? 'QixinBot-go-plugins'
const branch = opt('--branch') ?? 'main'
const gitea = (opt('--gitea') ?? 'http://10.0.0.140:30008').replace(/\/$/, '')

let token = opt('--token') ?? process.env.GITEA_TOKEN
if (!token) {
  const tokenFile = `${homedir()}/.gitea_nas_token.txt`
  if (existsSync(tokenFile)) {
    const rawTok = readFileSync(tokenFile, 'utf8').trim()
    const m = rawTok.match(/^https?:\/\/[^:/@]+:([^@]+)@/)
    token = m ? m[1] : rawTok
  }
}
if (!token) {
  console.error('✗ 找不到 Gitea token：--token / 环境变量 GITEA_TOKEN / ~/.gitea_nas_token.txt')
  process.exit(1)
}
if (!target || !existsSync(target)) {
  console.error('✗ 用法：node tools/upload-plugin.mjs <file.anzu | plugin-dir> [--yes] [--anzu file]')
  process.exit(1)
}

// ---------- 收集待提交文件：path → Buffer ----------
const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__', '.DS_Store'])
const files = [] // { path, buf }
let id, ver, name, manifestText

function collectDir(dir, destPrefix) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectDir(full, `${destPrefix}/${entry}`)
      continue
    }
    if (statSync(full).size > 2 * 1024 * 1024) {
      console.warn(`  ⚠ 跳过超过 2MB 的文件：${entry}（大文件请走 LFS 或 release）`)
      continue
    }
    files.push({ path: `${destPrefix}/${entry}`, buf: readFileSync(full) })
  }
}

if (statSync(target).isDirectory()) {
  const mPath = join(target, 'manifest.toml')
  if (!existsSync(mPath)) {
    console.error('✗ 目录里没有 manifest.toml（应在插件根目录）')
    process.exit(1)
  }
  manifestText = readFileSync(mPath, 'utf8')
  ;({ id, version: ver, name } = parseManifest(manifestText))
  // 仓库目录名 = 上传者放的位置；与 manifest id 不一致时明确告警
  const dirName = basename(resolve(target))
  if (id && id !== dirName) {
    console.warn(`  ⚠ manifest id（${id}）与目录名（${dirName}）不一致：源码将提交到 src/${dirName}/，包名仍按 id 为 ${id}.anzu`)
  }
  collectDir(target, `src/${dirName}`)
  // 附带 .anzu：--anzu 指定 > 目录旁/上层/dist 的 <id>.anzu
  const anzuFile = anzuOpt ?? [join(target, `${id}.anzu`), join(dirname(target), `${id}.anzu`), join(target, 'dist', `${id}.anzu`)]
    .find((p) => existsSync(p))
  if (anzuFile) {
    files.push({ path: `packages/${id}.anzu`, buf: readFileSync(anzuFile) })
    console.log(`• 附带包：${basename(anzuFile)}`)
  } else {
    console.log('• 未找到 .anzu 包（只提交源码与说明）。可用 --anzu 指定')
  }
} else {
  const raw = readFileSync(target)
  try {
    manifestText = readZipEntry(raw, 'manifest.toml')?.toString('utf8') ?? ''
  } catch (e) {
    console.error('✗', e.message)
    process.exit(1)
  }
  if (!manifestText) {
    console.error('✗ 包里没有 manifest.toml——确认这是 qixinpack pack 出来的 .anzu')
    process.exit(1)
  }
  ;({ id, version: ver, name } = parseManifest(manifestText))
  files.push({ path: `packages/${id}.anzu`, buf: raw })
}
if (!id) {
  console.error('✗ manifest.toml 里没有 id 字段')
  process.exit(1)
}
ver = ver ?? '?'

const kind = manifestText.includes('kind = "theme"') ? '主题' : '插件'
const message = `发布${kind} ${name}(${id}) v${ver}（发布程序：${files.length} 个文件）`
console.log(`\n${kind}：${name}（${id}）v${ver}  →  ${owner}/${repo}@${branch}`)
console.log(`提交说明：${message}\n`)

// ---------- 查已存在文件（update 需要 sha） ----------
const apiBase = `${gitea}/api/v1/repos/${owner}/${repo}/contents`
const headers = { Authorization: `token ${token}`, 'Content-Type': 'application/json' }
let changed = 0, created = 0
for (const f of files) {
  const r = await fetch(`${apiBase}/${f.path}?ref=${branch}`, { headers })
  if (r.status === 200) { f.sha = (await r.json()).sha; changed++ }
  else if (r.status !== 404) {
    console.error(`✗ 查询 ${f.path} 失败：HTTP ${r.status}`, (await r.text()).slice(0, 200))
    process.exit(1)
  } else created++
}
for (const f of files) {
  const kb = (f.buf.length / 1024).toFixed(1)
  console.log(`  ${f.sha ? '改' : '新'} ${f.path}  (${kb} KB)`)
}
console.log(`共 ${files.length} 个文件（新增 ${created}，覆盖 ${changed}）\n`)

if (!yes) {
  console.log('[dry-run] 未提交。确认无误后加 --yes 真正发布。')
  process.exit(0)
}

// ---------- 提交：优先 changefiles 单提交，失败回退逐文件 ----------
async function commitSingle() {
  const res = await fetch(`${apiBase}/changefiles`, {
    method: 'POST', headers,
    body: JSON.stringify({
      branch,
      message,
      files: files.map((f) => ({
        operation: f.sha ? 'update' : 'create',
        path: f.path,
        content_base64: f.buf.toString('base64'),
        ...(f.sha ? { sha: f.sha } : {}),
      })),
    }),
  })
  if (!res.ok) throw new Error(`changefiles HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

async function commitPerFile() {
  for (const f of files) {
    const body = { branch, content: f.buf.toString('base64'), message }
    if (f.sha) body.sha = f.sha
    const res = await fetch(`${apiBase}/${f.path}`, { method: 'PUT', headers, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`PUT ${f.path} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
}

try {
  await commitSingle()
  console.log(`✓ 单提交完成：${gitea}/${owner}/${repo}/commit/... （${files.length} 个文件一次入库）`)
} catch (e) {
  console.warn(`  changefiles 不可用（${e.message.slice(0, 80)}），回退逐文件提交…`)
  await commitPerFile()
  console.log(`✓ 已逐文件提交 ${files.length} 个`)
}

console.log(`\n✓ 发布完成！预览：${gitea}/${owner}/${repo}/src/branch/${branch}/src/${id}/README.md`)
console.log('  GitHub 1 分钟内自动同步；商店展示记得更新 docs/plugins/registry.json。')

#!/usr/bin/env node
/**
 * 插件上传程序：把 .anzu 包提交到 Gitea 插件仓库的 packages/ 目录。
 *
 * 用法：
 *   node tools/upload-plugin.mjs <file.anzu> [选项]
 *
 * 选项：
 *   --yes            真正提交（默认只做 dry-run 预览）
 *   --token <tok>    Gitea token；否则读环境变量 GITEA_TOKEN；
 *                    否则读 ~/.gitea_nas_token.txt
 *   --repo <name>    目标仓库（默认 QixinBot-go-plugins）
 *   --owner <name>   仓库属主（默认 inoryxin）
 *   --branch <name>  目标分支（默认 main）
 *   --gitea <url>    Gitea 地址（默认 http://10.0.0.140:30008）
 *
 * 流程：解析 .anzu 内的 manifest.toml 拿 id/版本 → 查目标路径是否已存在
 *       （存在则带上 sha 覆盖更新）→ PUT contents API 提交。
 * 上传成功后别忘了往 docs/plugins/registry.json 加条目，商店才会展示。
 */
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { inflateRawSync } from 'node:zlib'
import process from 'node:process'

// ---------- 参数 ----------
const args = process.argv.slice(2)
function opt(name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const file = args.find((a) => !a.startsWith('--'))
const yes = args.includes('--yes')
const owner = opt('--owner') ?? 'inoryxin'
const repo = opt('--repo') ?? 'QixinBot-go-plugins'
const branch = opt('--branch') ?? 'main'
const gitea = (opt('--gitea') ?? 'http://10.0.0.140:30008').replace(/\/$/, '')

let token = opt('--token') ?? process.env.GITEA_TOKEN
if (!token) {
  const tokenFile = `${homedir()}/.gitea_nas_token.txt`
  if (existsSync(tokenFile)) {
    // 兼容两种内容：裸 token，或 git 凭据 URL（http://user:token@host）
    const rawTok = readFileSync(tokenFile, 'utf8').trim()
    const m = rawTok.match(/^https?:\/\/[^:/@]+:([^@]+)@/)
    token = m ? m[1] : rawTok
  }
}
if (!token) {
  console.error('✗ 找不到 Gitea token：--token / 环境变量 GITEA_TOKEN / ~/.gitea_nas_token.txt')
  process.exit(1)
}

if (!file || !existsSync(file)) {
  console.error('✗ 用法：node tools/upload-plugin.mjs <file.anzu> [--yes]')
  process.exit(1)
}

// ---------- zip 解析（零依赖，只取 manifest.toml） ----------
function readZipEntry(buf, want) {
  // 从尾部找 EOCD
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('不是合法的 zip（找不到 EOCD），确认是 .anzu 包')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('zip 中央目录损坏')
    const method = buf.readUInt16LE(off + 10)
    const csize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const lho = buf.readUInt32LE(off + 42)
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8')
    if (name === want) {
      const lnLen = buf.readUInt16LE(lho + 26)
      const leLen = buf.readUInt16LE(lho + 28)
      const dataStart = lho + 30 + lnLen + leLen
      const data = buf.slice(dataStart, dataStart + csize)
      return method === 8 ? inflateRawSync(data) : data
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return null
}

const raw = readFileSync(file)
let manifest
try {
  manifest = readZipEntry(raw, 'manifest.toml')?.toString('utf8') ?? ''
} catch (e) {
  console.error('✗', e.message)
  process.exit(1)
}
if (!manifest) {
  console.error('✗ 包里没有 manifest.toml——确认这是 qixinpack pack 出来的 .anzu')
  process.exit(1)
}
const pick = (k) => manifest.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\n]+)"?`, 'm'))?.[1]?.trim()
const pid = pick('id')
const pver = pick('version') ?? '?'
const pname = pick('name') ?? pid
if (!pid) {
  console.error('✗ manifest.toml 里没有 id 字段')
  process.exit(1)
}

const destPath = `packages/${pid}.anzu`
const api = `${gitea}/api/v1/repos/${owner}/${repo}/contents/${destPath}`
const headers = { Authorization: `token ${token}`, 'Content-Type': 'application/json' }

// ---------- 查已存在（拿 sha 用于覆盖） ----------
let sha
const getRes = await fetch(api + `?ref=${branch}`, { headers })
if (getRes.status === 200) {
  sha = (await getRes.json()).sha
  console.log(`• ${destPath} 已存在（将覆盖更新）`)
} else if (getRes.status !== 404) {
  console.error(`✗ 查询失败：HTTP ${getRes.status}`, await getRes.text())
  process.exit(1)
}

const body = {
  branch,
  content: raw.toString('base64'),
  message: sha
    ? `上传插件 ${pname}(${pid}) v${pver}（上传程序覆盖更新）`
    : `上传插件 ${pname}(${pid}) v${pver}（上传程序）`,
}
if (sha) body.sha = sha

const sizeMB = (raw.length / 1024 / 1024).toFixed(1)
console.log(`包：${pname}（${pid}）v${pver}，${sizeMB} MB`)
console.log(`目标：${owner}/${repo}@${branch} → ${destPath}${sha ? '（覆盖）' : '（新增）'}`)

if (!yes) {
  console.log('\n[dry-run] 未提交。确认无误后加 --yes 真正上传。')
  process.exit(0)
}

const putRes = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(body) })
const resp = await putRes.json().catch(() => ({}))
if (!putRes.ok) {
  console.error(`✗ 上传失败：HTTP ${putRes.status}`, JSON.stringify(resp).slice(0, 300))
  process.exit(1)
}
console.log(`✓ 已提交：${resp.commit?.html_url ?? gitea + '/' + owner + '/' + repo}`)
console.log(`  Gitea 原始链接：${gitea}/${owner}/${repo}/raw/branch/${branch}/${destPath}`)
console.log(`  GitHub 链接：https://github.com/${owner}/${repo}/raw/${branch}/${destPath}`)
console.log(`\n下一步：往 docs/plugins/registry.json 加/更新条目（version=${pver}），商店才会刷新。`)

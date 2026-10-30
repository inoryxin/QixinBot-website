#!/usr/bin/env node
/**
 * 插件审查助手：拉取收录申请 Issue → 下载 .anzu → 解析 manifest →
 * 交叉核对 → 安全扫描（外联地址 / 可疑行为）→ 生成可直接粘贴的 registry.json 条目。
 *
 * 用法：
 *   node tools/review-plugin.mjs <issue编号或URL> [--write]
 *   --write  把生成的条目追加进 docs/plugins/registry.json（默认只打印）
 *
 * 示例：
 *   node tools/review-plugin.mjs https://github.com/inoryxin/QixinBot-go-plugins/issues/12
 *   node tools/review-plugin.mjs 12 --write
 *
 * GitHub API 走 curl（本机需可访问 github.com；自动使用 HTTPS_PROXY/7890）。
 */
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { listZipEntries, parseManifest } from './lib-anzu.mjs'
import process from 'node:process'

const ISSUE_RE = /(?:issues\/|#)?(\d+)\s*$/
const arg = process.argv[2] ?? ''
const doWrite = process.argv.includes('--write')
const isLocalJson = arg.endsWith('.json') && existsSync(arg)
const num = (arg.match(ISSUE_RE) ?? [])[1]
if (!num && !isLocalJson) {
  console.error('✗ 用法：node tools/review-plugin.mjs <issue编号或URL> [--write]')
  process.exit(1)
}

const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || 'http://127.0.0.1:7890'
const GH_API = 'https://api.github.com/repos/inoryxin/QixinBot-go-plugins/issues'
function curlJson(url) {
  const out = execSync(
    `curl -sL -m 60 -x ${PROXY} -H "Accept: application/vnd.github+json" "${url}"`,
    { maxBuffer: 64 * 1024 * 1024 },
  )
  return JSON.parse(out.toString('utf8'))
}
function curlDownload(url, dest) {
  execSync(`curl -sL -m 300 -x ${PROXY} -o "${dest}" "${url}"`, { maxBuffer: 256 * 1024 * 1024 })
}

// ---------- 拉 issue（参数也可以是本地 issue JSON，便于离线测试） ----------
let issue
if (arg.endsWith('.json') && existsSync(arg)) {
  console.log('（使用本地 issue JSON）')
  issue = JSON.parse(readFileSync(arg, 'utf8'))
} else {
  console.log(`拉取 issue #${num}…`)
  issue = curlJson(`${GH_API}/${num}`)
}
console.log(`标题：${issue.title}\n提交者：${issue.user?.login}  时间：${issue.created_at}\n`)

// GitHub issue form 的正文格式：### 字段\n\n值\n\n（标题行后只吃一个换行，
// 值用懒惰匹配在下一个 ### 前停——否则空字段会把下一题吞进值里）
const fields = {}
let m
const re = /### ([^\n]+)\n([\s\S]*?)(?=\n+### |\n*$)/g
while ((m = re.exec(issue.body ?? ''))) fields[m[1].trim()] = m[2].trim()
const F = {
  name: fields['插件中文名'] ?? '',
  id: fields['插件 ID'] ?? '',
  summary: (fields['一句话简介'] ?? '').replace(/\r/g, ''),
  details: fields['详细说明'] ?? '',
  language: fields['语言'] ?? '',
  deps: (fields['运行依赖'] ?? '').split(/[、,，\s]+/).filter(Boolean),
  repo: fields['源码仓库地址'] ?? '',
  download: fields['.anzu 下载直链'] ?? '',
  pubkey: fields['签名公钥或指纹'] ?? '',
  category: fields['分类'] ?? '其他',
  contact: fields['联系方式'] ?? '',
}
console.log('申请内容：')
console.log(`  中文名=${F.name}  ID=${F.id}  分类=${F.category}`)
console.log(`  语言=${F.language}  依赖=${F.deps.join('、') || '无'}`)
console.log(`  源码=${F.repo}\n  下载=${F.download}`)
console.log(`  公钥/指纹=${F.pubkey ? F.pubkey.split('\n')[0].slice(0, 60) + '…' : '（未填！）'}\n`)

// ---------- 下载并解析 .anzu ----------
if (!F.download) { console.error('✗ issue 没有下载直链，无法继续'); process.exit(1) }
const tmp = mkdtempSync(join(tmpdir(), 'review-'))
const pkgPath = join(tmp, 'pkg.anzu')
console.log('下载 .anzu…')
try { curlDownload(F.download, pkgPath) } catch { console.error('✗ 下载失败'); process.exit(1) }
const raw = readFileSync(pkgPath)

let entries
try { entries = listZipEntries(raw) } catch (e) { console.error('✗', e.message); process.exit(1) }
const mEntry = entries.find((e) => e.name === 'manifest.toml')
if (!mEntry) { console.error('✗ 包里没有 manifest.toml'); process.exit(1) }
const man = parseManifest(mEntry.data.toString('utf8'))

console.log('\n包内 manifest 核对：')
const issues = []
if (man.id !== F.id) issues.push(`ID 不一致：issue 填 ${F.id}，包内是 ${man.id}`)
if (man.name && F.name && man.name !== F.name) console.log(`  ℹ 中文名：issue=${F.name}，包内=${man.name}`)
console.log(`  id=${man.id}  name=${man.name}  version=${man.version}  kind=${man.kind ?? 'plugin'}`)
console.log(`  permissions=${(man.permissions ?? '无')}`)

// ---------- 安全扫描 ----------
console.log('\n安全扫描（人工复核提示，不是结论）：')
const TEXT_RE = /\.(js|mjs|cjs|py|json|toml|css|html|md|sh)$/i
const urls = new Set()
const flags = []
const SUSPICIOUS = [
  [/eval\s*\(/, 'eval()'],
  [/new\s+Function/, 'new Function'],
  [/child_process|execSync|spawnSync|exec\(/, '子进程调用'],
  [/\.env\b|cookie|password|passwd|credential/i, '凭据关键词'],
  [/writeFileSync|rmSync|unlink/i, '文件写入/删除'],
  [/registry|startup|schtasks|crontab/i, '持久化线索'],
]
for (const e of entries) {
  if (!TEXT_RE.test(e.name) || e.data.length > 2 * 1024 * 1024) continue
  const text = e.data.toString('utf8')
  for (const u of text.matchAll(/https?:\/\/[\w.-]+(?:\/[\w./?%&=-]*)?/g)) urls.add(u[0])
  for (const [re2, label] of SUSPICIOUS) {
    if (re2.test(text)) flags.push(`${label} ← ${e.name}`)
  }
}
console.log(`  包内文件 ${entries.length} 个；外联地址 ${urls.size} 个：`)
for (const u of [...urls].sort().slice(0, 20)) console.log(`    ${u}`)
if (urls.size === 0) console.log('    （无）')
console.log(flags.length ? `  ⚠ 需人工确认的模式：` : '  ✓ 未发现显著可疑模式')
for (const f of [...new Set(flags)]) console.log(`    ${f}`)

// ---------- 生成 registry 条目 ----------
const CAT = { 'AI 助手': 'ai', 娱乐互动: 'fun', 订阅推送: 'feed', 群聊管理: 'group', 工具查询: 'tool', 设备管家: 'device' }
const entry = {
  id: man.id ?? F.id,
  name: F.name || man.name,
  tier: 'third-party',
  kind: man.kind === 'theme' ? 'theme' : 'plugin',
  category: CAT[F.category] ?? 'tool',
  description: F.summary || man.description || '',
  language: F.language || 'Node.js',
  deps: F.deps,
  permissions: String(man.permissions ?? '')
    .split(/[[\]",\s]+/)
    .filter((s) => s.startsWith('onebot.')),
  observe: /observe\s*=\s*true/.test(mEntry.data.toString('utf8')),
  version: man.version ?? '?',
  author: issue.user?.login ?? '未知',
  repo: F.repo,
  package: F.download,
  fingerprint: F.pubkey.split('\n')[0] ?? null,
  tags: [],
}
const entryJson = JSON.stringify(entry, null, 2)

console.log('\n—— 审核通过后，把下面条目加进 docs/plugins/registry.json ——')
console.log(entryJson)
console.log('—— 审核结论建议 ——')
if (issues.length) console.log('✗ ' + issues.join('；'))
console.log('人工清单：①源码通读与行为一致 ②跑 qixinpack verify/dev 实测 ③上面 ⚠ 项逐条确认 ④指纹与安装时框架展示一致')

if (doWrite) {
  if (issues.length) {
    console.error('\n✗ 有未解决问题，拒绝写入。先修正 issue 或改 --write 前的手动核对。')
    process.exit(1)
  }
  const regPath = resolve(process.cwd(), 'docs/plugins/registry.json')
  if (!existsSync(regPath)) { console.error('✗ 找不到 ' + regPath + '（在 website 仓库根目录运行）'); process.exit(1) }
  const list = JSON.parse(readFileSync(regPath, 'utf8'))
  if (list.some((e) => e.id === entry.id)) {
    console.error(`✗ registry 里已有 id=${entry.id}，如需更新请手工改条目`)
    process.exit(1)
  }
  list.push(entry)
  writeFileSync(regPath, JSON.stringify(list, null, 2) + '\n')
  console.log(`\n✓ 已追加到 ${regPath}（${list.length} 条）。请检查 diff 后提交推送。`)
}

rmSync(tmp, { recursive: true, force: true })

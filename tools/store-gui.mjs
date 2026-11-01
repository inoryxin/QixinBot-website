#!/usr/bin/env node
/**
 * QixinBot 插件商店管理台（本地 GUI）
 *
 *   node tools/store-gui.mjs            # 打开 http://localhost:7802
 *
 * 功能：审核队列（自动验证分级 + 包内源码查看 + 一键通过/拒绝）、商店条目
 * （改 tag/分类/上下架）、对比同步（Gitea ↔ GitHub 差异、按插件同步、一键上架）、
 * 上传发布（目录/包）、设置（Gitea/GitHub token、代理、部署密钥）。
 *
 * 配置存 tools/gui-config.json（已 gitignore）。
 */
import http from 'node:http'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execSync, exec as cpExec, spawn as cpSpawn } from 'node:child_process'
import { promisify } from 'node:util'
import { listZipEntries, parseManifest } from './lib-anzu.mjs'

// ---------- 运行环境：源码模式 / SEA 单文件 exe 模式 ----------
function isSeaRuntime() {
  try { return typeof require === 'function' && require('node:sea').isSea() } catch { return false }
}
const SEA = isSeaRuntime()
const EXE_DIR = SEA ? dirname(process.execPath) : null

const CFG_DEFAULT = {
  giteaUrl: 'http://10.0.0.140:30008',
  giteaToken: '',
  githubToken: '',
  proxy: 'http://127.0.0.1:7890',
  giteaOwner: 'inoryxin',
  githubOwner: 'inoryxin',
  pluginsRepo: 'QixinBot-go-plugins',
  deployKeyPath: '',
  autoDeploy: true,
  nasYamlPath: 'C:/Users/anzu/Documents/xin/nas.yaml',
  // exe 模式下必填：官网（website 仓库）本地路径，registry/分类/部署都在里面
  repoPath: 'C:/Users/anzu/Documents/xin/zcode/QixinBot-website',
  bashPath: '',
}
let CFG = { ...CFG_DEFAULT }
let ROOT, CONFIG_PATH
if (SEA) {
  CONFIG_PATH = join(EXE_DIR, 'gui-config.json')
  if (existsSync(CONFIG_PATH)) CFG = { ...CFG_DEFAULT, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) }
  else saveCfg()
  ROOT = CFG.repoPath || CFG_DEFAULT.repoPath
} else {
  ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  CONFIG_PATH = join(ROOT, 'tools', 'gui-config.json')
  if (existsSync(CONFIG_PATH)) CFG = { ...CFG_DEFAULT, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) }
}
const saveCfg = () => writeFileSync(CONFIG_PATH, JSON.stringify(CFG, null, 2))
const REG_PATH = () => join(ROOT, 'docs', 'plugins', 'registry.json')
const CATS_PATH = () => join(ROOT, 'docs', 'plugins', 'categories.json')
const PORT = 7802

function seaAsset(name) {
  if (SEA) {
    const buf = require('node:sea').getAsset(name)
    return Buffer.from(buf)
  }
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), name))
}

// ---------- 平台调用 ----------
async function gitea(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${CFG.giteaUrl}/api/v1${path}`, {
    method,
    headers: { Authorization: `token ${CFG.giteaToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}
function gh(path, { method = 'GET', body } = {}) {
  const auth = CFG.githubToken ? `-H "Authorization: Bearer ${CFG.githubToken}"` : ''
  const data = body ? `-d @-` : ''
  const out = execSync(
    `curl -sL -m 120 -x ${CFG.proxy} ${auth} -H "Accept: application/vnd.github+json" -X ${method} ${data} "${`https://api.github.com${path}`}"`,
    { maxBuffer: 256 * 1024 * 1024, input: body ? JSON.stringify(body) : undefined },
  )
  try { return { status: 200, json: JSON.parse(out.toString('utf8')) } } catch { return { status: 0, json: null } }
}
function ghStatus(res) { return res.json ? 200 : 404 }
function dl(url, useProxy) {
  const p = useProxy ? `-x ${CFG.proxy}` : ''
  return execSync(`curl -sL -m 300 ${p} "${url}"`, { maxBuffer: 256 * 1024 * 1024 })
}

// ---------- git（website 仓库：registry 变更提交推送） ----------
// registry 的唯一事实来源 = 插件仓库（github.com/inoryxin/QixinBot-go-plugins）。
// 保存流程：写本地（LAN 构建输入）→ 插件仓库提交推送 → 触发官网 Netlify 重建 → LAN 重建。
// 推送凭据走本机 git 凭据库（第一次推送会弹浏览器登录一次，之后免密）。
function gitRegistryCommit(msg) {
  const pr = CFG.pluginsRepoPath
  if (!pr || !existsSync(pr)) throw new Error('插件仓库路径不存在（设置页 pluginsRepoPath）')
  const g = (cmd) => execSync(cmd, { cwd: pr, stdio: 'pipe' })
  g('git pull origin main')
  writeFileSync(join(pr, 'registry.json'), readFileSync(REG_PATH()))
  g('git add registry.json')
  try { g(`git diff --cached --quiet || git commit -m ${JSON.stringify(msg)}`) } catch {}
  g('git push origin main')
  if (CFG.netlifyHookUrl) {
    try { execSync(`curl -s -m 30 -X POST "${CFG.netlifyHookUrl}"`, { stdio: 'ignore' }) } catch {}
  }
  scheduleDeploy()
}

// ---------- 包解析 / 扫描 ----------
function scanPackage(raw) {
  const entries = listZipEntries(raw)
  const mEntry = entries.find((e) => e.name === 'manifest.toml')
  const man = mEntry ? parseManifest(mEntry.data.toString('utf8')) : {}
  const mRaw = mEntry ? mEntry.data.toString('utf8') : ''
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
    for (const [re2, label] of SUSPICIOUS) if (re2.test(text)) flags.push(`${label} ← ${e.name}`)
  }
  return { entries, man, mRaw, urls: [...urls].sort(), flags: [...new Set(flags)] }
}
function issueFields(body) {
  const fields = {}
  const re = /### ([^\n]+)\n([\s\S]*?)(?=\n+### |\n*$)/g
  let m
  while ((m = re.exec(body ?? ''))) fields[m[1].trim()] = m[2].trim()
  return fields
}
function readCats() { return JSON.parse(readFileSync(CATS_PATH(), 'utf8')) }
const catMap = () => Object.fromEntries(Object.entries(readCats()).map(([k, v]) => [v, k]))

function buildEntry(f, man, issue, mRaw) {
  return {
    id: man.id ?? f['插件 ID'] ?? '',
    name: f['插件中文名'] || man.name || '',
    tier: 'third-party',
    kind: man.kind === 'theme' ? 'theme' : 'plugin',
    category: catMap()[f['分类']] ?? 'tool',
    description: f['一句话简介'] || man.description || '',
    language: f['语言'] || 'Node.js',
    deps: (f['运行依赖'] ?? '').split(/[、,，\s]+/).filter(Boolean),
    permissions: String(man.permissions ?? '').split(/[[\]",\s]+/).filter((s) => s.startsWith('onebot.')),
    observe: /observe\s*=\s*true/.test(mRaw),
    version: man.version ?? '?',
    author: issue.user?.login ?? '未知',
    repo: f['源码仓库地址'] ?? '',
    package: f['.anzu 下载直链'] ?? '',
    fingerprint: (f['签名公钥或指纹'] ?? '').split('\n')[0] || null,
    tags: [],
  }
}

// 审核缓存：platform:num → { entries, fields, man, report }
const reviewCache = new Map()

async function doReview(platform, num) {
  let issue, download
  if (platform === 'gitea') {
    const r = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/issues/${num}`)
    if (r.status !== 200) throw new Error(`issue 拉取失败 ${r.status}`)
    issue = r.json
    const mm = (issue.body ?? '').match(/### \.anzu 下载直链\n+([^\n]+)/)
    download = mm?.[1]?.trim()
  } else {
    const r = gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/issues/${num}`)
    issue = r.json
    if (!issue?.title) throw new Error('issue 拉取失败（GitHub）')
    const mm = (issue.body ?? '').match(/### \.anzu 下载直链\n+([^\n]+)/)
    download = mm?.[1]?.trim()
  }
  const fields = issueFields(issue.body)
  if (!download) throw new Error('issue 里没有 .anzu 下载直链')
  const raw = download.includes('github.com') || download.includes('githubusercontent')
    ? dl(download, true)
    : dl(download, false)
  const scan = scanPackage(raw)
  const report = {
    platform, num,
    title: issue.title, author: issue.user?.login, created: issue.created_at,
    fields, man: scan.man, urls: scan.urls, flags: scan.flags,
    files: scan.entries.map((e) => ({ name: e.name, size: e.data.length })),
  }
  // 自动验证分级
  const checks = []
  checks.push({ ok: (fields['插件 ID'] ?? '') === scan.man.id, label: `插件 ID 一致（issue=${fields['插件 ID'] ?? '—'} / 包=${scan.man.id ?? '—'}）` })
  checks.push({ ok: !!fields['签名公钥或指纹'], label: '已提交签名公钥/指纹' })
  checks.push({ ok: !!fields['源码仓库地址'], label: '已填源码仓库' })
  checks.push({ ok: catMap()[fields['分类']] != null, label: `分类有效（${fields['分类'] ?? '—'}）` })
  checks.push({ ok: scan.flags.length === 0, label: scan.flags.length ? `可疑模式 ${scan.flags.length} 项待人工确认` : '安全扫描无可疑模式' })
  const concerns = checks.filter((c) => !c.ok)
  report.checks = checks
  report.verdict = concerns.length === 0 ? 'ok' : 'concerns'
  report.entry = buildEntry(fields, scan.man, issue, scan.mRaw)
  reviewCache.set(`${platform}:${num}`, { ...report, raw })
  return report
}

// ---------- registry ----------
function readReg() { return JSON.parse(readFileSync(REG_PATH(), 'utf8')) }
function writeReg(list) { writeFileSync(REG_PATH(), JSON.stringify(list, null, 2) + '\n') }

// ---------- 上传（目录 / 包） ----------
const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', '__pycache__', '.DS_Store'])
function collectDir(dir, destPrefix, out) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectDir(full, `${destPrefix}/${entry}`, out)
    else if (statSync(full).size <= 2 * 1024 * 1024) out.push({ path: `${destPrefix}/${entry}`, buf: readFileSync(full) })
  }
}
async function uploadPublish({ target, anzu, yes }) {
  if (!target || !existsSync(target)) throw new Error('路径不存在')
  const files = []
  let id, ver, name, manifestText
  if (statSync(target).isDirectory()) {
    const mPath = join(target, 'manifest.toml')
    if (!existsSync(mPath)) throw new Error('目录里没有 manifest.toml')
    manifestText = readFileSync(mPath, 'utf8')
    ;({ id, version: ver, name } = parseManifest(manifestText))
    collectDir(target, `src/${basename(resolve(target))}`, files)
    const anzuFile = anzu ?? [join(target, `${id}.anzu`), join(dirname(target), `${id}.anzu`)].find((p) => existsSync(p))
    if (anzuFile) files.push({ path: `packages/${id}.anzu`, buf: readFileSync(anzuFile) })
  } else {
    const raw = readFileSync(target)
    manifestText = listZipEntries(raw).find((e) => e.name === 'manifest.toml')?.data.toString('utf8') ?? ''
    if (!manifestText) throw new Error('包里没有 manifest.toml')
    ;({ id, version: ver, name } = parseManifest(manifestText))
    files.push({ path: `packages/${id}.anzu`, buf: raw })
  }
  if (!id) throw new Error('manifest 缺 id')
  const kind = manifestText.includes('kind = "theme"') ? '主题' : '插件'
  const message = `发布${kind} ${name}(${id}) v${ver ?? '?'}（管理台上传）`
  const plan = []
  for (const f of files) {
    const r = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/${f.path}?ref=main`)
    if (r.status === 200) f.sha = r.json.sha
    plan.push({ path: f.path, size: f.buf.length, update: !!f.sha })
  }
  if (!yes) return { dryRun: true, files: plan, message }
  try {
    const res = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/changefiles`, {
      method: 'POST',
      body: { branch: 'main', message, files: files.map((f) => ({ operation: f.sha ? 'update' : 'create', path: f.path, content_base64: f.buf.toString('base64'), ...(f.sha ? { sha: f.sha } : {}) })) },
    })
    if (res.status >= 300) throw new Error('changefiles ' + res.status)
  } catch {
    for (const f of files) {
      const body = { branch: 'main', content: f.buf.toString('base64'), message }
      if (f.sha) body.sha = f.sha
      const res = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/${f.path}`, { method: 'PUT', body })
      if (res.status >= 300) throw new Error(`PUT ${f.path} ${res.status}`)
    }
  }
  return { dryRun: false, files: plan, message }
}

// ---------- 部署 ----------
const deployState = { busy: false, log: [], ok: null, error: null, finishedAt: null }
const execP = promisify(cpExec)
// 部署密钥：优先用设置里填的路径；否则放到仓库 tools/.deploy_key（稳定位置，不受 Temp 清理影响），
// 不存在就从 nas.yaml 现场提取 + 收紧 ACL。scp 前会再确保一次，丢了你也不知道。
function ensureDeployKey(log) {
  let keyPath = CFG.deployKeyPath
  if (keyPath && existsSync(keyPath)) return keyPath
  keyPath = join(ROOT, 'tools', '.deploy_key')
  if (!existsSync(keyPath)) {
    if (!CFG.nasYamlPath || !existsSync(CFG.nasYamlPath)) throw new Error('nas.yaml 不存在，无法提取部署私钥（设置里填 nasYamlPath 或 deployKeyPath）')
    const m = readFileSync(CFG.nasYamlPath, 'utf8').match(/private_key: \|\n((?: {8}.+\n?)+)/)
    if (!m) throw new Error('nas.yaml 里找不到 private_key 块')
    writeFileSync(keyPath, m[1].split('\n').map((l) => l.slice(8)).join('\n'))
    log?.push('• 已从 nas.yaml 提取部署私钥 → ' + keyPath)
  }
  // 收紧 ACL：Windows 自带 OpenSSH 会因权限过宽拒绝该密钥，转而隐形等密码导致挂死
  try {
    execSync(`icacls "${keyPath}" /inheritance:r /grant:r "${process.env.USERNAME}":F`, { shell: 'cmd.exe', stdio: 'pipe' })
  } catch {}
  return keyPath
}
async function runDeploy() {
  if (deployState.busy) return { started: false, reason: '已有部署在进行中' }
  let keyPath
  deployState.busy = true; deployState.log = []; deployState.ok = null; deployState.error = null
  // 显式定位 Git Bash：PATH 里的 bash.exe 在双击启动的 exe 环境里可能解析到 WSL 的
  // System32\bash.exe（/c/... 盘符映射不同），导致部署在 WSL 里跑、密钥路径"不存在"
  function findBash() {
    if (CFG.bashPath && existsSync(CFG.bashPath)) return CFG.bashPath
    const candidates = [
      'C:/Program Files/Git/bin/bash.exe',
      'C:/Program Files (x86)/Git/bin/bash.exe',
    ]
    try {
      const gitWhere = execSync('where git', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().split('\n')[0].trim()
      if (/\\cmd\\git\.exe$/i.test(gitWhere)) candidates.unshift(join(dirname(dirname(gitWhere)), 'bin', 'bash.exe'))
      if (/\\bin\\git\.exe$/i.test(gitWhere)) candidates.unshift(join(dirname(gitWhere), 'bash.exe'))
    } catch {}
    for (const c of candidates) if (existsSync(c)) return c
    throw new Error('找不到 Git Bash（设置里可填 bashPath 手动指定）——没有它无法构建和部署')
  }
  const bashPath = findBash()
  deployState.log.push('• bash：' + bashPath)
  const run = (cmd) => new Promise((resolve, reject) => {
    deployState.log.push('$ ' + cmd)
    const child = cpSpawn(bashPath, ['-c', 'export PATH="/usr/bin:$PATH"; ' + cmd], { cwd: ROOT })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    const killer = setTimeout(() => child.kill(), 240000)
    child.on('exit', (code) => {
      clearTimeout(killer)
      deployState.log.push(out.slice(0, 1600))
      code === 0 ? resolve() : reject(new Error(`命令失败(code ${code}): ${cmd.slice(0, 80)}\n${out.slice(-500)}`))
    })
  })
  ;(async () => {
    try {
      keyPath = ensureDeployKey(deployState.log)
      deployState.log.push('• 部署密钥：' + keyPath)
      await run('npx vitepress build docs 2>&1 | tail -2')
      await run('tar -C docs/.vitepress/dist -czf /tmp/site.tar.gz .')
      if (!existsSync(keyPath)) keyPath = ensureDeployKey(deployState.log)
      // 强制用 Git Bash 的 ssh/scp：Windows 自带 OpenSSH 对 /tmp 路径和密钥的处理与手动部署不一致，曾导致挂死/找不到文件
      const msysKey = keyPath.replace(/^([A-Za-z]):/, (_, d) => '/' + d.toLowerCase()).replace(/\\/g, '/')
      await run(`/usr/bin/scp -i "${msysKey}" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new /tmp/site.tar.gz root@10.0.0.123:/tmp/site.tar.gz`)
      await run(`/usr/bin/ssh -i "${msysKey}" -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new root@10.0.0.123 "rm -rf /opt/qixinbot-site/* && tar -C /opt/qixinbot-site -xzf /tmp/site.tar.gz && rm /tmp/site.tar.gz"`)
      // 公网站点（bot.inory.xin）：registry 推送后由 GitHub→Netlify 自动构建发布
      deployState.ok = true
      deployState.log.push('✓ 部署完成 http://10.0.0.123:8090')
    } catch (e) {
      deployState.ok = false
      deployState.error = String(e.message || e)
    } finally {
      deployState.busy = false
      deployState.finishedAt = new Date().toISOString()
    }
  })()
  return { started: true }
}
function scheduleDeploy() {
  if (!CFG.autoDeploy) return
  runDeploy().catch((e) => console.error('自动部署失败:', e.message))
}

// ---------- HTTP ----------

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}
async function readBody(req) {
  let b = ''
  for await (const c of req) b += c
  return b ? JSON.parse(b) : {}
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(seaAsset('store-gui.html'))
    }
    if (url.pathname === '/api/config') {
      if (req.method === 'GET') return json(res, 200, { ...CFG, giteaToken: CFG.giteaToken ? '••••' + CFG.giteaToken.slice(-4) : '', githubToken: CFG.githubToken ? '••••' + CFG.githubToken.slice(-4) : '', hasGiteaToken: !!CFG.giteaToken, hasGithubToken: !!CFG.githubToken })
      const b = await readBody(req)
      for (const k of ['giteaUrl', 'giteaToken', 'githubToken', 'proxy', 'giteaOwner', 'githubOwner', 'pluginsRepo', 'deployKeyPath', 'nasYamlPath']) {
        if (typeof b[k] === 'string' && b[k] && !b[k].startsWith('••••')) CFG[k] = b[k]
      }
      if (typeof b.autoDeploy === 'boolean') CFG.autoDeploy = b.autoDeploy
      saveCfg()
      return json(res, 200, { ok: true })
    }
    if (url.pathname === '/api/compare' && req.method === 'GET') {
      const [g, h, reg] = await Promise.all([
        gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/packages`),
        Promise.resolve(gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/contents/packages`)),
        Promise.resolve(readReg()),
      ])
      if (g.status !== 200) throw new Error(`Gitea API ${g.status}：检查设置里的 token / 仓库归属`)
      if (!Array.isArray(h.json)) throw new Error('GitHub API 失败：检查网络代理或 token')
      const gMap = new Map((g.json ?? []).map((e) => [e.name.replace(/\.anzu$/, ''), e]))
      const hMap = new Map((h.json ?? []).map((e) => [e.name.replace(/\.anzu$/, ''), e]))
      const regMap = new Map(reg.map((e) => [e.id, e]))
      const ids = [...new Set([...gMap.keys(), ...hMap.keys(), ...regMap.keys()])].sort()
      const rows = ids.map((id) => ({
        id,
        gitea: gMap.has(id), giteaSize: gMap.get(id)?.size ?? 0,
        github: hMap.has(id), githubSize: hMap.get(id)?.size ?? 0,
        inStore: regMap.has(id),
        storeVersion: regMap.get(id)?.version ?? null,
        storeTier: regMap.get(id)?.tier ?? null,
      }))
      return json(res, 200, { rows, regCount: reg.length })
    }
    if (url.pathname === '/api/sync' && req.method === 'POST') {
      const { direction, ids } = await readBody(req)
      const out = []
      for (const id of ids) {
        const name = `${id}.anzu`
        if (direction === 'gitea2github') {
          const src = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/packages/${name}?ref=main`)
          if (src.status !== 200) { out.push({ id, ok: false, err: 'gitea 读取失败' }); continue }
          const b64 = src.json.content?.replace(/\n/g, '') ?? src.json.content
          const dst = gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/contents/packages/${name}?ref=main`)
          const sha = dst.json?.sha
          const res = gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/contents/packages/${name}`, {
            method: 'PUT',
            body: { message: `同步 ${name}（自 Gitea）`, content: b64, branch: 'main', ...(sha ? { sha } : {}) },
          })
          out.push({ id, ok: !!res.json?.commit?.sha })
        } else {
          const buf = dl(`https://github.com/${CFG.githubOwner}/${CFG.pluginsRepo}/raw/main/packages/${name}`, true)
          const src = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/packages/${name}?ref=main`)
          const res = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/contents/packages/${name}`, {
            method: 'PUT',
            body: { branch: 'main', message: `同步 ${name}（自 GitHub）`, content: buf.toString('base64'), ...(src.status === 200 ? { sha: src.json.sha } : {}) },
          })
          out.push({ id, ok: res.status < 300 })
        }
      }
      return json(res, 200, { results: out })
    }
    if (url.pathname === '/api/shelf' && req.method === 'POST') {
      const { id } = await readBody(req)
      const raw = dl(`${CFG.giteaUrl}/${CFG.giteaOwner}/${CFG.pluginsRepo}/raw/branch/main/packages/${id}.anzu`, false)
      const scan = scanPackage(raw)
      if (!scan.man.id) throw new Error('包里没有 manifest.toml')
      const list = readReg()
      if (list.some((e) => e.id === scan.man.id)) throw new Error(`商店里已有 ${scan.man.id}`)
      const entry = {
        id: scan.man.id, name: scan.man.name ?? id, tier: 'official', kind: scan.man.kind === 'theme' ? 'theme' : 'plugin',
        category: 'tool', description: scan.man.description ?? '', language: 'Node.js', deps: [],
        permissions: String(scan.man.permissions ?? '').split(/[[\]",\s]+/).filter((s) => s.startsWith('onebot.')),
        observe: /observe\s*=\s*true/.test(scan.mRaw), version: scan.man.version ?? '?',
        author: 'QixinBot 官方', repo: `repo://QixinBot-go-plugins/tree/main/src/${scan.man.id ?? id}`,
        package: `repo://QixinBot-go-plugins/raw/main/packages/${scan.man.id ?? id}.anzu`, fingerprint: null, tags: [],
      }
      list.push(entry)
      writeReg(list)
      gitRegistryCommit(`商店上架 ${entry.name}(${entry.id})（管理台）`)
      return json(res, 200, { ok: true, entry })
    }
    if (url.pathname === '/api/issues' && req.method === 'GET') {
      const platform = url.searchParams.get('platform') ?? 'github'
      let issues
      // 拉全部开放工单后在代码里按标签过滤：中文 label 放 URL 参数会被 GitHub 拒
      const hasLabel = (i) => (i.labels ?? []).some((l) => (l.name ?? l) === '插件收录')
      if (platform === 'gitea') {
        const r = await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/issues?state=open&limit=50`)
        if (r.status !== 200 || !Array.isArray(r.json)) {
          return json(res, 200, { issues: [], note: `Gitea 返回 ${r.status}：token 需要 read:issue / write:issue 权限（设置里换新 token），或改用 GitHub 提交` })
        }
        issues = (r.json)
          .filter((i) => hasLabel(i) && i.pull_request === undefined)
          .map((i) => ({ num: i.number, title: i.title, author: i.user?.login, created: i.created_at }))
      } else {
        const r = gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/issues?state=open&per_page=50`)
        issues = (r.json ?? [])
          .filter((i) => hasLabel(i) && i.pull_request === undefined)
          .map((i) => ({ num: i.number, title: i.title, author: i.user?.login, created: i.created_at }))
      }
      return json(res, 200, { issues })
    }
    if (url.pathname === '/api/review' && req.method === 'POST') {
      const { platform, num } = await readBody(req)
      return json(res, 200, await doReview(platform, num))
    }
    if (url.pathname === '/api/review-file' && req.method === 'GET') {
      const key = url.searchParams.get('key')
      const name = url.searchParams.get('name')
      const cached = reviewCache.get(key)
      const e = cached?.entries.find((x) => x.name === name)
      if (!e) return json(res, 404, { err: 'not found' })
      return json(res, 200, { name: e.name, text: e.data.subarray(0, 300000).toString('utf8'), truncated: e.data.length > 300000 })
    }
    if (url.pathname === '/api/approve' && req.method === 'POST') {
      const { platform, num } = await readBody(req)
      const key = `${platform}:${num}`
      const cached = reviewCache.get(key)
      const report = cached ?? await doReview(platform, num)
      const list = readReg()
      if (list.some((e) => e.id === report.entry.id)) throw new Error(`商店里已有 ${report.entry.id}（如需更新请手工编辑条目）`)
      list.push(report.entry)
      writeReg(list)
      gitRegistryCommit(`商店上架第三方插件 ${report.entry.name}(${report.entry.id})，审核 issue ${platform}#${num}`)
      return json(res, 200, { ok: true, entry: report.entry })
    }
    if (url.pathname === '/api/reject' && req.method === 'POST') {
      const { platform, num, reason } = await readBody(req)
      const comment = `审核未通过：${reason || '未说明原因'}\n\n可以补充材料后重新提交收录申请。`
      if (platform === 'gitea') {
        await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/issues/${num}/comments`, { method: 'POST', body: { body: comment } })
        await gitea(`/repos/${CFG.giteaOwner}/${CFG.pluginsRepo}/issues/${num}`, { method: 'PATCH', body: { state: 'closed' } })
      } else {
        gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/issues/${num}/comments`, { method: 'POST', body: { body: comment } })
        gh(`/repos/${CFG.githubOwner}/${CFG.pluginsRepo}/issues/${num}`, { method: 'PATCH', body: { state: 'closed' } })
      }
      return json(res, 200, { ok: true })
    }
    if (url.pathname === '/api/registry' && req.method === 'GET') {
      return json(res, 200, { entries: readReg() })
    }
    if (url.pathname === '/api/categories' && req.method === 'GET') {
      return json(res, 200, readCats())
    }
    if (url.pathname === '/api/categories/save' && req.method === 'POST') {
      const { cats } = await readBody(req)
      if (!cats || typeof cats !== 'object' || Object.keys(cats).length === 0) throw new Error('分类不能为空')
      if (!('other' in cats)) throw new Error('必须保留默认分类 other（其他）——被删分类的条目会归入它')
      const entries = readReg()
      const reassigned = []
      for (const e of entries) {
        if (!(e.category in cats)) { e.category = 'other'; reassigned.push(e.id) }
      }
      writeFileSync(CATS_PATH(), JSON.stringify(cats, null, 2) + '\n')
      writeReg(entries)
      gitRegistryCommit(`商店后台：更新分类${reassigned.length ? `（${reassigned.length} 个条目归入其他）` : ''}`)
      return json(res, 200, { ok: true, cats, reassigned })
    }
    if (url.pathname === '/api/registry/save' && req.method === 'POST') {
      const { entries, msg } = await readBody(req)
      writeReg(entries)
      gitRegistryCommit(msg || '商店后台更新 registry（管理台）')
      return json(res, 200, { ok: true, count: entries.length })
    }
    if (url.pathname === '/api/upload' && req.method === 'POST') {
      return json(res, 200, await uploadPublish(await readBody(req)))
    }
    if (url.pathname === '/api/deploy' && req.method === 'POST') {
      return json(res, 200, await runDeploy())
    }
    if (url.pathname === '/api/deploy-status' && req.method === 'GET') {
      return json(res, 200, { ...deployState, log: deployState.log })
    }
    if (url.pathname === '/api/sync-all' && req.method === 'POST') {
      // 一键同步：触发插件仓库的 Gitea→GitHub 镜像立即同步 + 官网重新部署
      // 网站仓库绝不走镜像同步：Gitea 的网站副本是被动镜像，强制同步会把
      // Gitea 的旧历史盖回 GitHub（曾把线上回退到旧版本）。网站以 GitHub 为准，
      // 改站时同时推送 github 与 gitea 两个远端保持一致。
      const mirrors = []
      for (const r of [CFG.pluginsRepo]) {
        const res2 = await gitea(`/repos/${CFG.giteaOwner}/${r}/push_mirrors-sync`, { method: 'POST' })
        mirrors.push({ repo: r, ok: res2.status < 300 })
      }
      const d = await runDeploy()
      return json(res, 200, { mirrors, deploy: d })
    }
    json(res, 404, { err: 'no route' })
  } catch (e) {
    json(res, 500, { err: String(e.message || e) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ 插件商店管理台已启动：http://localhost:${PORT}`)
  console.log('  配置：' + CONFIG_PATH)
  if (!process.argv.includes('--no-open')) {
    try { execSync(`start "" "http://localhost:${PORT}"`, { shell: 'cmd.exe', stdio: 'ignore' }) } catch {}
  }
})

#!/usr/bin/env node
/** 把构建产物部署到 Netlify（纯 API：sha 清单 → 补传缺失文件 → 轮询就绪）
 *  用法：node tools/netlify-deploy.mjs [--dir docs/.vitepress/dist] [--site <id>] [--token <tok>]
 *  token/site 缺省从 tools/gui-config.json 读 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import process from 'node:process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let cfg = {}
if (existsSync(join(ROOT, 'tools', 'gui-config.json')))
  cfg = JSON.parse(readFileSync(join(ROOT, 'tools', 'gui-config.json'), 'utf8'))

const args = process.argv.slice(2)
function opt(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const dir = resolve(opt('--dir') ?? join(ROOT, 'docs/.vitepress/dist'))
const siteId = opt('--site') ?? cfg.netlifySiteId
const token = opt('--token') ?? cfg.netlifyToken ?? process.env.NETLIFY_TOKEN
const proxy = opt('--proxy') ?? cfg.proxy ?? 'http://127.0.0.1:7890'
if (!siteId || !token) { console.error('✗ 缺 site id 或 token'); process.exit(1) }

function curlJson(method, url, bodyFile) {
  const out = execSync(
    `curl -s -m 120 -x ${proxy} -X ${method} -H "Authorization: Bearer ${token}" ${bodyFile ? `-H "Content-Type: application/json" --data-binary @${bodyFile}` : ''} "${url}"`,
    { maxBuffer: 64 * 1024 * 1024 })
  return JSON.parse(out.toString('utf8'))
}
function curlPutFile(url, file) {
  for (let i = 1; i <= 3; i++) {
    try {
      execSync(`curl -s -m 120 -x ${proxy} -X PUT -H "Content-Type: application/octet-stream" -T "${file}" "${url}"`,
        { maxBuffer: 64 * 1024 * 1024 })
      return
    } catch (e) {
      if (i === 3) throw e
      console.log(`  上传失败重试 ${i}/3…`)
    }
  }
}

// 收集文件
const files = {}
function walk(d) {
  for (const name of readdirSync(d)) {
    const full = join(d, name)
    if (statSync(full).isDirectory()) walk(full)
    else {
      const rel = '/' + relative(dir, full).split('\\').join('/')
      files[rel] = createHash('sha1').update(readFileSync(full)).digest('hex')
      bySha.set(files[rel], full)
    }
  }
}
const bySha = new Map()
walk(dir)
const bodyFile = join(process.env.TEMP ?? '/tmp', 'netlify-deploy-body.json')
writeFileSync(bodyFile, JSON.stringify({ files }))

console.log(`部署 ${Object.keys(files).length} 个文件 → site ${siteId}`)
const dep = curlJson('POST', `https://api.netlify.com/api/v1/sites/${siteId}/deploys`, bodyFile)
if (!dep.id) { console.error('✗ 创建部署失败:', JSON.stringify(dep).slice(0, 300)); process.exit(1) }
console.log(`deploy id: ${dep.id}，需上传 ${(dep.required ?? []).length} 个`)

for (const sha of dep.required ?? []) {
  const file = bySha.get(sha)
  if (!file) { console.error('✗ 缺少文件映射', sha); process.exit(1) }
  curlPutFile(`https://api.netlify.com/api/v1/deploys/${dep.id}/files/${sha}`, file)
  console.log('  ↑ ' + file)
}

// 轮询就绪
for (;;) {
  const st = curlJson('GET', `https://api.netlify.com/api/v1/deploys/${dep.id}`)
  if (st.state === 'ready') { console.log('✓ 部署就绪:', st.ssl_url ?? st.url); break }
  if (st.state === 'error') { console.error('✗ 部署失败:', JSON.stringify(st).slice(0, 300)); process.exit(1) }
  console.log('  state:', st.state)
  await new Promise(r => setTimeout(r, 3000))
}

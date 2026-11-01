#!/usr/bin/env node
/** 构建前从插件仓库拉取最新的 registry.json（插件商店的单一事实来源）。
 *  用 GitHub API（contents）而非 raw：raw 的 CDN 有缓存滞后，API 永远权威。
 *  本地运行自动带管理台配置的 token 和代理；Netlify/CI 上匿名直连。 */
import { writeFileSync, existsSync, readFileSync, copyFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'docs', 'plugins', 'registry.json')
const URL_ = 'https://api.github.com/repos/inoryxin/QixinBot-go-plugins/contents/registry.json'

let proxy = ''
let ghToken = ''
try {
  const cfgPath = join(here, 'gui-config.json')
  if (existsSync(cfgPath)) {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
    proxy = cfg.proxy ?? ''
    ghToken = cfg.githubToken ?? ''
  }
} catch {}
const auth = ghToken ? `-H "Authorization: Bearer ${ghToken}"` : ''
const p = `${proxy ? `-x ${proxy}` : ''} ${auth}`

const FALLBACK = join(here, '..', 'docs', 'plugins', 'registry.fallback.json')
let parsed = null
for (let i = 1; i <= 3 && !parsed; i++) {
  try {
    const data = execSync(`curl -sL -m 60 ${p} "${URL_}"`, { maxBuffer: 16 * 1024 * 1024 })
    const d = JSON.parse(data.toString('utf8'))
    const j = JSON.parse(Buffer.from(d.content, 'base64').toString('utf8'))
    if (!Array.isArray(j)) throw new Error('registry 格式不对')
    parsed = j
    writeFileSync(out, JSON.stringify(j, null, 2) + '\n')
    console.log(`✓ registry 已拉取：${j.length} 条（第 ${i} 次尝试）`)
  } catch (e) {
    console.warn(`⚠ 拉取失败（第 ${i}/3 次）: ${e.message}`)
    if (i < 3) await new Promise(r => setTimeout(r, 5000))
  }
}
if (!parsed) {
  if (existsSync(FALLBACK)) {
    copyFileSync(FALLBACK, out)
    console.warn('⚠ 三次拉取均失败，使用仓库内兜底副本（可能略旧）')
  } else {
    console.error('✗ 拉取失败且无兜底副本')
    process.exit(1)
  }
}

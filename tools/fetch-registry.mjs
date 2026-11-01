#!/usr/bin/env node
/** 构建前从插件仓库拉取最新的 registry.json（插件商店的单一事实来源）。
 *  本地运行时自动使用管理台配置里的代理；Netlify/CI 上直连。 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'docs', 'plugins', 'registry.json')
// 加时间戳参数穿透 CDN 缓存，确保每次构建拿到最新 registry
const URL_ = 'https://raw.githubusercontent.com/inoryxin/QixinBot-go-plugins/main/registry.json?t=' + Date.now()

let proxy = ''
try {
  const cfgPath = join(here, 'gui-config.json')
  if (existsSync(cfgPath)) proxy = JSON.parse(readFileSync(cfgPath, 'utf8')).proxy ?? ''
} catch {}
const p = proxy ? `-x ${proxy}` : ''

const FALLBACK = join(here, '..', 'docs', 'plugins', 'registry.fallback.json')
let parsed = null
for (let i = 1; i <= 3 && !parsed; i++) {
  try {
    const data = execSync(`curl -sL -m 60 ${p} "${URL_}"`, { maxBuffer: 16 * 1024 * 1024 })
    const j = JSON.parse(data.toString('utf8'))
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

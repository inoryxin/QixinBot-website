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
const URL_ = 'https://raw.githubusercontent.com/inoryxin/QixinBot-go-plugins/main/registry.json'

let proxy = ''
try {
  const cfgPath = join(here, 'gui-config.json')
  if (existsSync(cfgPath)) proxy = JSON.parse(readFileSync(cfgPath, 'utf8')).proxy ?? ''
} catch {}
const p = proxy ? `-x ${proxy}` : ''

try {
  const data = execSync(`curl -sL -m 60 ${p} "${URL_}"`, { maxBuffer: 16 * 1024 * 1024 })
  const parsed = JSON.parse(data.toString('utf8'))
  if (!Array.isArray(parsed)) throw new Error('registry 格式不对')
  writeFileSync(out, JSON.stringify(parsed, null, 2) + '\n')
  console.log(`✓ registry 已拉取：${parsed.length} 条`)
} catch (e) {
  if (existsSync(out)) {
    console.warn('⚠ 拉取失败，使用本地已有的 registry:', e.message)
  } else {
    console.error('✗ 拉取失败且无本地兜底:', e.message)
    process.exit(1)
  }
}

#!/usr/bin/env node
/** 把插件商店管理台打成单文件 exe（Node SEA）：
 *  esbuild 打包 → sea blob → 注入 node.exe → 拷到桌面 */
import { execSync } from 'node:child_process'
import { copyFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const seaDir = join(here, 'sea')
const exeName = 'QixinBotStoreGui.exe'
mkdirSync(seaDir, { recursive: true })

console.log('1/5 esbuild 打包…')
execSync(
  `npx esbuild ${join(here, 'store-gui.mjs')} --bundle --platform=node --format=cjs ` +
  `--outfile=${join(seaDir, 'gui-bundle.cjs')} --log-level=warning`,
  { cwd: join(here, '..'), stdio: 'inherit' },
)

console.log('2/5 生成 SEA 配置与 blob…')
writeFileSync(join(seaDir, 'sea-config.json'), JSON.stringify({
  main: join(seaDir, 'gui-bundle.cjs'),
  output: join(seaDir, 'gui-sea.blob'),
  assets: { 'store-gui.html': join(here, 'store-gui.html') },
  disableExperimentalSEAWarning: true,
}, null, 2))
execSync(`node --experimental-sea-config ${join(seaDir, 'sea-config.json')}`, { stdio: 'inherit', cwd: seaDir })

console.log('3/5 复制 node.exe…')
const exe = join(seaDir, exeName)
rmSync(exe, { force: true })
copyFileSync(process.execPath, exe)

console.log('4/5 注入 blob（postject）…')
execSync(
  `npx postject ${exe} NODE_SEA_BLOB ${join(seaDir, 'gui-sea.blob')} ` +
  `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
  { stdio: 'inherit' },
)

console.log('5/5 拷贝到桌面…')
const desktops = [join(homedir(), 'Desktop'), join(homedir(), 'OneDrive', 'Desktop')]
const desktop = desktops.find((d) => existsSync(d))
if (!desktop) { console.log('  没找到桌面目录，exe 在 ' + exe); process.exit(0) }
const dest = join(desktop, 'QixinBot商店管理台.exe')
copyFileSync(exe, dest)
console.log(`✓ 已放到桌面：${dest}`)
console.log('  首次双击会在同目录生成 gui-config.json（token/官网仓库路径在设置页填）')

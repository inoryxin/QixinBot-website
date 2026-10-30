<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resolveRepoLink, LINKS } from '../../links'
import registry from '../../../plugins/registry.json'
import CATEGORIES from '../../../plugins/categories.json'

interface PluginEntry {
  id: string
  name: string
  tier: 'official' | 'third-party'
  kind: 'plugin' | 'theme'
  category: string
  description: string
  language: string
  deps: string[]
  permissions: string[]
  observe: boolean
  version: string
  author: string
  repo: string
  package: string
  fingerprint: string | null
  tags: string[]
}

const entries = registry as PluginEntry[]

// 分类来自 docs/plugins/categories.json（管理台可增删）

const PERM_LABELS: Record<string, string> = {
  'onebot.write': '收发消息',
  'onebot.admin': '账号管理',
  'onebot.dangerous': '危险操作',
}

const query = ref('')
const activeCategory = ref('all')

// 默认分类：categories.json 里不存在或缺失的一律归 other（其他）
const DEFAULT_CAT = 'other'
const catOf = (e: PluginEntry) => (CATEGORIES[e.category] ? e.category : DEFAULT_CAT)

// 置顶快捷筛选：@node / @python 按「语言 OR 依赖」判定（Node.js 运行时算 Node、Python 运行时算 Python）
function quickMatch(e: PluginEntry, key: string): boolean {
  if (key === '@node')
    return !isPythonSide(e.language) || (e.deps ?? []).some((d) => !isPythonSide(d))
  if (key === '@python')
    return isPythonSide(e.language) || (e.deps ?? []).some((d) => isPythonSide(d))
  if (key === 'theme') return e.kind === 'theme'
  return catOf(e) === key
}

const chipList = computed(() => {
  const pinned = [
    { key: 'all', label: '全部' },
    { key: '@node', label: 'Node.js' },
    { key: '@python', label: 'Python' },
    { key: 'theme', label: CATEGORIES.theme ?? '主题' },
  ]
  const rest = Object.entries(CATEGORIES)
    .filter(([k]) => k !== 'theme')
    .map(([key, label]) => ({ key, label }))
  return [...pinned, ...rest]
})

const counts = computed(() => {
  const c: Record<string, number> = {}
  for (const chip of chipList.value) {
    c[chip.key] =
      chip.key === 'all'
        ? entries.length
        : entries.filter((e) => quickMatch(e, chip.key)).length
  }
  return c
})

const sortMode = ref('default')
const SORTS: Record<string, string> = {
  default: '默认排序',
  name: '按中文名',
  version: '按版本',
}
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = entries
    .filter((e) => quickMatch(e, activeCategory.value))
    .filter((e) => {
      if (!q) return true
      return [e.name, e.id, e.description, e.language, ...(e.tags ?? []), CATEGORIES[catOf(e)] ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  const sorted = [...list].sort((a, b) =>
    a.tier === b.tier ? a.id.localeCompare(b.id) : a.tier === 'official' ? -1 : 1,
  )
  if (sortMode.value === 'name') sorted.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans-CN'))
  if (sortMode.value === 'version') sorted.sort((a, b) => b.version.localeCompare(a.version))
  return sorted
})

// 分页：每页 20 个，搜索/切分类时回到第一页
const PAGE_SIZE = 20
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() =>
  filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE),
)
watch([query, activeCategory], () => {
  page.value = 1
})
function goto(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
  document.querySelector('.store-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// 四色体系：Node.js 绿 / Python 蓝，依赖按所属生态再分青色（Node 侧）与紫色（Python 侧）
function isPythonSide(s: string): boolean {
  return /python|pillow|pip|numpy|torch/i.test(s)
}
function langClass(lang: string): string {
  return isPythonSide(lang) ? 'chip-python' : 'chip-node'
}
function depClass(dep: string): string {
  return isPythonSide(dep) ? 'chip-dep-python' : 'chip-dep-node'
}

// tag 配色：按内容哈希从固定色板取色，同名 tag 永远同色
const TAG_PALETTE = ['tag-c1', 'tag-c2', 'tag-c3', 'tag-c4', 'tag-c5', 'tag-c6']
function tagClass(t: string): string {
  let h = 0
  for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return TAG_PALETTE[h % TAG_PALETTE.length]
}
</script>

<template>
  <div class="plugin-store">
    <div class="store-hero">
      <h1 class="store-title">插件商店</h1>
      <p class="store-count">当前共有 {{ entries.length }} 个插件与主题</p>
      <p class="store-disclaimer">
        官方插件经过审核与长期稳定性验证；第三方插件由作者自己签名，收录前经人工审核，
        但<strong>官方不对第三方的稳定性与安全性负责</strong>，安装时请核对签名指纹。
      </p>
    </div>

    <div class="store-search-wrap">
      <input
        v-model="query"
        class="store-search"
        type="search"
        placeholder="搜索插件：名字 / 功能 / 语言 / tag…"
        aria-label="搜索插件"
      />
      <select v-model="sortMode" class="store-sort" aria-label="排序方式">
        <option v-for="(label, key) in SORTS" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div class="store-toolbar">
      <div class="store-cats" role="tablist" aria-label="插件分类">
        <button
          v-for="chip in chipList"
          :key="chip.key"
          class="store-cat"
          :class="{ active: activeCategory === chip.key }"
          role="tab"
          :aria-selected="activeCategory === chip.key"
          @click="activeCategory = chip.key"
        >
          {{ chip.label }}
          <span class="cat-count">{{ counts[chip.key] ?? 0 }}</span>
        </button>
      </div>
      <a class="store-publish" :href="LINKS.pluginsSubmit" target="_blank" rel="noopener">
        <span class="plus">＋</span> 发布插件
      </a>
    </div>

    <p v-if="filtered.length === 0" class="store-empty">没有匹配的插件，换个关键字试试。</p>

    <div class="store-grid">
      <article v-for="e in paged" :key="e.id" class="plugin-card">
        <header class="card-head">
          <h3 class="card-name">{{ e.name }}</h3>
          <span class="badge" :class="e.tier === 'official' ? 'badge-official' : 'badge-third'">
            {{ e.tier === 'official' ? '官方' : '第三方' }}
          </span>
          <span v-if="e.kind === 'theme'" class="badge badge-kind">主题</span>
        </header>

        <p class="card-desc">{{ e.description }}</p>

        <div class="card-meta">
          <span class="chip" :class="langClass(e.language)">{{ e.language }}</span>
          <span v-for="d in e.deps" :key="d" class="chip" :class="depClass(d)">{{ d }}</span>
          <span v-for="t in e.tags ?? []" :key="t" class="chip" :class="tagClass(t)">#{{ t }}</span>
        </div>

        <div v-if="e.fingerprint" class="card-fp">
          <code>{{ e.fingerprint }}</code>
          <p class="fp-note">第三方签名，官方不对其稳定性与安全性负责，安装时请核对指纹。</p>
        </div>

        <footer class="card-foot">
          <span class="card-ver">v{{ e.version }}</span>
          <span class="card-author">{{ e.author }}</span>
          <span class="card-links">
            <a :href="resolveRepoLink(e.repo)" target="_blank" rel="noopener">源码</a>
            <a v-if="e.package" :href="resolveRepoLink(e.package)" target="_blank" rel="noopener">
              下载{{ e.kind === 'theme' ? '主题' : ' .anzu' }}
            </a>
          </span>
        </footer>
      </article>
    </div>

    <nav v-if="totalPages > 1" class="store-pager" aria-label="分页">
      <button class="pager-btn" :disabled="page === 1" @click="goto(page - 1)">‹ 上一页</button>
      <button
        v-for="p in totalPages"
        :key="p"
        class="pager-num"
        :class="{ active: p === page }"
        :aria-current="p === page ? 'page' : undefined"
        @click="goto(p)"
      >
        {{ p }}
      </button>
      <button class="pager-btn" :disabled="page === totalPages" @click="goto(page + 1)">下一页 ›</button>
      <span class="pager-info">第 {{ page }} / {{ totalPages }} 页 · 每页 {{ PAGE_SIZE }} 个</span>
    </nav>
  </div>
</template>

<style scoped>
.plugin-store {
  margin-top: 4px;
}

/* ---------- 顶部：标题 / 数量 / 免责声明 ---------- */
.store-hero {
  text-align: center;
  margin: 20px 0 0;
}
.store-title {
  margin: 0;
  padding: 0;
  border: none;
  font-size: 42px;
  line-height: 1.2;
  font-weight: 700;
}
.store-count {
  margin: 10px 0 0;
  font-size: 15px;
  color: var(--vp-c-text-2);
}
.store-disclaimer {
  max-width: 780px;
  margin: 8px auto 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--vp-c-text-3);
}
.store-disclaimer strong {
  color: var(--vp-c-text-2);
}

/* ---------- 搜索框（居中、加宽） ---------- */
.store-search-wrap {
  display: flex;
  justify-content: center;
  margin: 24px 0 18px;
}
.store-search {
  width: 100%;
  max-width: 680px;
  padding: 11px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 14.5px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.store-sort {
  padding: 10px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 13.5px;
  cursor: pointer;
}
.store-search:focus {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}

/* ---------- 工具栏：分类居左，发布插件居右 ---------- */
.store-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}
.store-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.store-cat {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  border-radius: 999px;
  padding: 5px 13px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.store-cat:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}
.store-cat.active {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  font-weight: 600;
}
.cat-count {
  opacity: 0.65;
  font-size: 12px;
  margin-left: 2px;
}
.store-publish {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--vp-c-brand-3);
  color: #fff;
  border-radius: 999px;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: filter 0.15s, transform 0.15s;
}
.store-publish:hover {
  filter: brightness(1.1);
  color: #fff;
  transform: translateY(-1px);
}
.store-publish .plus {
  font-size: 16px;
  line-height: 1;
}

/* ---------- 卡片网格 ---------- */
.store-empty {
  color: var(--vp-c-text-2);
  padding: 32px 0;
  text-align: center;
}
.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.plugin-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  padding: 18px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.plugin-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-name {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
  border: none;
  padding: 0;
}
.badge {
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  white-space: nowrap;
  font-weight: 600;
}
.badge-official {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.badge-third {
  background: rgba(234, 179, 8, 0.14);
  color: #b45309;
}
.dark .badge-third {
  color: #facc15;
}
.badge-kind {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}
.card-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  flex-grow: 1;
}
.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  white-space: nowrap;
}
/* 四色体系：语言 Node 绿 / Python 蓝；依赖 Node 侧青 / Python 侧紫 */
.chip-node {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
  font-weight: 600;
}
.dark .chip-node {
  color: #4ade80;
}
.chip-python {
  background: rgba(59, 130, 246, 0.13);
  color: #1d4ed8;
  font-weight: 600;
}
.dark .chip-python {
  color: #93c5fd;
}
.chip-dep-node {
  background: rgba(6, 182, 212, 0.13);
  color: #0e7490;
}
.dark .chip-dep-node {
  color: #67e8f9;
}
.chip-dep-python {
  background: rgba(168, 85, 247, 0.14);
  color: #7e22ce;
}
.dark .chip-dep-python {
  color: #d8b4fe;
}
.chip-tag {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-3);
}
/* tag 六色板：按内容哈希取色 */
.chip.tag-c1 { background: rgba(59, 130, 246, 0.13); color: #1d4ed8; }
.chip.tag-c2 { background: rgba(236, 72, 153, 0.13); color: #be185d; }
.chip.tag-c3 { background: rgba(34, 197, 94, 0.14); color: #15803d; }
.chip.tag-c4 { background: rgba(234, 179, 8, 0.16); color: #a16207; }
.chip.tag-c5 { background: rgba(168, 85, 247, 0.14); color: #7e22ce; }
.chip.tag-c6 { background: rgba(6, 182, 212, 0.13); color: #0e7490; }
.dark .chip.tag-c1 { color: #93c5fd; }
.dark .chip.tag-c2 { color: #f9a8d4; }
.dark .chip.tag-c3 { color: #86efac; }
.dark .chip.tag-c4 { color: #fde047; }
.dark .chip.tag-c5 { color: #d8b4fe; }
.dark .chip.tag-c6 { color: #67e8f9; }
.chip-danger {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}
.dark .chip-danger {
  color: #fca5a5;
}
.card-fp code {
  font-size: 11px;
  word-break: break-all;
}
.fp-note {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--vp-c-text-3);
  line-height: 1.5;
}
.card-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 10px;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.card-ver {
  font-family: var(--vp-font-family-mono, monospace);
}
.card-links {
  margin-left: auto;
  display: flex;
  gap: 12px;
}
.card-links a {
  color: var(--vp-c-brand-1);
  font-weight: 500;
  text-decoration: none;
}
.card-links a:hover {
  text-decoration: underline;
}

/* ---------- 分页 ---------- */
.store-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 26px;
}
.pager-btn,
.pager-num {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.pager-btn:hover:not(:disabled),
.pager-num:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
}
.pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.pager-num.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 700;
}
.pager-info {
  font-size: 12px;
  color: var(--vp-c-text-3);
  margin-left: 6px;
}

@media (max-width: 768px) {
  .store-title {
    font-size: 32px;
  }
  .store-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .store-publish {
    align-self: flex-end;
  }
}
</style>

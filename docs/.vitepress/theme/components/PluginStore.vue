<script setup lang="ts">
import { computed, ref } from 'vue'
import { resolveRepoLink, LINKS } from '../../links'
import registry from '../../../plugins/registry.json'

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

const CATEGORIES: Record<string, string> = {
  ai: 'AI 助手',
  fun: '娱乐互动',
  feed: '订阅推送',
  group: '群聊管理',
  tool: '工具查询',
  device: '设备管家',
  theme: '主题',
}

const PERM_LABELS: Record<string, string> = {
  'onebot.write': '收发消息',
  'onebot.admin': '账号管理',
  'onebot.dangerous': '危险操作',
}

const query = ref('')
const activeCategory = ref('all')

const counts = computed(() => {
  const c: Record<string, number> = { all: entries.length }
  for (const e of entries) c[e.category] = (c[e.category] ?? 0) + 1
  return c
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return entries
    .filter((e) => activeCategory.value === 'all' || e.category === activeCategory.value)
    .filter((e) => {
      if (!q) return true
      return [e.name, e.id, e.description, e.language, ...(e.tags ?? []), CATEGORIES[e.category] ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
    .sort((a, b) =>
      a.tier === b.tier ? a.id.localeCompare(b.id) : a.tier === 'official' ? -1 : 1,
    )
})

function permLabel(p: string): string {
  return PERM_LABELS[p] ?? p
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
    </div>

    <div class="store-toolbar">
      <div class="store-cats" role="tablist" aria-label="插件分类">
        <button
          v-for="(label, key) in { all: '全部', ...CATEGORIES }"
          :key="key"
          class="store-cat"
          :class="{ active: activeCategory === key }"
          role="tab"
          :aria-selected="activeCategory === key"
          @click="activeCategory = key"
        >
          {{ label }}
          <span class="cat-count">{{ counts[key] ?? 0 }}</span>
        </button>
      </div>
      <a class="store-publish" :href="LINKS.pluginsSubmit" target="_blank" rel="noopener">
        <span class="plus">＋</span> 发布插件
      </a>
    </div>

    <p v-if="filtered.length === 0" class="store-empty">没有匹配的插件，换个关键字试试。</p>

    <div class="store-grid">
      <article v-for="e in filtered" :key="e.id" class="plugin-card">
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
          <span v-for="p in e.permissions" :key="p" class="chip" :class="{ 'chip-danger': p === 'onebot.dangerous' }">
            {{ permLabel(p) }}
          </span>
          <span v-if="e.observe" class="chip">观察全量消息</span>
          <span v-for="t in e.tags ?? []" :key="t" class="chip chip-tag">#{{ t }}</span>
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

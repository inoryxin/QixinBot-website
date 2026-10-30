<script setup lang="ts">
import { computed, ref } from 'vue'
import { resolveRepoLink } from '../../links'
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
      return [e.name, e.id, e.description, e.language, CATEGORIES[e.category] ?? '']
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
</script>

<template>
  <div class="plugin-store">
    <div class="store-toolbar">
      <input
        v-model="query"
        class="store-search"
        type="search"
        placeholder="搜索插件：名字 / 功能 / 语言…"
        aria-label="搜索插件"
      />
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
          <span class="chip">{{ e.language }}</span>
          <span v-for="d in e.deps" :key="d" class="chip chip-dep">{{ d }}</span>
          <span v-for="p in e.permissions" :key="p" class="chip" :class="{ 'chip-danger': p === 'onebot.dangerous' }">
            {{ permLabel(p) }}
          </span>
          <span v-if="e.observe" class="chip">观察全量消息</span>
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
  margin-top: 8px;
}
.store-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}
.store-search {
  width: 100%;
  max-width: 420px;
  padding: 8px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 14px;
  outline: none;
}
.store-search:focus {
  border-color: var(--vp-c-brand-1);
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
  padding: 4px 12px;
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
.store-empty {
  color: var(--vp-c-text-2);
  padding: 32px 0;
  text-align: center;
}
.store-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
.plugin-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  padding: 16px;
  transition: border-color 0.15s;
}
.plugin-card:hover {
  border-color: var(--vp-c-brand-1);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-name {
  margin: 0;
  font-size: 16px;
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
.chip-dep {
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
}
.dark .chip-dep {
  color: #93c5fd;
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
</style>

import { defineConfig } from 'vitepress'
import { resolveRepoLink } from './links'

// https://vitepress.dev/zh/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: 'QixinBot',
  description:
    '基于 OneBot 11 的机器人框架：宿主用 Go，插件用任意语言（独立子进程，stdio + JSON-RPC）',
  head: [['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]],

  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: '文档', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: '参考', link: '/reference/api', activeMatch: '/reference/' },
      { text: '下载', link: '/download' },
      { text: '插件', link: '/plugins' },
      { text: '更新日志', link: '/changelog' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '上手',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '部署', link: '/reference/deploy' },
          ],
        },
        {
          text: '插件开发',
          items: [
            { text: '插件开发：快速开始', link: '/guide/plugin-quickstart' },
            { text: '插件开发手册', link: '/guide/plugin-manual' },
          ],
        },
        {
          text: '运维',
          items: [{ text: '运维参考', link: '/reference/ops' }],
        },
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: '插件 API', link: '/reference/api' },
            { text: '部署', link: '/reference/deploy' },
            { text: '运维参考', link: '/reference/ops' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            resetButtonTitle: '清除关键字',
            noResultsText: '没有找到结果',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
        miniSearch: {
          options: {
            // 中文没有空格分词，用 Intl.Segmenter 按词切分后再建索引。
            // 注意：config 里的函数会被序列化到 @siteData 在浏览器端重建，
            // 闭包引用不到模块级变量，Segmenter 必须在函数体内创建。
            tokenize: (text: string) => {
              const g = globalThis as any
              g.__qbSegmenter ??= new Intl.Segmenter('zh-CN', { granularity: 'word' })
              return Array.from(
                new Set(
                  Array.from(g.__qbSegmenter.segment(text)).map((s) =>
                    s.segment.toLowerCase(),
                  ),
                ),
              )
            },
          },
        },
      },
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新' },
    returnToTop: '回到顶部',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    sidebarMenuLabel: '菜单',

    socialLinks: [
      {
        icon: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.32 9.32 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg>' },
        link: resolveRepoLink('repo://QixinBot-go'),
      },
    ],

    footer: {
      message: '基于 OneBot 11 · MIT License',
      copyright: 'Copyright © 2026 QixinBot',
    },
  },

  markdown: {
    lineNumbers: false,
    config(md) {
      // repo:// 链接在构建期解析为当前平台的真实 URL（见 links.ts）
      md.core.ruler.after('inline', 'resolve-repo-links', (state) => {
        for (const token of state.tokens) {
          if (token.type !== 'inline' || !token.children) continue
          for (const child of token.children) {
            if (child.type !== 'link_open') continue
            const href = child.attrGet('href')
            if (href && href.startsWith('repo://')) {
              child.attrSet('href', resolveRepoLink(href))
            }
          }
        }
      })
    },
  },
})

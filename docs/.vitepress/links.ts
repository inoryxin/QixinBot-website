/**
 * 全站外链的单一来源。
 *
 * Markdown 里用 repo:// 协议引用仓库资源，构建时由 config.mts 的 markdown 规则
 * 和前端组件里的 resolveRepoLink() 统一解析。换平台只改下面的 PLATFORM 一行。
 *
 * 支持的写法（REPO 为仓库名，其余路径原样拼接）：
 *   repo://REPO                          仓库主页
 *   repo://REPO/tree/main/src/xxx        目录（自动适配平台目录格式）
 *   repo://REPO/raw/main/packages/x.anzu 文件原始内容（自动适配平台 raw 格式）
 *   repo://REPO/releases                 Releases 列表
 *   repo://REPO/releases/download/TAG/F  release 资产直链
 *   repo://REPO/issues                   issue 列表
 *   repo://REPO/issues/new?template=...  提 issue
 */

export type Platform = 'github' | 'gitea'

// 换平台改这里：'github'（公网，含 release 资产与 issue 提交）或 'gitea'（内网）
export const PLATFORM: Platform = 'github'

const PLATFORMS = {
  github: {
    web: 'https://github.com',
    owner: 'inoryxin',
    // GitHub: /{owner}/{repo}/raw/{branch}/...
    rawPrefix: (owner: string, repo: string) => `${owner}/${repo}/raw/`,
    issuesNew: (owner: string, repo: string, query: string) =>
      `${owner}/${repo}/issues/new${query}`,
  },
  gitea: {
    web: 'http://10.0.0.140:30008',
    owner: 'inoryxin',
    // Gitea: /{owner}/{repo}/raw/branch/{branch}/...
    rawPrefix: (owner: string, repo: string) => `${owner}/${repo}/raw/branch/`,
    issuesNew: (owner: string, repo: string, query: string) =>
      `${owner}/${repo}/issues/new${query}`,
  },
} as const

export const REPOS = {
  framework: 'QixinBot-go',
  plugins: 'QixinBot-go-plugins',
  website: 'QixinBot-website',
} as const

export function resolveRepoLink(link: string): string {
  if (!link.startsWith('repo://')) return link
  const rest = link.slice('repo://'.length)
  const slash = rest.indexOf('/')
  const repo = slash === -1 ? rest : rest.slice(0, slash)
  const path = slash === -1 ? '' : rest.slice(slash + 1)
  const p = PLATFORMS[PLATFORM]

  let url = `${p.web}/${p.owner}/${repo}`
  if (path) {
    if (path.startsWith('raw/')) {
      // raw/{branch}/... → 平台各自的 raw 格式
      const branchAndFile = path.slice('raw/'.length)
      url += `/${p.rawPrefix(p.owner, repo)}${branchAndFile}`
    } else {
      url += `/${path}`
    }
  }
  return url
}

// 供 Vue 组件/配置直接取常用链接
export const LINKS = {
  get framework() {
    return resolveRepoLink(`repo://${REPOS.framework}`)
  },
  get frameworkReleases() {
    return resolveRepoLink(`repo://${REPOS.framework}/releases`)
  },
  get frameworkIssues() {
    return resolveRepoLink(`repo://${REPOS.framework}/issues`)
  },
  get pluginsRepo() {
    return resolveRepoLink(`repo://${REPOS.plugins}`)
  },
  get pluginsSubmit() {
    return resolveRepoLink(
      `repo://${REPOS.plugins}/issues/new?template=plugin-submission.yml`,
    )
  },
  get website() {
    return resolveRepoLink(`repo://${REPOS.website}`)
  },
}

# QixinBot 官网

QixinBot 的官网与文档站，基于 [VitePress](https://vitepress.dev/zh/) 构建。

- 线上地址：http://10.0.0.123:8090（1Panel 虚拟机，OpenResty 容器）
- 源码仓库：http://10.0.0.140:30008/inoryxin/QixinBot-website
- 公开主页：https://github.com/inoryxin（框架与插件仓库自 Gitea push mirror 持续同步）

## 链接平台切换（Gitea ↔ GitHub）

全站外链统一写成 `repo://` 协议（如 `repo://QixinBot-go/releases`），由
`docs/.vitepress/links.ts` 在构建期解析。**换平台只改 `links.ts` 里的
`PLATFORM` 一行**；Vue 组件一律 import `resolveRepoLink`，不要在代码里写死仓库 URL。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 产物在 docs/.vitepress/dist
npm run preview    # 本地预览构建产物（注意：改代码重新 build 后要重启 preview，sirv 启动时固定文件清单）
```

## 目录结构

```
docs/
  .vitepress/
    config.mts        站点配置：导航、侧边栏、本地搜索（Intl.Segmenter 中文分词）
    theme/custom.css  品牌色（logo 浅绿）+ hero 标题字号
  public/             logo、favicon
  index.md            首页（hero + 六特性 + 60 秒上手 + 为什么插件即进程）
  download.md         下载页（链接指向 Gitea Releases 资产）
  plugins.md          插件页（官方插件站占位）
  changelog.md        更新日志（同步自主仓 CHANGELOG.md）
  guide/
    getting-started.md    快速开始
    plugin-quickstart.md  插件开发：快速开始（迁自 Wiki）
    plugin-manual.md      插件开发手册（迁自 Wiki）
  reference/
    api.md            插件 API（迁自 Wiki）
    deploy.md         部署（迁自 Wiki）
    ops.md            运维参考（迁自 Wiki）
```

## 文档维护约定

- **文档只在这里改**。Wiki 已挂迁移公告，不再更新；新版本发布时同步改 `changelog.md`
  和 `download.md` 的版本号、资产链接。
- 迁移自 Wiki 的页面里，站内链接已改写为本站路径（`/guide/...`、`/reference/...`）。

## 插件商店管理（后台就是 registry.json）

插件目录的数据文件是 `docs/plugins/registry.json`，**添加 / 删除 / 改 tag 都是在这个
JSON 里增删改条目**，没有单独的图形后台。改完提交推送、重新构建部署即生效。

条目结构（两条模板，直接复制改字段）：

```jsonc
// 官方插件
{
  "id": "weather",                    // .anzu 的 manifest id，全表唯一
  "name": "天气",                     // 卡片上的中文名
  "tier": "official",                 // official=官方 / third-party=第三方
  "kind": "plugin",                   // plugin=插件 / theme=主题
  "category": "tool",                 // 见下面分类表
  "description": "一句话简介",
  "language": "Node.js",              // Node.js / Python / CSS(主题)
  "deps": [],                         // 依赖，如 ["Python 运行时", "Pillow"]
  "permissions": ["onebot.write"],    // onebot.write / onebot.admin / onebot.dangerous
  "observe": false,                   // 是否观察全量消息
  "version": "1.0.0",
  "author": "QixinBot 官方",
  "repo": "repo://QixinBot-go-plugins/tree/main/src/weather",
  "package": "repo://QixinBot-go-plugins/raw/main/packages/weather.anzu",
  "fingerprint": null,                // 第三方填 ed25519 指纹，官方留 null
  "tags": ["查询", "生活"]            // 自由 tag，#前缀展示、可被搜索
}
```

分类 `category` 可选值：`ai`（AI 助手）/ `fun`（娱乐互动）/ `feed`（订阅推送）/
`group`（群聊管理）/ `tool`（工具查询）/ `device`（设备管家）/ `theme`（主题）。

常用操作：

- **上架官方插件**：源码和 `.anzu` 放进 QixinBot-go-plugins 仓库 → registry.json 加一条
- **删除/下架**：删掉对应条目（插件包本体要不要删在 plugins 仓库里另操作）
- **改 tag / 改简介 / 转正第三方为官方**：直接改对应字段
- **第三方收录**：作者按 issue 模板提交 → 审核通过后按上面模板加条目，
  `tier` 设为 `third-party`、`fingerprint` 填公钥指纹

徽章配色是自动的：Node.js 绿 / Python 蓝，依赖按所属生态分青色（Node 侧）与
紫色（Python 侧），无需配置。

## 插件上传程序

不想用 git 提交 `.anzu` 包时，用上传程序直接推到 Gitea 插件仓库：

```bash
node tools/upload-plugin.mjs path/to/my-plugin.anzu          # 先 dry-run 预览
node tools/upload-plugin.mjs path/to/my-plugin.anzu --yes    # 真正提交
```

- 自动解析包内 manifest.toml（id/中文名/版本），提交到 `packages/<id>.anzu`；
  已存在则带 sha 覆盖更新
- token 依次找：`--token` → 环境变量 `GITEA_TOKEN` → `~/.gitea_nas_token.txt`
  （支持裸 token 和 git 凭据 URL 两种格式）
- 提交后 mirror 自动同步到 GitHub，raw 直链即可下载
- **商店展示是另一回事**：还要往 `docs/plugins/registry.json` 加/改条目（见上节）

## 插件仓库与 Wiki 分工

- [QixinBot-go-plugins](repo://QixinBot-go-plugins)：只放**源码**（`src/`，每个插件
  README 在各自目录）和**签名包**（`packages/`）；PC 管家、协议端等平台文档在
  [Wiki](repo://QixinBot-go-plugins/wiki)
- 两个 GitHub 仓库的 Wiki 与 Gitea 侧同步（GitHub wiki 需在网页上初始化一次后 git 推送）

## 部署

手动部署（本机构建 → 推到 1Panel 虚拟机）：

```bash
npm run build
tar -C docs/.vitepress/dist -czf /tmp/site.tar.gz .
scp /tmp/site.tar.gz root@10.0.0.123:/tmp/
ssh root@10.0.0.123 "rm -rf /opt/qixinbot-site/* && tar -C /opt/qixinbot-site -xzf /tmp/site.tar.gz"
```

站点由 1Panel 虚拟机（10.0.0.123）上的独立 OpenResty 容器托管（复用本机已有的
`1panel/openresty` 镜像——VM 拉不了 Docker Hub，见 `deploy/nginx.conf`）：

```bash
docker run -d --name qixinbot-site --restart unless-stopped \
  -p 8090:80 \
  -v /opt/qixinbot-site:/usr/share/nginx/html:ro \
  -v /opt/qixinbot-nginx.conf:/usr/local/openresty/nginx/conf/nginx.conf:ro \
  1panel/openresty:1.31.1.1-2-4-noble
```

更新时只需重传产物解压到 `/opt/qixinbot-site/`，不用动容器。

推送到 main 分支也会触发 `.gitea/workflows/deploy.yml` 自动构建部署
（需要 Gitea Actions runner 在线；secrets：`DEPLOY_SSH_KEY` / `DEPLOY_HOST` / `DEPLOY_PATH`）。

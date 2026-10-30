# QixinBot 官网

QixinBot 的官网与文档站，基于 [VitePress](https://vitepress.dev/zh/) 构建。

- 线上地址：http://10.0.0.123:8090（1Panel 虚拟机，nginx 容器）
- 仓库：http://10.0.0.140:30008/inoryxin/QixinBot-website

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

## 部署

手动部署（本机构建 → 推到 1Panel 虚拟机）：

```bash
npm run build
tar -C docs/.vitepress/dist -czf /tmp/site.tar.gz .
scp /tmp/site.tar.gz root@10.0.0.123:/tmp/
ssh root@10.0.0.123 "rm -rf /opt/qixinbot-site/* && tar -C /opt/qixinbot-site -xzf /tmp/site.tar.gz"
```

站点由 1Panel 虚拟机（10.0.0.123）上的 nginx 容器托管：

```bash
docker run -d --name qixinbot-site --restart unless-stopped \
  -p 8090:80 -v /opt/qixinbot-site:/usr/share/nginx/html:ro nginx:alpine
```

推送到 main 分支也会触发 `.gitea/workflows/deploy.yml` 自动构建部署
（需要 Gitea Actions runner 在线，secrets：`DEPLOY_SSH_KEY` / `DEPLOY_HOST` / `DEPLOY_PATH`）。

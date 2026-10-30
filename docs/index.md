---
layout: home

hero:
  name: QixinBot
  text: 插件即进程的机器人框架
  tagline: 基于 OneBot 11 —— 宿主用 Go，插件用任意语言。独立子进程，stdio + JSON-RPC，崩一个不带崩全家，2G 内存的小机器也能跑。
  image:
    src: /logo.png
    alt: QixinBot
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 下载 v1.0.0
      link: /download
    - theme: alt
      text: 写一个插件
      link: /guide/plugin-quickstart

features:
  - icon: 🛡️
    title: 极致稳定
    details: 插件独立进程 + 退避重启（1/2/4/8/16s，连续 6 次熔断）；挂死自愈：连续 5 次消息超时自动禁用。OneBot 连接 30s 心跳保活，对端假活秒级检出。
  - icon: 🧠
    title: 共享池省内存
    details: cohost 让纯 JS 插件共用一个 Node 进程（每插件一个 worker 线程），多池隔离、崩了自动逐出。实测 28 插件：1.0GB → ~430MB。
  - icon: 🔌
    title: 插件热插拔
    details: .anzu 包丢进 plugins/ 目录 2 秒自动安装，删掉自动卸载（数据保留）。qixinpack 一条命令从骨架到打包。
  - icon: 🧩
    title: 能力与工具系统
    details: capability 让插件之间互相调用、多提供者自动降级；tool 给 AI 插件暴露带 schema 校验的函数；设置页由 manifest 声明、控制台自动渲染。
  - icon: 🔐
    title: 签名与权限
    details: ed25519 签名插件包 + 三层信任，逐文件 sha256 校验；插件权限分级（read/write/admin/dangerous）、发送白名单、门禁审计。
  - icon: 📊
    title: WebUI 可观测
    details: 控制台 10 个板块，24h 指标趋势（消息 / 插件延迟 / 内存 / 队列深度），配置热重载，消息全链路 trace——一条消息卡在哪一步一眼可见。
---

<div class="vp-doc quickstart">

## 60 秒上手

不用装 Go，不用装 Node/Python——框架和插件解释器都由发布包自带。

```bash
# 1. 到 Releases 下载对应平台的框架包，解压到任意目录
#    http://10.0.0.140:30008/inoryxin/QixinBot-go/releases

# 2. 改 config.toml：填 OneBot 协议端地址和控制台密码
#    ws_url = "ws://127.0.0.1:3001"

# 3. 启动
./start.bat     # Windows
sh start.sh     # Linux

# 4. 浏览器打开 http://<这台机器>:7801 进控制台
```

**下一步**：[快速开始](/guide/getting-started) 完整走一遍部署，或直接 [15 分钟写一个插件](/guide/plugin-quickstart)。

</div>

<div class="vp-doc why">

## 为什么是"插件即进程"

传统机器人框架把插件塞进宿主进程：一个插件死循环，全家跟着卡；想用 Python 写插件，
框架就得先有 Python 插件系统。QixinBot 把边界画在进程上——

- **宿主**只做一件事：连协议端、分发消息、管插件生命周期，Go 单二进制；
- **插件**是普通进程，读 stdin 写 stdout 就是一个插件，Node.js、Python、乃至 shell 都行；
- **协议**是 JSON-RPC over stdio，SDK 替你封好了，不关心字节流细节；
- **崩溃隔离**是免费的：插件崩了退避重启，框架照常分发；框架挂了插件一起停，不留孤儿。

</div>

<style>
.quickstart, .why { margin-top: 64px; padding-top: 32px; border-top: 1px solid var(--vp-c-divider); }
</style>

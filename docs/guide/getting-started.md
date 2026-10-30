# 快速开始

> 目标：15 分钟内让 QixinBot 连上 QQ 并打开控制台。写插件直接看
> [插件开发：快速开始](/guide/plugin-quickstart)。

## 1. 下载并解压

到[下载页](/download)按平台下载**框架包**，解压到任意目录，例如 `C:\qixinbot` 或 `/opt/qixinbot`。

**不用装 Go、不用装 Node/Python**——框架和插件解释器都由发布包提供。解压后目录里有
`qixinbot`（或 `qixinbot.exe`）、`config.toml`、启动脚本和 SDK。

## 2. 改配置

打开根目录的 `config.toml`，至少改这两处：

```toml
[[accounts]]
id = "main"
ws_url = "ws://127.0.0.1:3001"    # 你的 OneBot 协议端地址
access_token = ""                 # 协议端配了令牌就填上，没配留空

[web]
addr = "0.0.0.0:7801"             # 控制台监听地址
password = "改个密码"              # 留空则每次启动生成临时密码，见 data/webui-password.txt
```

## 3. 准备协议端

QixinBot 本身不含 QQ 协议实现，需要配一个 OneBot 11 协议端。推荐
[SnowLuma](https://github.com/SnowLuma/SnowLuma)：在它里面开 OneBot 11 WebSocket
服务端（默认 3001），登录 QQ 后框架会自动连上并重连。

## 4. 启动

**Windows**（双击或命令行）：

```powershell
start.bat
```

**Linux**（`start.sh` 会自动补执行位）：

```bash
sh start.sh
```

日志里出现 `已连接上游`、`登录账号 self_id=...` 就是连上了。

## 5. 打开控制台

浏览器访问 `http://<这台机器>:7801`，用 `config.toml` 里的账号密码登录。
没设密码时，临时密码在 `data/webui-password.txt`。

控制台 10 个板块：概览 / 连接 / 权限 / 插件 / 共享池 / 依赖 / 指令 / 聊天 / 审计 / 日志。

## 6. 装运行时和插件

**运行时**（插件用 Node/Python 时必须）：控制台「依赖」页上传 `runtime-*.anzu`，
本机用不了的平台包会被拒绝。

**插件**：把 `.anzu` 丢进 `plugins/` 目录，2 秒内自动装好（默认未启用），
去「插件」页点「启用」；也可以在「插件」页直接上传。插件从哪来见[插件页](/plugins)。

## 7. 常用的几个开关

```toml
[plugin]
hot_reload = true                 # 投放区热插拔（丢包自动装）
allow_unsigned = true             # 开发时允许装未签名包（生产建议关掉）
cohost_enabled = false            # 关掉共享池（默认开，省内存）

[log]
level = "debug"                   # 排查时开 debug
gate_debug = true                 # 打印被门禁拦下的消息及原因
```

日志级别、发送限频、群白名单是热字段，改完 5 秒生效；账号和协议端地址改完要重启。

## 下一步

- [写一个插件](/guide/plugin-quickstart)——15 分钟从骨架到群里说话
- [部署](/reference/deploy)——systemd、开机自启等生产部署细节
- [运维参考](/reference/ops)——日志、备份、排障

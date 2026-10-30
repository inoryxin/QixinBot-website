# 下载

当前版本 **v1.0.0**（2026-10-30，首个开源版本）。所有包也可以到
[Gitea Releases](http://10.0.0.140:30008/inoryxin/QixinBot-go/releases) 页面手动下载。

## 框架包（必装）

解压到任意目录，例如 `C:\qixinbot` 或 `/opt/qixinbot`，改好 `config.toml` 即可启动。
**不用装 Go、不用装 Node/Python。**

| 包 | 说明 |
|---|---|
| [QixinBot-win-v1.0.0.zip](http://10.0.0.140:30008/inoryxin/QixinBot-go/releases/download/v1.0.0/1-QixinBot-win-v1.0.0.zip) | Windows 框架包：qixinbot.exe + SDK + 配置模板 + 启动脚本 |
| [QixinBot-linux-v1.0.0.zip](http://10.0.0.140:30008/inoryxin/QixinBot-go/releases/download/v1.0.0/2-QixinBot-linux-v1.0.0.zip) | Linux 框架包：同上 |

## 运行时包（插件用到 Node/Python 时必装）

自带 canvas / Pillow 等依赖，在控制台「依赖」页上传安装；本机用不了的平台包会被拒绝。

| 包 | 说明 |
|---|---|
| [runtime-node-windows-x64.anzu](http://10.0.0.140:30008/inoryxin/QixinBot-go/releases/download/v1.0.0/3-runtime-node-windows-x64.anzu) | Node.js 运行时（Windows） |
| [runtime-node-linux-x64.anzu](http://10.0.0.140:30008/inoryxin/QixinBot-go/releases/download/v1.0.0/4-runtime-node-linux-x64.anzu) | Node.js 运行时（Linux） |
| [runtime-python-windows-x64.anzu](http://10.0.0.140:30008/inoryxin/QixinBot-go/releases/download/v1.0.0/5-runtime-python-windows-x64.anzu) | Python 运行时（Windows） |
| [runtime-python-linux-x64.anzu](http://10.0.0.140:30008/inoryxin/QixinBot-go/releases/download/v1.0.0/6-runtime-python-linux-x64.anzu) | Python 运行时（Linux） |

## 开发工具包（只写插件才需要）

[qixinpack](/guide/plugin-quickstart)（打包 / 开发环境 / 端到端验收）+ mock-onebot（假协议端）。

| 包 | 说明 |
|---|---|
| [QixinBot-devtools-win-v1.0.0.zip](http://10.0.0.140:30008/inoryxin/QixinBot-go/releases/download/v1.0.0/7-QixinBot-devtools-win-v1.0.0.zip) | Windows 开发工具 |
| [QixinBot-devtools-linux-v1.0.0.zip](http://10.0.0.140:30008/inoryxin/QixinBot-go/releases/download/v1.0.0/8-QixinBot-devtools-linux-v1.0.0.zip) | Linux 开发工具 |

## 协议端推荐

QixinBot 本身不含 QQ 协议实现，需要配一个 OneBot 11 协议端。推荐
[SnowLuma](https://github.com/SnowLuma/SnowLuma)：在它里面开 OneBot 11 WebSocket 服务端
（默认 3001），登录 QQ 后框架会自动连上并重连。协议端配置见[快速开始](/guide/getting-started)。

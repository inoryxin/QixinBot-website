# 怎么部署 QixinBot

> 面向用发行包部署的用户（Windows / Linux x64）。全程约 15 分钟。

## 准备
| 需要 | 说明 |
|---|---|
| 框架发行包 | [Releases](/download) 下载 `1-QixinBot-win-v1.0.0.zip`（Windows）或 `2-QixinBot-linux-v1.0.0.zip`（Linux），解压（bin/ + sdk/ + config.toml + 启动脚本） |
| QQ 协议端 | 推荐 **SnowLuma**：https://github.com/SnowLuma/SnowLuma （OneBot 11 实现，Windows/Linux） |
| 运行时包 | 插件用 Node/Python 时，下载 Releases 里的 `3-6-runtime-*.anzu`（自带 canvas/Pillow 等常用库） |

**不用装**：Go（框架是编译好的二进制）、Node/Python（运行时包自带）、数据库。

## 第一步：改配置
发行包根目录的 `config.toml`，至少改两处：

```toml
[[accounts]]
id = "main"
ws_url = "ws://127.0.0.1:3001"    # 协议端的 OneBot WebSocket 地址
access_token = ""                 # 与协议端一致的 WS 令牌（没设就留空）

[web]
addr = "0.0.0.0:7801"             # 控制台监听地址
password = "改个密码"              # 不写则每次启动生成临时密码，见 data/webui-password.txt
```

改完保存。日志级别、发送限频、群白名单是热字段（改完 5 秒生效）；
账号、协议端地址改完需要重启。

## 第二步：启动
**Windows**：

```powershell
start.bat
```

**Linux**：

```bash
chmod +x start.sh bin/qixinbot
./start.sh
```

浏览器访问 `http://<这台机器>:7801`，用 `config.toml` 里的账号密码登录。
协议端登录 QQ 后，框架自动重连。

## 第三步：装运行时与插件
1. **运行时**：控制台「依赖」页上传 `runtime-*.anzu`（本机用不了的平台包会被拒绝）
2. **插件**：把 `.anzu` 丢进 `plugins/` 目录（2 秒自动装好），或控制台「插件」页上传；默认未启用，点「启用」
3. **共享池**（可选省内存）：控制台「共享池」页把声明了 `cohost = true` 的插件分入池中，
   新插件先进隔离观察期，稳定后转 shared

## 控制台（11 个板块）
| 板块 | 内容 |
|---|---|
| 概览 | 运行时长、运行时环境（Node/Python 是否就绪）、连接状态、插件状态、最近错误、24h 趋势 |
| 连接 | 改 OneBot 地址/令牌，保存后重启生效 |
| 权限 | 主人 QQ（框架级）、每个插件的 QQ/群白名单、前缀和 @ 限制、角色要求 |
| 插件 | 重载/启用/禁用/删除、优先级、上传 .anzu、设置备份恢复 |
| 共享池 | 池列表/成员/PID/内存、分池/逐出/人工恢复 |
| 依赖 | Node/Python 运行时包与插件依赖（pip/npm）安装 |
| 指令 | 控制 /help 里显示哪些插件和命令 |
| 聊天 | 看消息流、发消息、图片代理 |
| 审计 | 谁在什么时候、对哪个会话做了什么 |
| 日志 | 最近 1000 条、按级别过滤、2 秒刷新 |

另有隐藏页 `/tools`（不在导航）：全部 AI 工具清单、手动调用、后台任务表，给 AI 类插件排查用。

---

➡️ **下一步**：[运维参考](/reference/ops)（升级 / 内存优化 / 安全边界 / 备份恢复 / 自愈机制）

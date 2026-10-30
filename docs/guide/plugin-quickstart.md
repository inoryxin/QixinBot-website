# 插件开发：快速开始

> 目标：15 分钟写出一个能在群里说话的插件。深挖细节看 [插件开发手册](/guide/plugin-manual)（完整参考），
> 方法签名看 [API](/reference/api)。

## 0. 快速开始（从零到群里能用）

> 环境准备（要装什么、**不用装什么**）见 [0.1.0](#010-开发环境准备前置条件)；
> 第一次写插件，写完对着 [0.3 踩坑清单](#03-第一次写插件踩坑清单) 扫一遍能省大半返工。

```powershell
# 1. 生成骨架（目录随便放；骨架本身就能跑）
.\bin\qixinpack.exe new my-plugin -name 我的插件
cd my-plugin

# 2. 起本地"假 QQ"环境（不用连真 QQ）
..\bin\qixinpack.exe dev . -watch
#    浏览器打开 http://127.0.0.1:7801（admin / dev）
#    控制台 → 聊天 → 🧪 虚拟群 → 发 /my-plugin hello 有回音 = 环境就绪

# 3. 改 manifest.toml 和 app/index.js（保存 1 秒内自动重载，虚拟群直接测）

# 4. 测好了就打包（Ctrl+C 退出 dev）
..\bin\qixinpack.exe pack . -out my-plugin.anzu

# 5. 上服务器：把 my-plugin.anzu 放进服务器的 plugins\ 目录
#    （或 WebUI「插件」页上传）→ 热重载自动安装 → 管理员点「启用」→ 完事
```

生成的骨架：

```
my-plugin/
├── manifest.toml     # 常用字段都写了注释，用不到的注释掉就行
├── app/index.js      # 最小可运行：initialize / set_settings / handle_message
├── web/panel.html    # 可选扩展片段，不用可以删
└── README.md         # 插件自己的说明
```

**改完直接打包，热重载会自动重装并重启插件**——不用手动停启。

**写 `data/` 不会触发重载**：框架的目录指纹只算代码和清单文件
（`.js/.mjs/.ts/.py/.json/.toml` 等），并跳过 `data/`。
所以定时任务往 `data/` 存进度、写缓存，不会把插件自己重启掉。

**反过来**：别把需要持久的东西塞进 `app/`——那里一改就会重载。

**本地 dev 的完整玩法**（生产运行时、命令自动测试、端到端验证）在下一节。

---

## 0.1 开发流程：一条命令跑起来

### 0.1.0 开发环境准备（前置条件）

| 需要 | 说明 |
|---|---|
| **框架发行包** | 从 [Releases](/download) 下 `1-QixinBot-win` 或 `2-QixinBot-linux`，解压 |
| **开发工具包** | 同一个 Releases 页的 `7-QixinBot-devtools-win` / `8-QixinBot-devtools-linux`（`qixinpack` + `mock-onebot`）——**开发插件才需要**，解压后把两个二进制复制进框架包的 `bin/`（Linux 先 `chmod +x bin/*`） |
| **Node.js ≥ 18**（写 Node 插件） | 装系统 Node，**或**下载官方运行时包用 `-runtime` 挂载（推荐，见下文，和线上完全一致） |
| **Python 3.12**（写 Python 插件） | 同上 |
| **不用装 Go** | 插件开发完全不碰 Go——qixinpack 是编译好的成品。只有改框架本体才需要 |
| **不用连真 QQ** | mock-onebot 假协议端由 `dev` 自动拉起，虚拟群里测，随时注入消息 |

目录随便放：插件源码可以建在任何地方（`qixinpack new` 生成在哪就在哪开发），
发行包解压在哪都行——只要 `qixinpack`、`mock-onebot`、`qixinbot` 三个在同一个 `bin/` 里
（开发工具包解压后把两个二进制复制进框架包的 `bin/` 即可）。
唯一建议：**插件源码别放进发行包目录**，打包用 `pack -out` 指到发行包的 `plugins/`。

自检一行：

```powershell
.\bin\qixinpack.exe new demo -name 自检; cd demo; ..\bin\qixinpack.exe dev .
# 浏览器打开 http://127.0.0.1:7801（admin/dev），虚拟群发 /hello 有回音 = 环境就绪
```

### 三步

```powershell
# 1. 建骨架
.\bin\qixinpack.exe new my-plugin -name 我的插件

# 2. 写代码（app/index.js）

# 3. 起本地环境
cd my-plugin
..\bin\qixinpack.exe dev .
```

**`dev` 生成的临时配置里有两个开发专用开关**：

```toml
[plugin]
auto_enable = true    # 新装插件自动启用（生产默认 false）
sdk_dir = "<框架根>/sdk/node"   # 否则临时目录里找不到 _sdk
```

**`dev` 会自动做完这些**：

| 步骤 | 做了什么 |
|---|---|
| 1 | 把你的插件打成 `.anzu` 放进临时工作区 |
| 2 | 起一个假的 OneBot 协议端（`mock-onebot`） |
| 3 | 生成临时 `config.toml`（指向假协议端，管理员 `admin` / `dev`） |
| 4 | 起框架 |
| 5 | 等控制台就绪，打印地址 |

**输出**：

```
==> 打包 echo
输出: .dev-xxx/plugins/echo.anzu (1.2 KB)

==> 启动假协议端 :3001
mock OneBot 监听 127.0.0.1:3001（self=10000 group=123456）

==> 启动框架，控制台 http://127.0.0.1:7801 （admin / dev）

✅ 就绪
   控制台   http://127.0.0.1:7801  (admin / dev)
   虚拟群   控制台 → 聊天 → 🧪 虚拟群 → 发消息测插件
   插件包   .dev-xxx/plugins/echo.anzu

   Ctrl+C 退出
```

### 改完代码怎么办

**开 `-watch`，保存即生效**：

```powershell
qixinpack dev . -watch
```

```
[watch] 监听源码变动：dist\echo（保存即重载）

# 你改了 app/index.js 并保存
[watch] 检测到改动，重新打包…
输出: .dev-xxx/plugins/echo.anzu (1.2 KB, 2 个条目)
  [watch] 已重载，去虚拟群试试
```

**它监听什么**：`.js` `.mjs` `.cjs` `.ts` `.py` `.toml` `.json` `.html` 和 `manifest.toml`。

**跳过什么**：`data/` `deps/` `_sdk/` `node_modules/` `.git/`（这些变了不用重打包）。

**反馈时间**：保存 → 1 秒内重打包 → 自动重载 → 虚拟群直接测。

不开 `-watch` 的话，**Ctrl+C 重跑 `qixinpack dev .`** 也行，就是多等十几秒。

### 选项

```powershell
qixinpack dev . -web 7801 -ws 3001 -keep
```

| 选项 | 说明 |
|---|---|
| `-web <端口>` | 控制台端口，默认 7801（被占用时改这个） |
| `-ws <端口>` | 假协议端端口，默认 3001 |
| `-watch` | 监听源码变动，保存后自动重打包并重载 |
| `-runtime <包>` | 用指定运行时包启动（可重复，Node/Python 各一个） |
| `-keep` | 退出后保留临时目录（排查用） |

### 用生产运行时开发（推荐）

不要用本机的 Node/Python 裸环境开发，否则依赖版本和生产不一致。
下载 `runtime-node-windows-x64.anzu` / `runtime-python-*.anzu` 后：

```powershell
qixinpack dev . -runtime ..\runtimes\runtime-node-windows-x64.anzu
```

混合依赖就传两个：

```powershell
qixinpack dev . `
  -runtime ..\runtimes\runtime-node-windows-x64.anzu `
  -runtime ..\runtimes\runtime-python-windows-x64.anzu
```

效果：

- dev 环境和线上用同一个 Node/Python，同一个 `node_modules` / `Lib/site-packages`
- 插件里 `@napi-rs/canvas`、Pillow、numpy 等直接 import，版本和生产一致
- 运行时包第一次解压到缓存，之后直接复用，不会每次重装
- 不加 `-runtime` 才退回系统 PATH

运行时包从 Gitea Release 下载：

```
/download
```

### 完整的工具命令

```powershell
qixinpack new my-plugin -name 我的插件      # 生成骨架（app/ + manifest.toml）
qixinpack dev .                            # 起开发环境
qixinpack dev . -watch                     # 起环境 + 改代码自动重载
qixinpack dev . -runtime ..\runtimes\runtime-node-windows-x64.anzu  # 用生产运行时
qixinpack test .                           # 按 manifest 跑一遍命令
qixinpack verify -ask                      # 端到端验证（真实 WebSocket）
qixinpack pack . -out plugins/my.anzu      # 打包
qixinpack pack . -out plugins/my.anzu -key my.priv   # 打包并签名
qixinpack check plugins/my.anzu -pub my.pub          # 校验签名
qixinpack keygen -out my                   # 生成密钥对（my.priv / my.pub）
```

**`new` 生成的骨架**：

```
my-plugin/
├── manifest.toml      # 带一条示例命令和一个示例设置
├── app/
│   └── index.js       # 最小 echo 实现，直接能跑
├── web/
│   └── panel.html     # 设置页附加面板（空骨架）
└── README.md
```

**改完直接 `qixinpack dev .` 就能看到效果**——不用先理解所有字段。

### `qixinpack test`：自动跑一遍

```powershell
qixinpack test .
```

起临时环境，按 manifest 里声明的 `usage` 逐条发消息，检查插件有没有正确认领。

**输出**：

```
==> 测试插件 echo
输出: echo.anzu (1.2 KB, 2 个条目)

===== 测试结果 =====
✅ 命令 echo <文本>
   发送: "/echo 示例"（身份 owner）
   认领: echo
   回复1: 示例 / （你已 echo 1 次）

✅ 命令 ping
   发送: "/ping"
   认领: echo
   回复1: pong

✅ 无意义文本         认领: 无
✅ 空消息             认领: 无

===== 4 通过 / 0 失败 =====
```

**它测什么**：

| 场景 | 期望 |
|---|---|
| 每条 `usage` 生成的消息 | 插件认领 |
| 无意义文本 | 插件不认领（不抢消息） |
| 空消息 | 插件不认领 |

**它不测什么**：业务逻辑对不对、回复内容好不好。
那些得靠虚拟群手动验，或者给插件自己写单元测试。

**放进 CI**：

```yaml
- name: 插件自测
  run: qixinpack test dist/my-plugin
```

失败时退出码非 0，能直接卡住流水线。

**选项**：`-web` / `-ws` 换端口（默认 7811 / 3011），`-keep` 保留临时目录。

---

### `qixinpack verify`：走真实 WebSocket 的端到端验证

`dev` 和 `test` 用控制台注入，**测不出"时序"问题**。
`verify` 起真实协议端，能验证那些只有真链路才暴露的 bug。

```powershell
qixinpack verify -ask          # ask 等待时会不会堵住别的群
qixinpack verify -concurrency  # 两个群同时调同一个插件
qixinpack verify               # 全跑
```

**输出**：

```
==> 端到端验证（走真实 WebSocket）

[ask 等待时不堵其它群]
  ✅ 群 B 在 51ms 内响应，没有被 ask 堵住

===== 1 通过 / 0 失败 =====
```

**`-ask` 验的是什么**：

1. 群 A 发 `/bind`，插件进入 `host.ask` 等待
2. **群 B** 立刻发 `/vping`
3. 断言：群 B 在 3 秒内被处理

**失败说明什么**：插件读取循环被 `handleHostRequest` 卡住了——
`host.ask` 等待期间，同一个插件的其它调用全都超时。

**它的局限**：现在只覆盖两个场景（ask 非阻塞、多群响应）。
真正的压力测试（QPS、队列积压）还得靠线上监控。

### `dev` 环境里的权限

`config.toml` 是自动生成的，主人是 `10001`：

```toml
[owner]
users = [10001]
```

所以**虚拟群里选「主人」身份能触发所有插件**，选「纯路人」会被白名单拦。

### 和真实环境的区别

| | `qixinpack dev` | 生产 |
|---|---|---|
| 协议端 | `mock-onebot`（假的） | SnowLuma 等 |
| QQ | 没有真实连接 | 真实 |
| 数据 | 临时目录，退出即删 | `data/` |
| 控制台密码 | `admin` / `dev` | 自己配 |

**测完的东西不能直接当生产用**——临时目录会删，配置也是假的。

### 只想跑一次命令看效果

不用进 WebUI，直接让假协议端推一条：

```powershell
# 终端 1
.\bin\mock-onebot.exe -addr 127.0.0.1:3001 -text "/echo 你好"

# 终端 2
.\bin\qixinbot.exe -config dev.toml
```

`mock-onebot` 的参数：

```powershell
-addr     监听地址（默认 127.0.0.1:3001）
-self     机器人 QQ（默认 10000）
-group    群号（默认 123456）
-user     发送者 QQ（默认 20000）
-text     推送的消息文本
-interval 重复推送间隔（0 = 只推一次）
```

---

## 0.2 共享运行时宿主

默认每个插件一个独立进程（崩溃隔离最好，但每个进程一份运行时，
20+ 插件在 2G 内存服务器上很吃力）。manifest 里加一行：

```toml
cohost = true
```

这个插件还必须由管理员在 `/cohost` 页面**手动分配到一个池**，才会和其它成员共用
一个 Node 进程（每插件一个 worker 线程）。未分配、已逐出、池熔断时都走独立进程。
宿主开关默认开启；不想用就在 config.toml 写 `[plugin] cohost_enabled = false`。
组满或共享宿主故障时自动回退独占进程，插件不会因此起不来。

**必须知道的边界**：

| 事项 | 说明 |
|---|---|
| 只进纯 JS 插件 | 依赖运行时原生库（canvas 等）的插件不要声明 cohost |
| 崩溃域是 worker 级 | 未捕获异常/内存超限/死循环只死自己（框架自动重启该插件）；但 `process.kill(process.pid)`、原生 segfault 会带全组——生态已禁止原生依赖，纯 JS 世界可忽略 |
| 单插件逐出 | 同一插件 24h 内 worker 崩 3 次 → 踢出池，回独立；不自动回池，人工恢复；独立进程 24h 再崩 3 次 → 禁用 |
| 崩溃域不是安全边界 | 共享池只放**可信插件**：同组插件间没有安全隔离 |
| 环境约定 | 禁止 `process.chdir()`（全组共享 cwd）；`console.log` 已自动转 host.log；**别直写 `process.stdout`**（会污染协议通道，已由宿主收编为日志，但别依赖） |
| 设置热更新 | set_settings 照常收；worker 崩溃重启后框架自动用**最新设置**重初始化 |
| 熔断降级 | 某个池的共享进程 10 分钟内死 3 次 → 只熔断该池，成员回退独占；其它池不受影响 |

池上限在 `/cohost` 页面按池配置（默认 12；上限最大 64）。未配置的旧池上限回退
到 `[plugin] cohost_group_size`（默认 6）。组满或共享宿主不可用时自动回退独占进程。

## 0.3 第一次写插件：踩坑清单

这些坑都真实踩过。**发版前逐条对一遍**：

发版前逐条对一遍，能省掉大半返工：

- [ ] **能力参数 schema 写全**：`args` 里用到的每个字段都要在
      `[capability.parameters.properties.*]` 里声明，否则调用会被拒：
      `未知参数 "scope"（允许: [action content name]）`
- [ ] **共享数据先声明**：Node 用 `host.sharedSet`、Python 用 `host.shared_set`，key 必须出现在 `[[shared]]`，
      且写完整名 `<插件id>.<key>`
- [ ] **设置项 type 别写错**：`bool`/`boolean` 都行，其它只认
      `string|text|textarea|bool|boolean|number|select|password|path`；写错会退化成文本框并打 warn
- [ ] **下拉框给中文**：`options` + `option_labels`
- [ ] **消息要全量看到就开 `observe`**：`last = true` 的兜底插件收不到
      被别的插件认领的消息
- [ ] **定时自己管**：用 `setInterval` / `setTimeout`
- [ ] **改插件 id 前先备份 `data/`**：设置和存储都在
      `data/plugins/<id>/data/`；删插件时框架会把它移到
      `data/removed-plugins/<id>-<时间戳>/data/`，但**重装不会自动恢复**
- [ ] **改名后检查 `[[requires]]`**：别的插件里写的 value 也要跟着改，
      否则启动时报"缺少依赖"
- [ ] **命令 id 全局唯一**：不同插件的命令 id 撞了会报
      「feature 冲突」，表现是其中一个插件起不来
- [ ] **命令和内置命令别重名**（`/help`、`/plugins`）
- [ ] **高频路径别刷日志**：`host.log('debug', ...)` 会进缓冲区
- [ ] **初始化别覆盖已保存状态**：先 `host.storage.get`，只有不存在时才写默认
- [ ] **共享数据重启/重载不会丢**：`[[shared]]` 值只有删除插件才清；不要把 per-chat 数据覆盖成全局对象
- [ ] **定时器/子进程在 shutdown 里清理**：否则重载会留孤儿

## 1. 一个插件是什么

一个 `.anzu` 包 + 一份 `manifest.toml` + 一组约定。

### 包里的目录（就这五个，别加别的）

```
weather.anzu
├── manifest.toml      声明：id、版本、命令、工具、设置、权限
├── app/               代码（index.js / 二进制）
├── assets/            素材（图片、音频、视频、字体、模板…）
├── deps/              依赖（统一目录，见下）
├── web/               设置页（可选，独立的 panel.html）
└── META-INF/          签名（可选，打包工具生成）
```

**`assets/` 内部再分子目录**：

```
assets/
├── img/               图片（标准，不用声明）
├── audio/             音频（标准）
├── video/             视频（标准）
├── fonts/             字体（标准，canvas 会自动注册）
└── 自定义/            别的子目录要在 manifest 里声明（见 §6.10）
```

### 解压后的运行区

```
data/plugins/weather/
├── app/               代码
├── assets/            素材
├── deps/              依赖
├── web/               设置页
├── data/              运行时数据（升级不动）
├── _sdk/              框架注入的适配器
├── install.json       安装元信息
└── manifest.toml
```

### 各目录的职责（不能混）

| 目录 | 谁写 | 升级时 | 备份 |
|---|---|---|---|
| `app/` | 打包者 | 整体替换 | 不必 |
| `assets/` | 打包者 | 整体替换 | 不必 |
| `deps/` | 打包者 | 整体替换 | 不必 |
| `web/` | 打包者 | 整体替换 | 不必 |
| `data/` | 插件自己 | **保留** | 必须 |

**记住一条**：只要你写的东西是「用户产生的」，就放 `data/`；是「你带进去的」，放前四个。

### `deps/` 怎么组织（Node / Python 通用）

```
deps/
├── node_modules/      Node 包（npm install 到这里）
├── python/            Python 包（pip install -t 到这里）
├── bin/               可执行文件（自动加进 PATH 末尾）
└── vendor/            内联的第三方源码（自己 import）
```

框架启动插件时自动注入：

| 目录 | 环境变量 |
|---|---|
| `deps/node_modules` | `NODE_PATH` |
| `deps/python` | `PYTHONPATH` |
| `deps/bin` | `PATH` 末尾 |

**所以 Node 和 Python 用同一套目录约定**，只是子目录不同。平台原生依赖不要放这里，见 6.1e。

```bash
# Node（只装纯 JS；--prefix deps 会生成 deps/node_modules）
npm install --omit=dev --prefix deps <包名>

# Python（只装 py3-none-any 纯 Python 包）
pip install --target deps/python --only-binary=:all: <包名>
```

---

---

## 下一步

- **某类插件的完整写法**：[插件开发手册](/guide/plugin-manual)——manifest 全字段（§2）、设置页（§3）、命令（§4）、
  工具（§5）、权限（§6）、能力（§6.1）、依赖（§6.1d-e）、并发（§6.20）、签名发布（§11）
- **方法签名**：[API](/reference/api)
- **踩坑先查**：上面的踩坑清单 + 手册 §13 反模式
- **包格式**：ANZU（.anzu 的结构与签名，见手册 §11）

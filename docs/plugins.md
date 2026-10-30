---
outline: false
pageClass: plugin-store-page
---

# 插件

QixinBot 的插件目录：官方插件经过审核与长期稳定性验证；第三方插件由作者自己签名，
收录前经人工审核，但**官方不对第三方的稳定性与安全性负责**，安装时请核对签名指纹。

<PluginStore />

## 安装方式

把 `.anzu` 包丢进框架目录的 `plugins/`，2 秒内自动装好（默认未启用，去控制台「插件」页点「启用」）；
也可以在控制台「插件」页直接上传。签名包开箱可装——框架会逐文件校验
ed25519 签名，第三方包的公钥随包内置。

## 提交你的插件

想让你的插件出现在这个目录？到[插件仓库发一个收录申请](repo://QixinBot-go-plugins/issues/new?template=plugin-submission.yml)，附上：

- 中文名、插件 ID、一句话简介
- 源码仓库地址、`.anzu` 下载直链
- **签名公钥或指纹**（ed25519，`qixinpack keygen` 生成的 `*.pub`）

::: warning 只收公钥，不收私钥
私钥留在你自己手里。我们审核通过后把插件加入目录；此后你的每次发版，签名都会
被框架在安装时校验。
:::

审核要点：装得上跑得通、manifest 权限声明与实际行为一致、无凭据外发等恶意行为。

## 官方插件源码

官方插件的源码、签名产物和开发手册都在
[QixinBot-go-plugins](repo://QixinBot-go-plugins) 仓库维护；想自己写一个，
从[插件开发：快速开始](/guide/plugin-quickstart)开始，15 分钟能跑通。

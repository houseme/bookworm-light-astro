---
title: "我们正式官宣啦！正式发布 RustFS Beta 版"
description: "历经 2850+ 次 Git 提交，99 个 alpha 版本，我们正式发布 RustFS Beta 版"
date: 2026-04-29T05:00:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-da-na-461418424-31359488.jpg-slimming.webp"
categories: ["rust","对象存储","rustfs"]
authors: ["houseme"]
tags: ["rust", "rustfs","对象存储","分布式系统","AI 时代","高性能存储","安全存储","云原生存储","S3 兼容","Beta 发布"]
keywords: "rust,rustfs,对象存储,分布式系统,AI 时代,高性能存储,安全存储,云原生存储,S3 兼容,Beta 发布"
draft: false
---

历经 2850+ 次 Git 提交，99 个 alpha 版本，我们正式发布 RustFS Beta 版。

自从 2025 年 7 月正式开源以来，RustFS 累计获得 26.5k star，1.1k fork，全球贡献者数量超 130 位，DockerHub 镜像拉取次数更是超过 220 万，曾 8 次霸榜 GitHub Trending，40+ 次霸榜 GitHub Rust Trending，让 RustFS 成为世界上增长最快的开源对象存储系统。在所有贡献者、用户、客户的共同努力下，我们决定将 RustFS 从 Alpha 转向 Beta。

RustFS beta 版本的发布对我们来说是一个重大的里程碑，这意味着我们在构建一个高性能、高可靠、高安全分布式对象存储系统的旅途上前进了一大步。

# 为什么选择 RustFS

众所周知，对象存储领域的顶级开源项目 MinIO 在历经多次重大变更（如将许可证修改为严苛的 AGPL、移除核心管理功能、停止直接的二进制分发等）后，其开源策略的转变让全球数以百万计的开发者开始寻找一个真正的、商业友好的开源平替。

此外，在 AI 时代，对象存储已不仅是冷存储，更是大模型训练与推理的关键基础设施。传统的 IO 架构难以支撑 GPU 集群间的高速数据吞吐。我们坚信，**通过 RustFS + RDMA 协议的深度融合，能够彻底消除性能瓶颈，使对象存储成为 AI 时代数据中心的新标准**。

RustFS 充分利用了 Rust 语言天然的内存安全与高性能优势，并坚持以商业友好的 Apache 2.0 协议开源。这不仅赋予了企业级用户最高限度的自由度，也让 RustFS 成为了全球增长最快的开源对象存储项目之一。

# Beta 版的核心功能

RustFS Beta 包含了一系列企业级的功能：

* S3 兼容：完整的对象存储生命周期管理，且可无缝集成任何支持 S3 的系统；
* 安全优先：内置了 mTLS、KMS、OIDC 以及安全审计等安全功能；
* 高可用：分布式集群管理、节点自愈以及节点再平衡等支持；
*
## 存储

* 存储桶/对象全生命周期管理
* 对象版本/对象锁
* 分布式纠删码（EC）
* 分片上传
* 校验和与完整性验证

## 安全

* IAM 用户/群组/策略/服务账号
* OIDC
* KMS 服务 SSE-S3、SSE-KMS 以及 SSE-CSTS
* mTLS
* 安全审计
## 运维 & 可观测性

* 事件通知
* OTEL
* 容量统计
* 集群节点健康监测
* rc（rustfs client command line）
* MinIO 无缝切换

## 协议

* S3
* WebDAV
* Swift API
* FTP(s)

## 高可用

* 分布式部署（多机多盘）
* 节点自愈/扩容/退役/再平衡

## 云原生支持

* Helm Chart
* Operator

## AI

* MCP Server

## Beta 版本的安装和使用

RustFS 支持多种操作系统（Linux、macOS 以及 Windows）、多种安装方式（二进制、Docker、Helm chart 以及 Operator）。以 Linux 系统为例：

* 二进制安装

运行如下命令即可

```
curl -O https://rustfs.com/install_rustfs.sh && bash install_rustfs.sh
```

* Docker 安装

```
$ docker pull rustfs/rustfs:latest
$ docker run -d \
  --name rustfs \
  -p 9000:9000 \
  -p 9001:9001 \
  -v /data:/data \
  rustfs/rustfs:latest
```

* Helm 安装

```
# 添加 Helm 仓库
helm repo add rustfs https://charts.rustfs.com

# 安装 RustFS
helm install my-rustfs rustfs/rustfs --version v1.0.0-beta.1
```

详细安装指南，可查看官网文档。

## 我们的下一步计划

Beta 的发布对我们来说是一个重要里程碑。接下来我们将在性能优化、安全加固、企业级高可用等方面持续迭代，让 RustFS 变得更加稳定可靠。为我们 7 月份正式发布 GA 持续努力。

RustFS 的成功离不开所有参与者的努力贡献，未来的旅途中，我们希望和所有开发者、用户、客户一起持续打磨 RustFS。欢迎大家使用 RustFS，在使用过程中有任何问题，都可以通过我们的 GitHub Issue 向我们反馈。当然，也欢迎大家 Star，提交 PR。

* RustFS GitHub Repo: https://github.com/rustfs/rustfs
* RustFS client GitHub Repo: https://github.com/rustfs/cli

## RustFS 开源图谱

| 开源项目 | 仓库地址 |
| ---- | ---- |
| RustFS 主仓库 | https://github.com/rustfs/rustfs |
| RustFS console | https://github.com/rustfs/console |
| RustFS client | https://github.com/rustfs/cli |
| RustFS operator | https://github.com/rustfs/operator |
| RustFS MCP Server | https://github.com/rustfs/mcp |
| RustFS 文档 | https://github.com/rustfs/docs.rustfs.com |

---
title: "🦀 二进制替换：一步完成 MinIO 到 RustFS 的平滑迁移"
description: "今天，我们激动地宣布 RustFS 在最新版本（`1.0.0-alpha.87`）中引入了一项关键功能：用户现在可以通过直接二进制替换的方式，从 MinIO 迁移到 RustFS。"
date: 2026-03-20T18:00:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-punttim-633685.jpg-slimming.webp"
categories: ["Rust","RustFS"]
authors: ["RustFS Team"]
tags: ["Rust","MinIO迁移","RustFS替代方案","二进制替换","数据迁移","分布式存储","对象存储","安全更新","成本节约","无缝集成","MinIO开源归档","MinIO安全风险","RustFS特性","S3兼容","迁移收益","迁移步骤","二进制安装迁移","Docker安装迁移","支持迁移项","不支持迁移项","RustFS路线图"]
keywords: "rust,MinIO迁移,RustFS替代方案,二进制替换,数据迁移,分布式存储,对象存储,安全更新,成本节约,无缝集成"
draft: false
---

# MinIO 后路被抄！二进制替换，一步完成 MinIO 到 RustFS 切换

你可能见过类系统间的迁移转换，但是你肯定没见过 MinIO 到 RustFS 的迁移转换。

RustFS 最新版本发布重大功能 —— **RustFS 全面兼容 MinIO**，直接二进制替换即可完成 MinIO 到 RustFS 的华丽转身。

## RustFS 为什么这么做

众所周知，MinIO 从修改许可证到停止二进制分发再到今年 2 月份彻底归档开源仓库，正式宣告 MinIO 完全走向闭源。但是全球有超 **2000 万** MinIO 实例在运行着 MinIO 的开源版本。仓库归档也就意味着这些实例再也无法获取版本更新，无法获得安全保障，随着时间增加，实例所面临的安全风险就越大。

为了让 MinIO 用户平滑切换至 RustFS，团队深入分析 MinIO 的数据结构后，设计并实现了**二进制直接替换**的切换方案。此方案能够让用户：

- **省钱**：原地转换 MinIO 存储，节省购买新存储服务器的成本。对于数据量在数百 TB 甚至 PB 级别的用户来讲，这是一笔巨大的开销。
- **省心**：再也不用担心 MinIO 开源归档带来的安全风险以及功能停滞；
- **省时**：无需走传统切换的三步曲：准备新环境，开始切换，释放老环境，为用户节省大量时间；
- **省力**：无需设计复杂的迁移流程，让迁移转换更简单。

## 转换指南

目前 MinIO 到 RustFS 之间的转换支持**二进制安装替换**和 **Docker 安装替换**。

- **二进制安装**

对于二进制安装的 MinIO 实例，可直接下载 RustFS 的二进制（根据不同 OS 下载正确的二进制），然后将 MinIO 的二进制直接替换为 RustFS 的二进制即可。

比如用如下命令启动的 MinIO 实例：

```
minio server /data/minio --console-address ":9001"
```

可以通过如下方式，直接替换为 RustFS 实例：

```
# 下载 RustFS 二进制
curl -O https://github.com/rustfs/rustfs/releases/download/1.0.0-alpha.86/rustfs-linux-x86_64-gnu-latest.zip
unzip rustfs-linux-x86_64-gnu-latest.zip
chmod +x rustfs

# 启动 RustFS 实例
./rustfs /data/minio --address ":9000" --console-enable --console-address ":9001" --access-key "rustfsadmin" --secret-key "rustfsadmin"
```

登录 RustFS 实例确认数据即可。

> **注意**：由于 MinIO 和 RustFS 的参数有差异，需要根据 MinIO 实际情况进行配置切换。

- **Docker 安装替换**

对于通过 Docker 安装的 MinIO 实例，可以将 MinIO 容器镜像替换为 RustFS 容器镜像，并修改相应的环境变量即可完成替换。

比如，您的 MinIO 实例是通过如下 `docker-compose.yml` 进行安装的：

```yaml
services:
  MinIO:
    hostname: MinIO
    image: MinIO/MinIO:RELEASE.2025-04-22T22-12-26Z
    command: server --console-address ":9001" /data{1...4}
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MinIO_ROOT_USER: MinIOadmin
      MinIO_ROOT_PASSWORD: MinIOadmin
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5
    volumes:
      - data1:/data1
      - data2:/data2
      - data3:/data3
      - data4:/data4
    networks:
      - MinIO-rustfs

volumes:
  data1:
  data2:
  data3:
  data4:

networks:
  MinIO-rustfs:
    driver: bridge
```

先用 `docker compose down` 命令停止 MinIO 实例，然后修改 `docker-compose.yml` 文件：

```yaml
services:
  rustfs:
    image: rustfs/rustfs:1.0.0-alpha.87
    container_name: rustfs
    hostname: rustfs
    environment:
      - RUSTFS_VOLUMES=/data{1...4}
      - RUSTFS_ADDRESS=0.0.0.0:9000
      - RUSTFS_CONSOLE_ENABLE=true
      - RUSTFS_CONSOLE_ADDRESS=0.0.0.0:9001
      - RUSTFS_ACCESS_KEY=rustfsadmin
      - RUSTFS_SECRET_KEY=rustfsadmin
    ports:
      - "9000:9000"  # API endpoint
      - "9001:9001"  # Console
    volumes:
      - data1:/data1
      - data2:/data2
      - data3:/data3
      - data4:/data4
    networks:
      - MinIO-rustfs

networks:
  rustfs:
    driver: bridge
    name: MinIO-rustfs

volumes:
  data1:
  data2:
  data3:
  data4:
```

接着执行 `docker compose up -d` 命令启动 RustFS 实例，并使用之前 MinIO 的访问地址进行登录检查。

> **注意**：转换之前需要了解 MinIO 和 RustFS 的配置差异，以确保转换过程的数据安全性和成功率。

## 支持转换的功能

由于 MinIO 和 RustFS 之间的数据差异，目前 RustFS 支持直接转换的功能包括：

1. 桶的元数据
2. 对象（标签、对象锁定、版本控制）
3. 桶复制
4. IAM（需要再确认一下）
5. 生命周期管理
6. 分层管理

暂**不支持**的功能包括：

1. 站点复制
2. 事件通知
3. MinIO 在线配置文件配置
4. LDAP & OIDC

如果你在转换过程中遇到任何问题可以在 RustFS GitHub Repo 上提 issue。

- GitHub Repo: https://github.com/rustfs/rustfs

## RustFS 接下来要做什么

目前 RustFS 的版本路线图是：

- **发布 Beta**：我们计划在 **4 月份**正式发布 Beta 版，标志着 RustFS 核心功能已经成熟稳定。
- **正式 GA**：我们计划在 **7 月份**正式发布 GA 版本，标志着 RustFS 可以大规模用于生产实践。

RustFS 在 AI 时代的路线图：

- 我们将深度支持 RDMA、DPU 等，争取成为 AI 时代数据中心的数据存储关键节点。

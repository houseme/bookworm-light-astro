---
title: "🦀 OpenRaft 实战：从零构建高可用分布式 KV 存储集群"
description: "基于 OpenRaft 异步共识引擎，手把手教你实现分布式键值存储。涵盖 Raft 核心原理、领导者选举、日志复制与快照机制，支持动态成员变更与线性读，助你掌握生产级分布式系统的构建与优化技巧。"
date: 2026-03-04T08:32:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-vozradui-12298427.jpg-slimming.webp"
categories: ["Rust", "工具链", "Cargo", "分布式系统", "系统设计", "实战指南", "架构设计", "Raft", "OpenRaft","Raft 实战"]
authors: ["houseme"]
tags: ["Rust","工具链","Cargo","分布式系统","系统设计","实战指南","架构设计","Raft","OpenRaft","分布式共识算法","日志复制","状态机","快照机制","动态成员变更","线性读"]
keywords: "rust,工具链,Cargo,数据库,存储引擎,性能优化,系统设计,实战指南,架构设计,Raft,OpenRaft,分布式共识算法,日志复制,状态机,快照机制,动态成员变更,线性读"
draft: false
---


## OpenRaft 实战指南：从入门到构建分布式 KV 存储

### 引言与背景

Raft 算法是一种分布式共识协议，旨在管理复制日志以实现分布式系统中的一致性。它将复杂的问题分解为领导者选举、日志复制和安全性等子模块，使其比 Paxos 更易理解和实现。Raft 广泛应用于分布式数据库、配置管理和服务发现等领域，如 etcd、TiKV 和 Consul。在实际生产环境中，日志无限增长会导致存储膨胀和恢复缓慢，因此需要快照机制等优化。

OpenRaft 是 Rust 生态中一个先进的 Raft 实现，由 Databend Labs 维护，基于 Tokio 的异步模型构建。它改进了原 async-raft 项目，修复了 bug 并添加了增强功能，如事件驱动、无需周期性 tick 的设计，支持自定义存储和网络层。OpenRaft 适用于分布式数据存储系统（如 SQL/NoSQL/KV/Streaming/Graph），并作为 Databend 的元服务共识引擎。相比其他 Rust Raft 库（如 raft-rs），OpenRaft 强调高吞吐量、扩展性和易用性，支持动态成员变更、非投票者（learner）角色和线性读等特性。

本指南从入门开始，结合 OpenRaft 进行实战，逐步构建一个分布式 KV 存储集群。假设读者有 Rust 基础，我们将覆盖安装、核心概念实现、网络/存储自定义、集群部署和高级主题。通过示例代码（基于官方 raft-kv-memstore），读者可快速上手。

### 第一部分：入门准备

#### 1.1 安装 OpenRaft

OpenRaft 通过 crates.io 安装。添加依赖到 `Cargo.toml`：

```toml
[dependencies]
openraft = "0.9.16"  # 使用最新稳定版，检查 crates.io 以确认
tokio = { version = "1", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
anyhow = "1.0"
tracing = "0.1"
```

运行 `cargo build` 安装。OpenRaft 支持特征标志（如 `serde` 用于序列化），详见文档。

#### 1.2 核心概念回顾

OpenRaft 实现 Raft 的两大核心：
- **日志复制**：领导者（Leader）追加日志并复制到跟随者（Follower）。
- **状态机消费**：应用 committed 日志到状态机。

构建应用需定义：
- 客户端请求/响应（AppData 和 AppDataResponse）。
- 类型配置（RaftTypeConfig）。
- 存储（RaftLogStorage 和 RaftStateMachine）。
- 网络（RaftNetwork 和 RaftNetworkFactory）。

OpenRaft 使用泛型，确保类型安全。

### 第二部分：定义应用类型

定义请求和响应。对于 KV 存储，请求是设置键值，响应是获取结果：

```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Request {
    pub key: String,
    pub value: Option<String>,  // None 表示删除
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Response(pub Result<Option<String>, anyhow::Error>);
```

实现 AppData 和 AppDataResponse（OpenRaft 提供默认，如果类型实现 Clone/Serialize/Deserialize 等）。

然后定义 RaftTypeConfig：

```rust
use openraft::{BasicNode, Entry, RaftTypeConfig, TokioRuntime};

pub struct TypeConfig {}

impl RaftTypeConfig for TypeConfig {
    type D = Request;  // AppData
    type R = Response;  // AppDataResponse
    type NodeId = u64;
    type Node = BasicNode;  // 默认节点类型，包含地址
    type Entry = Entry<Self>;
    type SnapshotData = std::io::Cursor<Vec<u8>>;  // 快照数据流
    type AsyncRuntime = TokioRuntime;
}
```

这配置了 Raft 实例的类型。

### 第三部分：实现存储层

存储分两部分：日志存储（RaftLogStorage）和状态机（RaftStateMachine）。我们用内存实现（基于 raft-kv-memstore 示例）。

#### 3.1 RaftLogStorage

存储日志、投票和日志状态。需实现方法如 append、truncate、purge、save_vote 等。

示例内存实现（简化版）：

```rust
use openraft::{async_trait::async_trait, storage::{LogState, RaftLogStorage, RaftLogReader}};
use std::collections::BTreeMap;
use tokio::sync::Mutex;

pub struct MemLogStore {
    logs: Mutex<BTreeMap<u64, <TypeConfig as RaftTypeConfig>::Entry>>,
    vote: Mutex<Option<<TypeConfig as RaftTypeConfig>::NodeId>>,
    // ... 其他字段如 purged, last_log_id
}

#[async_trait]
impl RaftLogStorage<TypeConfig> for MemLogStore {
    type LogReader = Self;

    async fn get_log_state(&mut self) -> anyhow::Result<LogState<TypeConfig>> {
        // 返回 first/last log id
        Ok(LogState {
            last_purged_log_id: None,  // 示例
            last_log_id: Some(openraft::LogId { term: 1, index: self.logs.lock().await.len() as u64 }),
        })
    }

    async fn get_log_reader(&mut self) -> Self::LogReader {
        self.clone()
    }

    async fn append(&mut self, entries: &[ <TypeConfig as RaftTypeConfig>::Entry ]) -> anyhow::Result<()> {
        let mut logs = self.logs.lock().await;
        for entry in entries {
            logs.insert(entry.log_id.index, entry.clone());
        }
        Ok(())
    }

    // 实现 truncate, purge, save_vote, read_vote 等类似
}

#[async_trait]
impl RaftLogReader<TypeConfig> for MemLogStore {
    async fn try_get_log_entries<RB: std::ops::RangeBounds<u64> + Clone + std::fmt::Debug + Send + Sync>(
        &mut self,
        range: RB,
    ) -> anyhow::Result<Vec<<TypeConfig as RaftTypeConfig>::Entry>> {
        // 从 BTreeMap 获取范围日志
        let logs = self.logs.lock().await;
        Ok(logs.range(range).map(|(_, e)| e.clone()).collect())
    }
}
```

#### 3.2 RaftStateMachine

管理状态机应用日志、快照。需实现 apply、build_snapshot 等。

示例 KV 状态机：

```rust
use openraft::{storage::{RaftStateMachine, RaftSnapshotBuilder, Snapshot}, EntryPayload};
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct MemStateMachine {
    data: RwLock<HashMap<String, String>>,
    last_applied: RwLock<Option<openraft::LogId<u64>>>,
    // ... 快照相关
}

#[async_trait]
impl RaftStateMachine<TypeConfig> for MemStateMachine {
    type SnapshotBuilder = Self;

    async fn applied_state(&mut self) -> anyhow::Result<(Option<openraft::LogId<u64>>, openraft::EffectiveMembership<TypeConfig>)> {
        Ok(( *self.last_applied.read().await, openraft::EffectiveMembership::default() ))  // 示例
    }

    async fn apply(&mut self, entries: &[ <TypeConfig as RaftTypeConfig>::Entry ]) -> anyhow::Result<Vec<<TypeConfig as RaftTypeConfig>::R>> {
        let mut data = self.data.write().await;
        let mut res = Vec::new();
        for entry in entries {
            if let EntryPayload::Normal(req) = &entry.payload {
                if let Some(val) = &req.value {
                    data.insert(req.key.clone(), val.clone());
                    res.push(Response(Ok(Some(val.clone()))));
                } else {
                    res.push(Response(Ok(data.remove(&req.key))));
                }
            }
            *self.last_applied.write().await = Some(entry.log_id);
        }
        Ok(res)
    }

    async fn get_snapshot_builder(&mut self) -> Self::SnapshotBuilder {
        self.clone()
    }

    // 实现 begin_receiving_snapshot, install_snapshot, get_current_snapshot
}

#[async_trait]
impl RaftSnapshotBuilder<TypeConfig> for MemStateMachine {
    async fn build_snapshot(&mut self) -> anyhow::Result<Snapshot<TypeConfig>> {
        let data = self.data.read().await;
        let serialized = bincode::serialize(&*data)?;  // 需要 bincode 依赖
        let last_applied = *self.last_applied.read().await;
        Ok(Snapshot {
            meta: openraft::storage::SnapshotMeta {
                last_log_id: last_applied,
                // ... 其他 meta
            },
            data: std::io::Cursor::new(serialized),
        })
    }
}
```

这些方法确保日志持久化和状态机一致。使用官方测试套件（openraft::testing::Suite）验证实现。

### 第四部分：实现网络层

网络负责节点间通信。实现 RaftNetwork（发送 RPC）和 RaftNetworkFactory（创建连接）。

#### 4.1 RaftNetwork

使用 reqwest 发送 AppendEntries、Vote 和 Snapshot。

示例：

```rust
use openraft::{network::{RaftNetwork, AppendEntriesRequest, VoteRequest, InstallSnapshotRequest}, raft::Raft};
use reqwest::Client;

pub struct Network {
    target_addr: String,
    client: Client,
}

#[async_trait]
impl RaftNetwork<TypeConfig> for Network {
    async fn append_entries(&mut self, req: AppendEntriesRequest<TypeConfig>) -> anyhow::Result<<TypeConfig as RaftTypeConfig>::AppendEntriesResponse> {
        let res = self.client.post(format!("{}/raft/append", self.target_addr))
            .json(&req)
            .send()
            .await?
            .json()
            .await?;
        Ok(res)
    }

    async fn vote(&mut self, req: VoteRequest<<TypeConfig as RaftTypeConfig>::NodeId>) -> anyhow::Result<openraft::VoteResponse<<TypeConfig as RaftTypeConfig>::NodeId>> {
        // 类似 post 到 /raft/vote
        unimplemented!()
    }

    async fn full_snapshot(&mut self, req: InstallSnapshotRequest<TypeConfig>) -> anyhow::Result<openraft::InstallSnapshotResponse<<TypeConfig as RaftTypeConfig>::NodeId>> {
        // post 到 /raft/snapshot
        unimplemented!()
    }
}
```

#### 4.2 RaftNetworkFactory

创建 Network 实例：

```rust
pub struct NetworkFactory;

#[async_trait]
impl openraft::network::RaftNetworkFactory<TypeConfig> for NetworkFactory {
    type Network = Network;

    async fn new_client(&mut self, target: u64, node: &<TypeConfig as RaftTypeConfig>::Node) -> Self::Network {
        Network {
            target_addr: node.addr.clone(),  // 假设 BasicNode 有 addr 字段
            client: Client::new(),
        }
    }
}
```

#### 4.3 服务端处理

使用 axum 或 tonic 处理传入 RPC，转发到 Raft 实例：

```rust
use axum::{routing::post, Router};
use std::sync::Arc;

async fn handle_append(req: axum::Json<AppendEntriesRequest<TypeConfig>>, raft: Arc<Raft<TypeConfig, NetworkFactory, MemLogStore, MemStateMachine>>) -> axum::Json<<TypeConfig as RaftTypeConfig>::AppendEntriesResponse> {
    axum::Json(raft.append_entries(req.0).await.unwrap())
}

// 在 main 中设置 Router
let app = Router::new()
    .route("/raft/append", post(|req| handle_append(req, raft.clone())));
```

对于 gRPC，可参考 Databend-meta。

### 第五部分：构建 Raft 实例与集群

#### 5.1 创建 Raft

```rust
use openraft::{Config, Raft};

let config = Config {
    cluster_name: "kv_cluster".to_string(),
    heartbeat_interval: 500,
    election_timeout_min: 1500,
    election_timeout_max: 3000,
    // ... 默认值
}.validate().unwrap();

let log_store = MemLogStore::new();
let sm = MemStateMachine::new();
let network = NetworkFactory;

let raft = Raft::new(1, // node id
    Arc::new(config),
    network,
    log_store,
    sm
).await.unwrap();
```

#### 5.2 集群形成

OpenRaft 支持动态成员：
- 初始化：使用 `raft.initialize(vec![(node_id, node)])` 形成初始集群。
- 添加节点：`raft.add_learner(node_id, node, blocking)`。
- 变更成员：`raft.change_membership(change, retain)` 支持联合共识（joint consensus）无中断变更。

实战：运行 3 节点集群（使用 tokio spawn）：

```rust
// 在 main 中
for id in 1..=3 {
    tokio::spawn(async move {
        // 创建 raft 实例，监听端口如 21000 + id
        // 初始化集群如果 id==1
        if id == 1 {
            raft.initialize(vec![(1, BasicNode { addr: "localhost:21001".to_string() }), /* 其他 */]).await.unwrap();
        }
    });
}
```

#### 5.3 客户端交互

提案日志：`raft.client_write(Request { key: "foo".to_string(), value: Some("bar".to_string()) }).await`。

线性读：`raft.ensure_linearizable().await; // 然后查询状态机`。

### 第六部分：高级主题与优化

- **快照**：自动或手动触发（`raft.trigger_snapshot()`），实现 install_snapshot 处理大日志追赶。
- **日志压缩**：purge_log() 删除旧日志。
- **非投票者**：add_learner() 添加 learner 节点，仅复制不投票。
- **领导者租约**：确保读一致性。
- **性能**：事件驱动设计，支持批量消息。高负载下调整 heartbeat/election timeout。
- **测试**：使用内置 Suite 测试存储；集成测试模拟网络分区。
- **持久存储**：切换到 RocksDB（如 raft-kv-rocksdb 示例），实现 RaftLogStorage 使用 RocksDB KV。

### 第七部分：实战完整示例与部署

基于 raft-kv-memstore，构建完整 KV 服务：
- 服务器：集成 axum 处理客户端 API 和 Raft RPC。
- 客户端：使用 reqwest 发送到领导者。
- 演示集群：运行多个实例，测试 failover、成员变更。

完整代码见 GitHub 示例。部署到 Kubernetes：每个 pod 运行一个节点，使用服务发现更新地址。

潜在问题：确保数据持久性（flush 存储）；处理网络分区（调整超时）。

### 参考资料

- OpenRaft 官方文档：https://docs.rs/openraft/latest/openraft/
- Getting Started 指南：https://docs.rs/openraft/latest/openraft/docs/getting_started/index.html
- GitHub 仓库：https://github.com/databendlabs/openraft
- 示例：raft-kv-memstore (https://github.com/datafuselabs/openraft/tree/main/examples/raft-kv-memstore), raft-kv-rocksdb (https://github.com/datafuselabs/openraft/tree/main/examples/raft-kv-rocksdb)
- Raft 论文：https://raft.github.io/raftpaper.pdf
- 升级指南：https://docs.rs/openraft/latest/openraft/docs/upgrade_guide/index.html
- 社区：Discord (https://discord.gg/ZKw3WG7FQ9)

通过本指南，你可从零构建 OpenRaft 应用。若需 RocksDB 版本或更多代码，参考官方示例实验。

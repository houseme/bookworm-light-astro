---
title: "🦀 Actix 事件溯源：Redis Streams 持久化，匹配全程可追溯"
description: "XADD/XREADGROUP 重构 Matchmaking：入队 - 匹配 - 入房事件永久落盘，断线重连自动续消费，多实例并行处理，审计回滚一键搞定。"
date: 2026-02-03T10:32:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-raulling-28950755.jpg-slimming.webp"
categories: ["Rust", "实战指南","并发编程", "Actor 模型", "Actix", "高性能服务","tokio","分布式系统","redis","消息队列","事件溯源"]
authors: ["houseme"]
tags: ["Rust", "实战指南","并发编程","Actor 模型","Actix","高性能服务","消息隔离","无共享状态","异步编程","同步编程","监督机制","容错设计","全链路追踪","trace id","工业级代码","微服务通信","分布式系统","redis","消息队列","持久化队列","分布式共享","高可用"]
keywords: "rust,实战指南,并发编程,Actor 模型,Actix,高性能服务,消息隔离,无共享状态,异步编程,同步编程,监督机制,容错设计,全链路追踪,trace id,工业级代码,微服务通信,分布式系统,redis,消息队列,持久化队列,分布式共享,高可用"
draft: false
---


# Actix 游戏服务端进阶：使用 Redis Streams 实现事件溯源（Event Sourcing）

在上篇使用 **Redis Pub/Sub** 实现分布式 Matchmaking 的方案中，我们解决了跨实例通知问题，但 Pub/Sub 是**火并忘记**（fire-and-forget）的模型：

- 消息不持久化
- 断线后历史事件丢失
- 无法可靠地重放事件（replay）
- 不适合需要审计、回滚或状态重建的场景

**Redis Streams**（Redis 5.0+ 引入）是专为**持久化、可靠、可重放**的事件日志设计的结构，非常适合**事件溯源（Event Sourcing）**和**可靠的消息队列**。它结合了 append-only log + consumer groups 的能力，完美替代 Pub/Sub 在需要持久化和可靠投递的场景。

在本篇中，我们将把**Matchmaking 流程迁移到 Redis Streams + Consumer Groups**，实现：

- 事件持久化（玩家入队、匹配成功、加入房间等事件永久保存）
- 可靠投递 + 至少一次语义（at-least-once）
- 支持事件重放（replay）重建状态
- 分布式消费（多 Actix 实例并行处理）

## 1. Redis Streams vs Redis Pub/Sub 对比（针对事件溯源）

| 特性                  | Redis Pub/Sub               | Redis Streams                          | 适合场景                     |
|-----------------------|-----------------------------|----------------------------------------|------------------------------|
| 消息持久化            | 无（内存中转瞬即逝）        | 有（append-only log）                  | Streams 胜出                 |
| 历史回放（replay）    | 不支持                      | 支持（XREAD 从任意 ID 开始）           | Streams 胜出                 |
| 消费确认（ack）       | 无                          | 支持（XACK）                           | Streams 胜出                 |
| Consumer Groups       | 无（广播式）                | 支持（负载均衡、pending 消息管理）     | Streams 胜出                 |
| 至少一次投递          | 可能丢失                    | 支持（结合 XACK + pending claim）      | Streams 胜出                 |
| 实时广播              | 极低延迟                    | 稍高延迟（但仍毫秒级）                 | Pub/Sub 胜出                 |
| 典型用途              | 实时通知、聊天广播          | 事件溯源、可靠队列、工作流             | —                            |

**结论**：如果你的游戏需要**审计日志**、**断线重连后恢复状态**、**匹配历史分析**或**分布式可靠处理**，**Redis Streams** 是更合适的选择。

## 2. 核心概念（Event Sourcing 视角）

- **事件**：不可变的事实记录，如 `PlayerEnqueued`、`PlayersMatched`、`PlayerJoinedRoom`
- **Stream**：每个聚合根（aggregate）一个 stream，例如 `matchmaking:events`
- **Consumer Group**：允许多个消费者（Actix 实例）并行消费，自动负载均衡
- **XACK**：确认消费成功，防止重复投递
- **Pending Entries List (PEL)**：未确认的消息列表，可被 claim 重新分配

## 3. 实现方案

### 3.1 依赖

```toml
[dependencies]
redis = { version = "0.27", features = ["tokio-comp", "aio", "connection-manager"] }
deadpool-redis = "0.15"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1.7", features = ["v4"] }
tokio = { version = "1", features = ["full"] }
tracing = "0.1"
```

### 3.2 事件定义

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum MatchmakingEvent {
    PlayerEnqueued {
        player_id: Uuid,
        timestamp: DateTime<Utc>,
    },
    PlayersMatched {
        player1_id: Uuid,
        player2_id: Uuid,
        room_id: Uuid,
        timestamp: DateTime<Utc>,
    },
    PlayerJoinedRoom {
        player_id: Uuid,
        room_id: Uuid,
        timestamp: DateTime<Utc>,
    },
    // 可扩展：PlayerLeft, GameStarted, MatchCancelled...
}
```

### 3.3 写入事件（Producer – PlayerSession）

在 `PlayerSession::started` 中：

```rust
async fn enqueue_player(&self) {
    let event = MatchmakingEvent::PlayerEnqueued {
        player_id: self.id,
        timestamp: Utc::now(),
    };

    let mut conn = self.redis_pool.get().await.unwrap();
    let id: String = conn
        .xadd(
            "matchmaking:events",
            "*",
            &[("event", serde_json::to_string(&event).unwrap())],
        )
        .await
        .unwrap();

    tracing::info!("Enqueued player {} → event id {}", self.id, id);
}
```

### 3.4 Matchmaking Worker (Consumer Group)

我们启动一个独立的 **Actix Actor** 或 **tokio task** 作为消费者组成员：

```rust
pub struct MatchmakingConsumer {
    redis_pool: Pool,
    group_name: String,     // e.g. "matchmaking-workers"
    consumer_name: String,  // 唯一标识，如 "instance-1"
}

impl MatchmakingConsumer {
    pub fn new(pool: Pool, instance_id: &str) -> Self {
        Self {
            redis_pool: pool,
            group_name: "matchmaking-workers".to_string(),
            consumer_name: format!("consumer-{}", instance_id),
        }
    }

    pub async fn run(&self) {
        // 首次创建 consumer group（幂等）
        let mut conn = self.redis_pool.get().await.unwrap();
        let _: RedisResult<()> = redis::cmd("XGROUP")
            .arg("CREATE")
            .arg("matchmaking:events")
            .arg(&self.group_name)
            .arg("$")
            .arg("MKSTREAM")
            .query_async(&mut *conn)
            .await;

        loop {
            let mut conn = self.redis_pool.get().await.unwrap();

            // XREADGROUP 读取新消息
            let events: RedisResult<Vec<(String, Vec<(String, HashMap<String, String>)>)>> = redis::cmd("XREADGROUP")
                .arg("GROUP").arg(&self.group_name).arg(&self.consumer_name)
                .arg("COUNT").arg("10")
                .arg("BLOCK").arg("5000")  // 阻塞 5s
                .arg("STREAMS").arg("matchmaking:events").arg(">")
                .query_async(&mut *conn)
                .await;

            if let Ok(streams) = events {
                for (_stream, messages) in streams {
                    for (id, fields) in messages {
                        if let Some(event_json) = fields.get("event") {
                            if let Ok(event) = serde_json::from_str::<MatchmakingEvent>(event_json) {
                                self.process_event(&event, &id).await;
                            }
                        }

                        // 确认消费
                        let _: () = conn
                            .xack("matchmaking:events", &self.group_name, &[&id])
                            .await
                            .unwrap();
                    }
                }
            }
        }
    }

    async fn process_event(&self, event: &MatchmakingEvent, event_id: &str) {
        match event {
            MatchmakingEvent::PlayerEnqueued { player_id, .. } => {
                // 这里可以统计队列长度或触发匹配逻辑
                // 实际中可维护一个计数器或使用 ZSET 排序匹配
                tracing::info!("Processing enqueue: {}", player_id);
            }
            MatchmakingEvent::PlayersMatched { player1_id, player2_id, room_id, .. } => {
                // 通知玩家（通过 Redis Pub/Sub 或直接写另一个 stream）
                // 或者让 PlayerSession 订阅自己的 player stream
                tracing::info!("Match created: {} vs {} → room {}", player1_id, player2_id, room_id);
            }
            _ => {}
        }
    }
}
```

**启动消费者**（在 main 中）：

```rust
let consumer = MatchmakingConsumer::new(redis_pool.clone(), "node-1");
tokio::spawn(async move {
    consumer.run().await;
});
```

## 4. 匹配逻辑迁移到 Streams

匹配逻辑可以作为单独的 **周期性任务** 或 **事件驱动**：

```rust
// 周期性扫描 pending 或维护队列长度
async fn matchmaking_loop(&self) {
    loop {
        tokio::time::sleep(Duration::from_secs(3)).await;

        // 1. 获取当前等待玩家（可以用另一个 stream 或 ZSET）
        // 2. 当 >=2 时，生成匹配事件
        let event = MatchmakingEvent::PlayersMatched {
            player1_id: /* ... */,
            player2_id: /* ... */,
            room_id: Uuid::new_v4(),
            timestamp: Utc::now(),
        };

        let mut conn = self.redis_pool.get().await.unwrap();
        conn.xadd(
            "matchmaking:events",
            "*",
            &[("event", serde_json::to_string(&event).unwrap())],
        ).await.unwrap();
    }
}
```

## 5. 事件重放（Replay）支持

```rust
async fn replay_events(&self, from_id: Option<String>) {
    let mut conn = self.redis_pool.get().await.unwrap();

    let start = from_id.unwrap_or("0-0".to_string());

    let events: Vec<(String, Vec<(String, HashMap<String, String>)>)> = redis::cmd("XREAD")
        .arg("STREAMS").arg("matchmaking:events").arg(start)
        .query_async(&mut *conn)
        .await
        .unwrap();

    // 按顺序处理所有事件，重建状态
}
```

## 6. 最佳实践

- **Stream 修剪**：`XTRIM matchmaking:events MAXLEN ~100000` 限制大小
- **Pending 消息处理**：启动时 + 周期性 `Xpending` + `Xclaim`
- **Exactly-once**：结合唯一事件 ID + 幂等处理器
- **多 Stream**：按聚合根拆分（`player:{id}:events`, `room:{id}:events`）
- **监控**：`XLEN`, `XINFO GROUPS`, `XINFO CONSUMERS`
- **高可用**：Redis Sentinel 或 Redis Cluster

## 7. 总结

| 目标                   | Pub/Sub 方案               | Streams 方案                     |
|------------------------|----------------------------|----------------------------------|
| 分布式通知             | 优秀                       | 好（需额外机制）                 |
| 事件持久化 & 重放      | 无                         | 优秀                             |
| 可靠投递               | 可能丢失                   | 支持（ack + pending）            |
| 事件溯源               | 不适合                     | 非常适合                         |
| 复杂度                 | 较低                       | 中等                             |

**推荐**：
- 纯实时通知 → 继续用 Pub/Sub
- 需要可靠日志、审计、状态重建、断线恢复 → 迁移到 **Redis Streams**

如果需要完整代码（包括 pending 消息 reclaim、事件幂等处理、房间状态重建），或者想结合 **Actix** 做更细粒度的 actor-per-aggregate 模式，告诉我，我可以继续深入！

---
title: "🦀 Actix 分布式配对：Redis Pub/Sub 解耦，任意节点秒级撮合"
description: "Matchmaker 零状态，PlayerSession 自订阅个人频道，匹配结果广播即收；多实例负载均衡、断线自动清理，支撑百万级玩家实时对战。"
date: 2026-02-04T10:32:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-einfoto-3793930.jpg-slimming.webp"
categories: ["Rust", "实战指南","并发编程", "Actor 模型", "Actix", "高性能服务","tokio","分布式系统","redis","消息队列"]
authors: ["houseme"]
tags: ["Rust", "实战指南","并发编程","Actor 模型","Actix","高性能服务","消息隔离","无共享状态","异步编程","同步编程","监督机制","容错设计","全链路追踪","trace id","工业级代码","微服务通信","分布式系统","redis","消息队列","持久化队列","分布式共享","高可用"]
keywords: "rust,实战指南,并发编程,Actor 模型,Actix,高性能服务,消息隔离,无共享状态,异步编程,同步编程,监督机制,容错设计,全链路追踪,trace id,工业级代码,微服务通信,分布式系统,redis,消息队列,持久化队列,分布式共享,高可用"
draft: false
---


# Actix 游戏服务端进阶：使用 Redis Pub/Sub 实现分布式 Matchmaking

在上篇 Redis 队列持久化方案中，我们讨论了使用 Redis List + 内存缓存的方式来持久化等待队列。但在**多实例**（分布式部署）场景下，内存缓存会成为瓶颈——每个 Actix 实例维护自己的 `HashMap<Uuid, Addr<PlayerSession>>`，导致匹配后无法跨实例通知正确的玩家 Actor。

**Redis Pub/Sub** 提供了一个**无状态、分布式**的解决方案：

- Matchmaker 只负责队列管理和匹配逻辑（不持有 Addr）
- 匹配成功后，通过 Redis Publish 广播匹配结果
- 每个 **PlayerSession Actor** 订阅属于自己的频道（例如 `match:player:{player_id}`）
- 收到匹配成功的消息后，PlayerSession 自己处理加入房间逻辑

这种方式完全解耦了匹配器和会话 Actor，支持任意数量的 Actix 实例（负载均衡）。

## 1. 设计原理

**核心流程**：

1. 玩家连接 → PlayerSession 生成 player_id → 向 Redis LPUSH player_id 到等待队列
2. Matchmaker（任意一个实例）周期性或事件驱动检查队列长度
3. 当队列 ≥ 2 → RPOP 两个 player_id → 创建房间 → Publish 到两个玩家的个人频道
4. 每个 PlayerSession 订阅自己的频道 → 收到消息 → 加入房间 Actor 并通知客户端

**优点**：
- 完全无状态（Matchmaker 不持有 Addr）
- 支持多节点负载均衡
- 玩家断线后自动取消订阅（清理简单）
- 可扩展到技能匹配、超时处理

**缺点**：
- 比纯内存略多一次网络往返
- 需要处理 Redis 连接断开重连

## 2. 依赖

```toml
[dependencies]
# 原有...
redis = { version = "0.27", features = ["tokio-comp", "aio", "connection-manager"] }
deadpool-redis = "0.15"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1.7", features = ["v4", "serde"] }
serde_json = "1.0"
```

## 3. 初始化 Redis 连接池（main.rs）

```rust
use deadpool_redis::{Config, Pool, Runtime};

fn create_redis_pool() -> Pool {
    let redis_url = std::env::var("REDIS_URL").unwrap_or("redis://127.0.0.1:6379".into());
    Config::from_url(redis_url)
        .create_pool(Some(Runtime::Tokio1))
        .expect("Failed to create Redis pool")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let redis_pool = create_redis_pool();

    let matchmaker = Matchmaker::new(redis_pool.clone()).start();

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(redis_pool.clone()))
            .app_data(web::Data::new(matchmaker.clone()))
            .route("/ws", web::get().to(ws_route))
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
```

## 4. PlayerSession Actor – 订阅自己的频道

```rust
// actors/player.rs
use actix::prelude::*;
use actix_web_actors::ws;
use deadpool_redis::Pool;
use redis::aio::PubSub;
use redis::{AsyncCommands, RedisResult};
use uuid::Uuid;
use std::time::Instant;

pub struct PlayerSession {
    pub id: Uuid,
    pub hb: Instant,
    pub room: Option<Addr<GameRoom>>,
    pub redis_pool: Pool,
    pub pubsub: Option<PubSub>,
}

impl PlayerSession {
    pub fn new(id: Uuid, redis_pool: Pool) -> Self {
        Self {
            id,
            hb: Instant::now(),
            room: None,
            redis_pool,
            pubsub: None,
        }
    }

    async fn subscribe_to_self(&mut self, ctx: &mut ws::WebsocketContext<Self>) {
        let mut conn = self.redis_pool.get().await.expect("Redis conn failed");
        let mut pubsub = conn.into_pubsub();

        let channel = format!("match:player:{}", self.id);
        pubsub.subscribe(&channel).await.expect("Subscribe failed");

        self.pubsub = Some(pubsub);

        // 启动消息监听 Stream
        let mut pubsub_stream = self.pubsub.as_mut().unwrap().into_on_message();

        ctx.spawn(async move {
            while let Some(msg) = pubsub_stream.next().await {
                match msg {
                    Ok(m) => {
                        if let Ok(payload) = m.get_payload::<String>() {
                            // 解析匹配结果，例如 JSON { "room_id": "...", "opponent_id": "..." }
                            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&payload) {
                                if let Some(room_id_str) = data.get("room_id").and_then(|v| v.as_str()) {
                                    let room_id = Uuid::parse_str(room_id_str).unwrap();
                                    // 这里假设你有办法获取或创建 GameRoom Addr
                                    // 方案 1：通过全局房间注册表（Redis Hash）
                                    // 方案 2：直接创建本地 GameRoom（推荐简单游戏）
                                    let room = GameRoom::new(room_id).start();

                                    ctx.address().do_send(JoinedRoom(room.clone()));
                                    // 通知客户端
                                    ctx.text(serde_json::json!({
                                        "event": "matched",
                                        "room_id": room_id,
                                        "opponent": data.get("opponent_id")
                                    }).to_string());
                                }
                            }
                        }
                    }
                    Err(e) => tracing::error!("PubSub error: {:?}", e),
                }
            }
        }.into_actor(self));
    }
}

impl Actor for PlayerSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        // 心跳...
        ctx.spawn(self.subscribe_to_self(ctx));
        // 入队
        let player_id = self.id.to_string();
        ctx.spawn(async move {
            let mut conn = /* get conn */;
            let _: () = conn.lpush("matchmaking:waiting", player_id).await.unwrap_or(());
        }.into_actor(self));
    }

    fn stopping(&mut self, _: &mut Self::Context) -> Running {
        // 取消订阅
        if let Some(mut pubsub) = self.pubsub.take() {
            let channel = format!("match:player:{}", self.id);
            let _ = pubsub.unsubscribe(&channel).await;
        }
        // 从队列移除（可选，生产中用 Lua 脚本原子删除）
        Running::Stop
    }
}
```

## 5. Matchmaker Actor – 周期性匹配 + Publish

```rust
// actors/matchmaker.rs
use actix::prelude::*;
use deadpool_redis::Pool;
use redis::AsyncCommands;
use uuid::Uuid;
use serde_json::json;

const QUEUE_KEY: &str = "matchmaking:waiting";

pub struct Matchmaker {
    redis_pool: Pool,
}

impl Matchmaker {
    pub fn new(pool: Pool) -> Self { Self { redis_pool: pool } }
}

impl Actor for Matchmaker {
    type Context = Context<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        ctx.run_interval(std::time::Duration::from_secs(3), |act, _ctx| {
            act.try_match();
        });
    }
}

impl Matchmaker {
    fn try_match(&self) {
        let pool = self.redis_pool.clone();
        actix::spawn(async move {
            let mut conn = pool.get().await.expect("Redis conn");

            let len: i64 = conn.llen(QUEUE_KEY).await.unwrap_or(0);
            if len < 2 { return; }

            // 原子弹出两个玩家
            let p1: Option<String> = conn.rpop(QUEUE_KEY).await.unwrap();
            let p2: Option<String> = conn.rpop(QUEUE_KEY).await.unwrap();

            if let (Some(p1_id), Some(p2_id)) = (p1, p2) {
                let room_id = Uuid::new_v4();

                // 通知两个玩家
                let msg = json!({
                    "room_id": room_id.to_string(),
                    "opponent_id": if p1_id == p2_id { "self" } else { &p2_id }
                }).to_string();

                let _: () = conn.publish(format!("match:player:{}", p1_id), &msg).await.unwrap();
                let _: () = conn.publish(format!("match:player:{}", p2_id), &msg).await.unwrap();

                tracing::info!("Matched {} vs {} → room {}", p1_id, p2_id, room_id);
            }
        });
    }
}
```

## 6. 启动方式（main.rs 中）

```rust
let redis_pool = create_redis_pool();
let matchmaker = Matchmaker::new(redis_pool.clone()).start();

// PlayerSession 使用 redis_pool
ws::start(
    PlayerSession::new(player_id, redis_pool.clone()),
    &req,
    stream,
)
```

## 7. 最佳实践与注意事项

- **重连**：使用 `deadpool-redis` 连接池自动管理重连
- **清理**：玩家断线后，队列中的 player_id 可能残留 → 周期性清理（或用 Lua 脚本检查活跃）
- **房间 Addr 管理**：简单游戏可在本地创建房间；复杂游戏用 Redis Hash 注册 `room_id → node_id`，跨节点转发
- **性能**：Redis Pub/Sub 非常高效，单实例轻松支撑数万连接
- **安全性**：生产环境启用 Redis 密码 + TLS
- **扩展**：支持技能匹配 → 使用 Redis Sorted Set (ZADD/ZRANGE) 代替 List

## 8. 总结对比

| 方案                  | 状态       | 分布式支持 | 复杂度 | 推荐场景                  |
|-----------------------|------------|------------|--------|---------------------------|
| 内存 VecDeque         | 有状态     | 否         | 低     | 单实例、小型项目          |
| Redis List + 内存缓存 | 半状态     | 部分       | 中     | 中型项目                  |
| Redis Pub/Sub         | 无状态     | 完全       | 中高   | 生产级、多节点、负载均衡  |

**推荐**：追求高可用和水平扩展时，**Redis Pub/Sub** 是目前最优雅的方案之一。

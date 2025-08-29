---
title: "Rust 中的 JWT 实战：使用 jsonwebtoken 和 Salvo 构建安全的 Web 应用"
description: "JSON Web Token (JWT) 是一种开放标准（RFC 7519），用于在网络应用环境间安全地传输信息。JWT 通常用于身份验证和信息交换。它由三部分组成：头部（Header）、载荷（Payload）和签名（Signature），这三部分通过`.`连接在一起。"
date: 2024-10-28T08:15:00Z
image: "https://static-rs.bifuba.com/images/posts/arno-senoner-_7bsgYdTTVE-unsplash.jpg"
categories: ["rust", "jwt", "jsonwebtoken", "oauth2", "security", "salvo"]
authors: ["houseme"]
tags: ["rust", "jwt", "jsonwebtoken", "oauth2", "security", "salvo", "authentication", "rsa", "实战指南", "身份验证", "授权", "安全", "Salvo", "JSON Web Token"]
keywords: "rust, jwt, jsonwebtoken, oauth2, security, authentication, rsa, 实战指南, 身份验证, 授权, 安全, Salvo, JSON Web Token"
draft: false
---

### 1. 什么是 JSON Web Token (JWT)？

JSON Web Token (JWT) 是一种开放标准（RFC 7519），用于在网络应用环境间安全地传输信息。JWT 通常用于身份验证和信息交换。它由三部分组成：头部（Header）、载荷（Payload）和签名（Signature），这三部分通过`.`连接在一起。

#### 1.1 JWT 的结构

- **Header**: 包含令牌的类型（JWT）和所使用的签名算法（如 HMAC SHA256 或 RSA）。
- **Payload**: 包含声明（Claims），即关于实体（通常是用户）和其他数据的声明。
- **Signature**: 用于验证消息在传输过程中没有被更改，并且对于使用私钥签名的令牌，还可以验证发送者的身份。

### 2. JWT 的工作原理

1. **用户登录**：用户提供凭据（如用户名和密码）进行身份验证。
2. **服务器验证**：服务器验证凭据，如果有效，则生成一个 JWT。
3. **返回 JWT**：服务器将 JWT 返回给客户端。
4. **客户端存储 JWT**：客户端通常将 JWT 存储在本地存储或 Cookie 中。
5. **请求资源**：客户端在后续请求中将 JWT 包含在请求头中（通常是 `Authorization` 头）。
6. **服务器验证 JWT**：服务器验证 JWT 的有效性，并根据 JWT 中的信息决定是否授予访问权限。

### 3. JWT 的优点

- **无状态**：JWT 是自包含的，服务器不需要存储会话信息。
- **跨域支持**：JWT 可以轻松地在不同域之间传递。
- **安全性**：通过签名和加密，JWT 可以防止篡改和伪造。

### 4. Rust 中的 JWT 实战示例

我们将使用 Rust 和 `jsonwebtoken` 库来实现一个简单的 JWT 身份验证系统，并使用 `Salvo 0.73` 框架来处理 HTTP 请求。

#### 4.1 创建项目

首先，创建一个新的 Rust 项目并添加必要的依赖：

```bash
cargo new jwt_salvo_demo
cd jwt_salvo_demo
```

在 `Cargo.toml` 文件中添加以下依赖：

```toml
[dependencies]
salvo = "0.73"
jsonwebtoken = "8.1"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
chrono = "0.4"
```

#### 4.2 定义 JWT 载荷

创建一个 `src/models.rs` 文件，定义 JWT 载荷结构：

```rust
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // 用户 ID
    pub exp: i64,    // 过期时间
    pub iat: i64,    // 签发时间
}

impl Claims {
    pub fn new(sub: String, exp: DateTime<Utc>) -> Self {
        Self {
            sub,
            exp: exp.timestamp(),
            iat: Utc::now().timestamp(),
        }
    }
}
```

#### 4.3 实现 JWT 生成和验证

创建一个 `src/jwt.rs` 文件，实现 JWT 的生成和验证逻辑：

```rust
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation, errors::Error};
use chrono::{Duration, Utc};
use crate::models::Claims;

const SECRET_KEY: &[u8] = b"your_secret_key";

pub fn generate_token(user_id: &str) -> Result<String, Error> {
    let claims = Claims::new(user_id.to_string(), Utc::now() + Duration::hours(1));
    encode(&Header::default(), &claims, &EncodingKey::from_secret(SECRET_KEY))
}

pub fn validate_token(token: &str) -> Result<Claims, Error> {
    decode::<Claims>(token, &DecodingKey::from_secret(SECRET_KEY), &Validation::default()).map(|data| data.claims)
}
```

#### 4.4 实现 HTTP 路由

在 `src/main.rs` 文件中，使用 Salvo 框架实现 HTTP 路由：

```rust
mod models;
mod jwt;

use salvo::prelude::*;
use salvo::http::StatusCode;
use serde::Deserialize;
use crate::jwt::{generate_token, validate_token};

#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[handler]
async fn login(req: &mut Request, res: &mut Response) {
    let login_req: LoginRequest = req.parse_json().await.unwrap();

    // 模拟用户验证
    if login_req.username == "user1" && login_req.password == "password1" {
        let token = generate_token(&login_req.username).unwrap();
        res.render(Json(json!({ "token": token })));
    } else {
        res.status_code(StatusCode::UNAUTHORIZED);
        res.render(Json(json!({ "message": "Invalid credentials" })));
    }
}

#[handler]
async fn profile(req: &mut Request, res: &mut Response) {
    if let Some(token) = req.header("Authorization") {
        let token = token.split_whitespace().last().unwrap();
        match validate_token(token) {
            Ok(claims) => {
                res.render(Json(json!({ "user": claims })));
            }
            Err(_) => {
                res.status_code(StatusCode::FORBIDDEN);
                res.render(Json(json!({ "message": "Invalid token" })));
            }
        }
    } else {
        res.status_code(StatusCode::UNAUTHORIZED);
        res.render(Json(json!({ "message": "No token provided" })));
    }
}

#[tokio::main]
async fn main() {
    let router = Router::new()
        .push(Router::with_path("login").post(login))
        .push(Router::with_path("profile").get(profile));

    let acceptor = TcpListener::new("127.0.0.1:3000").bind().await;
    Server::new(acceptor).serve(router).await;
}
```

#### 4.5 运行服务器

在终端中运行以下命令启动服务器：

```bash
cargo run
```

#### 4.6 测试 JWT 系统

1. **登录并获取 JWT**：

   使用 Postman 或 curl 发送 POST 请求到 `/login` 接口：

   ```bash
   curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{"username": "user1", "password": "password1"}'
   ```

   响应将包含一个 JWT：

   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMSIsImV4cCI6MTYxNjIwMDAwMCwiaWF0IjoxNjE2MjAzNjAwfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
   }
   ```

2. **访问受保护的资源**：

   使用获取到的 JWT 访问 `/profile` 接口：

   ```bash
   curl -X GET http://localhost:3000/profile -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMSIsImV4cCI6MTYxNjIwMDAwMCwiaWF0IjoxNjE2MjAzNjAwfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
   ```

   响应将包含用户信息：

   ```json
   {
     "user": {
       "sub": "user1",
       "exp": 1616200000,
       "iat": 1616203600
     }
   }
   ```

### 5. 总结

通过本文，你已经了解了 JWT 的基本概念、工作原理以及如何在 Rust 中使用 `jsonwebtoken` 和 `Salvo 0.73` 框架实现一个简单的 JWT 身份验证系统。JWT 是一种强大且灵活的身份验证机制，适用于各种 Web 应用场景。希望这篇入门指南能帮助你快速上手 JWT，并在实际项目中应用它。

---

### 6. 进阶阅读

- **JWT 安全性**：了解如何保护 JWT 免受常见攻击，如重放攻击、XSS 和 CSRF。
- **JWT 刷新机制**：学习如何实现 JWT 的刷新机制，以避免用户频繁登录。
- **JWT 与 OAuth2**：探索 JWT 在 OAuth2 身份验证流程中的应用。

通过不断学习和实践，你将能够构建更加安全和高效的身份验证系统。祝你编程愉快！🚀

---
title: "Apple ID 登录实战教程（服务端使用 Rust 实现）"
description: "在本教程中，我们将介绍如何在服务端使用 Rust 实现 Apple ID 登录功能。我们将使用 `jsonwebtoken` 库来验证 Apple 提供的 JWT 令牌，并使用 `reqwest` 库来发送 HTTP 请求。"
date: 2024-10-07T08:15:00Z
image: "https://static-rs.bifuba.com/images/posts/tim-marshall-jqj2SqvxMVY-unsplash.jpg"
categories:
  ["rust", "backend", "web", "apple", "jwt", "reqwest", "jsonwebtoken"]
authors: ["houseme"]
tags:
  [
    "rust",
    "apple id",
    "login",
    "jwt",
    "reqwest",
    "jsonwebtoken",
    "web",
    "backend",
    "apple",
    "authentication",
    "oauth",
    "security",
    "tutorial",
    "实战",
    "教程",
  ]
keywords: "rust, apple id, login, jwt, reqwest, jsonwebtoken, web, backend, apple, authentication, oauth, security, tutorial, 实战, 教程"
draft: false
---

在本教程中，我们将介绍如何在服务端使用 Rust 实现 Apple ID 登录功能。我们将使用 `jsonwebtoken` 库来验证 Apple 提供的 JWT 令牌，并使用 `reqwest` 库来发送 HTTP 请求。

## 1. 准备工作

在开始之前，你需要在 Apple Developer 网站上创建一个 App ID，并启用 Sign in with Apple 功能。你还需要生成一个密钥（Private Key），并获取相关的配置信息，如 `team_id`、`client_id`、`key_id` 等。

## 2. 安装依赖

在你的 Rust 项目中，添加以下依赖：

```toml
[dependencies]
jsonwebtoken = "8.1"
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
base64 = "0.13"
```

## 3. 获取 Apple 的公钥

Apple 使用 JWT 来验证用户的身份。我们需要从 Apple 获取公钥来验证 JWT 的签名。

```rust
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
struct ApplePublicKey {
    keys: Vec<HashMap<String, String>>,
}

async fn fetch_apple_public_keys() -> Result<ApplePublicKey, reqwest::Error> {
    let client = Client::new();
    let response = client
        .get("https://appleid.apple.com/auth/keys")
        .send()
        .await?
        .json::<ApplePublicKey>()
        .await?;
    Ok(response)
}
```

## 4. 验证 JWT 令牌

Apple 返回的 JWT 令牌包含用户的身份信息。我们需要验证这个令牌的签名，并解析其中的内容。

```rust
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct AppleClaims {
    iss: String,
    aud: String,
    exp: usize,
    iat: usize,
    sub: String,
    c_hash: String,
    email: String,
    email_verified: String,
    auth_time: usize,
    nonce_supported: bool,
}

fn verify_apple_jwt(token: &str, public_keys: &[HashMap<String, String>]) -> Result<AppleClaims, jsonwebtoken::errors::Error> {
    let header = decode_header(token)?;
    let kid = header.kid.expect("JWT should have a kid");

    let key_data = public_keys
        .iter()
        .find(|key| key.get("kid").map(|k| k == &kid).unwrap_or(false))
        .expect("No matching key found");

    let n = base64::decode_config(key_data.get("n").unwrap(), base64::URL_SAFE_NO_PAD)?;
    let e = base64::decode_config(key_data.get("e").unwrap(), base64::URL_SAFE_NO_PAD)?;

    let decoding_key = DecodingKey::from_rsa_components(&n, &e)?;

    let validation = Validation::new(Algorithm::RS256);
    let token_data = decode::<AppleClaims>(token, &decoding_key, &validation)?;

    Ok(token_data.claims)
}
```

## 5. 整合代码

将上述代码整合到一个完整的函数中，用于处理 Apple ID 登录请求：

```rust
async fn handle_apple_login(token: &str) -> Result<AppleClaims, Box<dyn std::error::Error>> {
    let apple_public_keys = fetch_apple_public_keys().await?;
    let claims = verify_apple_jwt(token, &apple_public_keys.keys)?;
    Ok(claims)
}
```

## 6. 测试

你可以通过模拟一个 Apple ID 登录请求来测试这个功能。确保你已经获取了一个有效的 Apple ID JWT 令牌。

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let token = "your_apple_id_jwt_token";
    let claims = handle_apple_login(token).await?;
    println!("User claims: {:?}", claims);
    Ok(())
}
```

## 官方文档

- [Apple Developer Documentation - Sign in with Apple](https://developer.apple.com/documentation/sign_in_with_apple "Apple Developer Documentation - Sign in with Apple")
- [Apple Developer Documentation - Verifying a Token](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/verifying_a_token "Apple Developer Documentation - Verifying a Token")
- [Apple Developer Documentation - JWT](https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens "Apple Developer Documentation - JWT")

## 总结

通过本教程，你已经学会了如何在服务端使用 Rust 实现 Apple ID 登录功能。你了解了如何获取 Apple 的公钥、验证 JWT 令牌，并解析用户的身份信息。希望这个教程对你有所帮助！

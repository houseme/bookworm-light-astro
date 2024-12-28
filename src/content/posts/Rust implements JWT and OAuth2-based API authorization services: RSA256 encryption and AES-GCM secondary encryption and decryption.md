---
title: "Rust 实现基于 JWT 和 OAuth2 的 API 授权服务：RSA256 加密与 AES-GCM 二次加解密"
description: "在现代 Web 应用中，API 授权是确保数据安全和用户隐私的关键环节。JSON Web Token (JWT) 和 OAuth2 是两种广泛使用的授权机制。本文将介绍如何使用 Rust 语言实现一个基于 JWT 和 OAuth2 的 API 授权服务，并结合 RSA256 对称加密和 AES-GCM 算法进行二次加解密，以增强安全性。"
date: 2024-11-02T08:00:00Z
image: "https://static-rs.bifuba.com/images/posts/tim-marshall-jqj2SqvxMVY-unsplash.jpg"
categories:
  [
    "rust",
    "OAuth2",
    "JWT",
    "encryption",
    "decryption",
    "security",
    "compatibility",
    "AES-GCM",
  ]
authors: ["houseme"]
tags:
  [
    "rust",
    "RSA key pair",
    "PKCS#1",
    "PKCS#8",
    "generate",
    "store",
    "file",
    "format",
    "encryption",
    "decryption",
    "security",
    "compatibility",
  ]
keywords: "rust,RSA密钥对,PKCS#1,PKCS#8,生成,存储,文件,格式,加密,解密,安全,兼容性"
draft: false
---

## 1. 引言

在现代 Web 应用中，API 授权是确保数据安全和用户隐私的关键环节。JSON Web Token (JWT) 和 OAuth2 是两种广泛使用的授权机制。本文将介绍如何使用 Rust 语言实现一个基于 JWT 和 OAuth2 的 API 授权服务，并结合 RSA256 对称加密和 AES-GCM 算法进行二次加解密，以增强安全性。

## 2. 依赖库介绍

- **aes-gcm**: 用于 AES-GCM 算法的加解密。
- **base64**: 用于 Base64 编码和解码。
- **rand**: 用于生成随机数，用于 AES-GCM 的 nonce。
- **salvo**: 一个高性能的 Rust Web 框架，支持 JWT 认证、CORS、OpenAPI 等功能。
- **jsonwebtoken**: 用于生成和验证 JWT。
- **rsa**: 用于生成 RSA 密钥对，并进行 RSA256 加密和解密。

## 3. 生成 RSA 密钥对

首先，我们需要生成 RSA 密钥对，并将其保存为 PKCS#8 格式。

```rust
use rsa::{RsaPrivateKey, RsaPublicKey, Pkcs8};
use rand::rngs::OsRng;

fn generate_rsa_keys() -> (RsaPrivateKey, RsaPublicKey) {
    let mut rng = OsRng;
    let bits = 2048;
    let private_key = RsaPrivateKey::new(&mut rng, bits).expect("failed to generate private key");
    let public_key = RsaPublicKey::from(&private_key);

    // 保存私钥为 PKCS#8 格式
    let private_pem = private_key.to_pkcs8_pem().expect("failed to convert private key to PEM");
    std::fs::write("private_key.pem", private_pem).expect("failed to write private key to file");

    // 保存公钥为 PKCS#8 格式
    let public_pem = public_key.to_public_key_pem().expect("failed to convert public key to PEM");
    std::fs::write("public_key.pem", public_pem).expect("failed to write public key to file");

    (private_key, public_key)
}
```

## 4. 生成 JWT Token

使用生成的 RSA 私钥对 JWT 进行签名。

```rust
use jsonwebtoken::{encode, Header, EncodingKey};
use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: i64,
}

fn generate_jwt(private_key: &RsaPrivateKey, user_id: &str) -> String {
    let claims = Claims {
        sub: user_id.to_string(),
        exp: (Utc::now() + Duration::hours(1)).timestamp(),
    };

    let header = Header::new(jsonwebtoken::Algorithm::RS256);
    let token = encode(&header, &claims, &EncodingKey::from_rsa_pem(private_key.to_pkcs8_pem().unwrap().as_bytes()).unwrap()).unwrap();

    token
}
```

## 5. 使用 AES-GCM 进行二次加解密

为了进一步增强安全性，我们可以使用 AES-GCM 对 JWT Token 进行二次加密。

```rust
use aes_gcm::{Aes256Gcm, KeyInit};
use aes_gcm::aead::{Aead, Payload};
use rand::Rng;

fn encrypt_token(token: &str) -> String {
    let key = aes_gcm::Aes256Gcm::generate_key(rand::thread_rng());
    let cipher = Aes256Gcm::new(&key);
    let nonce = rand::thread_rng().gen::<[u8; 12]>();

    let payload = Payload {
        msg: token.as_bytes(),
        aad: b"",
    };

    let ciphertext = cipher.encrypt(&nonce.into(), payload).unwrap();
    let encrypted_token = base64::encode(&ciphertext);

    encrypted_token
}

fn decrypt_token(encrypted_token: &str) -> String {
    let key = aes_gcm::Aes256Gcm::generate_key(rand::thread_rng());
    let cipher = Aes256Gcm::new(&key);
    let nonce = rand::thread_rng().gen::<[u8; 12]>();

    let ciphertext = base64::decode(encrypted_token).unwrap();
    let payload = Payload {
        msg: &ciphertext,
        aad: b"",
    };

    let plaintext = cipher.decrypt(&nonce.into(), payload).unwrap();
    String::from_utf8(plaintext).unwrap()
}
```

## 6. Salvo 框架集成

我们将上述功能集成到 Salvo 框架中，实现一个完整的 API 授权服务。

```rust
use salvo::prelude::*;
use salvo::jwt_auth::{JwtAuth, JwtAuthExtract};
use salvo::oapi::{OpenApi, ToSchema};
use salvo::oapi::security::{SecurityScheme, SecuritySchemeData};

#[handler]
async fn login(req: &mut Request, depot: &mut Depot, res: &mut Response) {
    let user_id = req.form::<String>("user_id").await.unwrap();
    let (private_key, _) = generate_rsa_keys();
    let token = generate_jwt(&private_key, &user_id);
    let encrypted_token = encrypt_token(&token);

    res.render(Json(encrypted_token));
}

#[handler]
async fn protected(req: &mut Request, depot: &mut Depot, res: &mut Response) {
    let token = depot.jwt_auth().unwrap();
    let decrypted_token = decrypt_token(&token);
    let claims = jsonwebtoken::decode::<Claims>(&decrypted_token, &DecodingKey::from_rsa_pem(std::fs::read("public_key.pem").unwrap().as_slice()).unwrap(), &Validation::new(jsonwebtoken::Algorithm::RS256)).unwrap().claims;

    res.render(Json(claims));
}

#[tokio::main]
async fn main() {
    let router = Router::new()
        .push(Router::with_path("login").post(login))
        .push(Router::with_path("protected").get(protected).hoop(JwtAuth::new("public_key.pem", jsonwebtoken::Algorithm::RS256)));

    let acceptor = TcpListener::new("127.0.0.1:7878").bind().await;
    Server::new(acceptor).serve(router).await;
}
```

## 7. 前端上报与服务端验证

前端在接收到加密的 JWT Token 后，将其上报给服务端。服务端接收到上报内容后，首先进行解密，然后验证 JWT Token 的有效性，并解析出用户信息。

```rust
#[handler]
async fn report(req: &mut Request, depot: &mut Depot, res: &mut Response) {
    let encrypted_token = req.form::<String>("token").await.unwrap();
    let decrypted_token = decrypt_token(&encrypted_token);
    let claims = jsonwebtoken::decode::<Claims>(&decrypted_token, &DecodingKey::from_rsa_pem(std::fs::read("public_key.pem").unwrap().as_slice()).unwrap(), &Validation::new(jsonwebtoken::Algorithm::RS256)).unwrap().claims;

    res.render(Json(claims));
}
```

## 8. 总结

本文介绍了如何使用 Rust 语言和 Salvo 框架实现一个基于 JWT 和 OAuth2 的 API 授权服务，并结合 RSA256 对称加密和 AES-GCM 算法进行二次加解密，以增强安全性。通过 Salvo 框架的集成，我们实现了一个完整的授权流程，包括密钥生成、JWT 生成与验证、AES-GCM 加解密、以及前端上报与服务端验证。

通过这种方式，我们不仅确保了 API 的安全性，还提供了灵活的授权机制，适用于各种复杂的应用场景。

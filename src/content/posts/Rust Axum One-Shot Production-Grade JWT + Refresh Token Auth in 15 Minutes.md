---
title: "🦀 Rust Axum 一刀流：15 分钟搞定生产级 JWT + Refresh Token 认证"
description: "用 Rust Axum 极速搭建工业级双 Token 体系，HttpOnly 旋转刷新、黑名单撤销、CSRF 全防，单文件即可上线"
date: 2026-01-03T11:22:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-aburrell-205717.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","Axum", "JWT", "中间件", "认证", "授权", "安全", "API","jsonwebtokens","claims","Bearer","tower"]
authors: ["houseme"]
tags: ["Rust", "实战指南", "Rust 生态","Axum","JWT", "中间件", "认证", "授权", "安全", "API", "Axum JWT", "Axum 中间件", "Rust 安全", "Rust API]", "jsonwebtokens", "Bearer", "claims","Refresh Token"]
keywords: "rust,实战指南,Rust 生态,Axum,JWT,中间件,认证,授权,安全,API,Axum JWT,Axum 中间件,Rust 安全,Rust API,jsonwebtokens,Bearer,claims,Refresh Token"
draft: false
---


# Rust Axum 框架中生产级 JWT + Refresh Token 完整认证系统最佳实践

## 引言背景

在前文 JWT 认证基础上，现在添加**生产级 Refresh Token 支持**，实现完整的无状态 + 安全刷新机制：

- **Access Token**：短生命周期（15-60 分钟），用于 API 访问
- **Refresh Token**：长生命周期（7-30 天），用于获取新 Access Token
- Refresh Token 存储在 **HttpOnly + Secure + SameSite=Strict** Cookie 中（最安全方式）
- 支持 Refresh Token 旋转（Rotation）+ 单次使用（One-Time-Use）防重放攻击
- 支持 Refresh Token 撤销（通过黑名单或数据库）
- 使用双 JWT（access + refresh）结构

本实现采用工业级标准，防常见攻击（窃取、CSRF、重放）。

## 最佳实践要点

- **Refresh Token 不放 Header**，而是放 HttpOnly Cookie
- 使用独立的 **refresh_secret**（与 access_secret 不同）
- Refresh Token 旋转：每次刷新生成新 refresh token，旧的失效
- 存储 refresh token 的当前版本或 jti（JWT ID）到数据库/Redis（示例用内存 Map）
- 登出时清除 Cookie 并加入黑名单
- 所有敏感操作使用 HTTPS（已启用）

## 完整实例代码（含 Refresh Token 支持）

### Cargo.toml
```toml
[package]
name = "axum-jwt-refresh-token"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
axum_server = "0.7"
tokio = { version = "1.48.0", features = ["full"] }
tower-http = { version = "0.6.8", features = ["trace", "cors"] }
jsonwebtoken = "9.3"
serde = { version = "1.0", features = ["derive"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.8", features = ["v4", "serde"] }
tracing = "0.1.40"
tracing-subscriber = "0.3.18"
rustls = "0.23.35"
rustls-pemfile = "2.2.0"
```

### src/main.rs
```rust
use axum::{
    async_trait,
    extract::{Extension, FromRequestParts, TypedHeader},
    headers::{authorization::Bearer, Authorization, Cookie},
    http::{request::Parts, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use axum_server::tls_rustls::RustlsConfig;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use uuid::Uuid;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{error, info};

// === Claims 定义 ===
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AccessClaims {
    pub sub: String,           // user_id
    pub roles: Vec<String>,
    pub exp: usize,
    pub jti: String,           // JWT ID，用于关联 refresh
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshClaims {
    pub sub: String,
    pub jti: String,           // refresh token id
    pub exp: usize,
}

// === 认证用户提取器 ===
pub struct AuthUser(pub AccessClaims);

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid or missing access token".to_string()))
    }
}

// === 配置 ===
#[derive(Clone)]
pub struct AuthConfig {
    pub access_secret: String,
    pub refresh_secret: String,
    pub access_exp: Duration,
    pub refresh_exp: Duration,
}

impl AuthConfig {
    pub fn new() -> Self {
        Self {
            access_secret: std::env::var("ACCESS_SECRET").unwrap_or("access-super-secret-2026".to_string()),
            refresh_secret: std::env::var("REFRESH_SECRET").unwrap_or("refresh-ultra-secret-2026".to_string()),
            access_exp: Duration::from_secs(15 * 60),    // 15 分钟
            refresh_exp: Duration::from_secs(7 * 24 * 3600), // 7 天
        }
    }
}

// === Refresh Token 存储（生产用 Redis）===
type RefreshStore = Arc<Mutex<HashMap<String, (String, SystemTime)>>>; // jti -> (user_id, expiry)

async fn set_refresh_cookie(response: &mut Response, token: &str) {
    let cookie = format!(
        "refresh_token={}; HttpOnly; Secure; SameSite=Strict; Path=/api/refresh; Max-Age={}",
        token,
        7 * 24 * 3600
    );
    response.headers_mut().insert(
        axum::http::header::SET_COOKIE,
        axum::http::HeaderValue::from_str(&cookie).unwrap(),
    );
}

async fn clear_refresh_cookie(response: &mut Response) {
    let cookie = "refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/refresh; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    response.headers_mut().insert(
        axum::http::header::SET_COOKIE,
        axum::http::HeaderValue::from_str(cookie).unwrap(),
    );
}

// === JWT 认证中间件（Access Token）===
async fn jwt_auth_middleware(
    Extension(config): Extension<Arc<AuthConfig>>,
    TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
    mut req: Request,
    next: Next,
) -> Response {
    let token = auth.token();
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let token_data = match decode::<AccessClaims>(
        token,
        &DecodingKey::from_secret(config.access_secret.as_ref()),
        &validation,
    ) {
        Ok(data) => data,
        Err(err) => {
            error!("Access token invalid: {}", err);
            return (StatusCode::UNAUTHORIZED, "Invalid access token").into_response();
        }
    };

    req.extensions_mut().insert(AuthUser(token_data.claims));
    next.run(req).await
}

// === 登录 ===
#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

async fn login(
    Extension(config): Extension<Arc<AuthConfig>>,
    Extension(refresh_store): Extension<RefreshStore>,
    Json(payload): Json<LoginRequest>,
) -> impl IntoResponse {
    // 模拟用户验证
    if payload.username != "admin" || payload.password != "secret" {
        return (StatusCode::UNAUTHORIZED, "Invalid credentials").into_response();
    }

    let user_id = "user123".to_string();
    let jti = Uuid::new_v4().to_string();

    // Access Token
    let access_claims = AccessClaims {
        sub: user_id.clone(),
        roles: vec!["user".to_string(), "admin".to_string()],
        exp: (SystemTime::now() + config.access_exp).duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs() as usize,
        jti: jti.clone(),
    };

    let access_token = encode(
        &Header::default(),
        &access_claims,
        &EncodingKey::from_secret(config.access_secret.as_ref()),
    ).unwrap();

    // Refresh Token
    let refresh_claims = RefreshClaims {
        sub: user_id.clone(),
        jti: jti.clone(),
        exp: (SystemTime::now() + config.refresh_exp).duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs() as usize,
    };

    let refresh_token = encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(config.refresh_secret.as_ref()),
    ).unwrap();

    // 存储 refresh jti
    {
        let mut store = refresh_store.lock().unwrap();
        store.insert(jti, (user_id, SystemTime::now() + config.refresh_exp));
    }

    let mut response = Json(serde_json::json!({ "access_token": access_token })).into_response();
    set_refresh_cookie(&mut response, &refresh_token).await;
    response
}

// === 刷新 Access Token ===
async fn refresh(
    Extension(config): Extension<Arc<AuthConfig>>,
    Extension(refresh_store): Extension<RefreshStore>,
    cookie: Option<TypedHeader<Cookie>>,
    mut response: Response,
) -> Response {
    let refresh_token = match cookie {
        Some(TypedHeader(cookie)) => cookie.get("refresh_token").map(|s| s.to_string()),
        None => return (StatusCode::UNAUTHORIZED, "No refresh token").into_response(),
    };

    let refresh_token = match refresh_token {
        Some(t) => t,
        None => return (StatusCode::UNAUTHORIZED, "Missing refresh token cookie").into_response(),
    };

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    let token_data = match decode::<RefreshClaims>(
        &refresh_token,
        &DecodingKey::from_secret(config.refresh_secret.as_ref()),
        &validation,
    ) {
        Ok(data) => data,
        Err(_) => return (StatusCode::UNAUTHORIZED, "Invalid refresh token").into_response(),
    };

    let jti = token_data.claims.jti.clone();
    let user_id = token_data.claims.sub.clone();

    // 检查 jti 是否有效（未被撤销）
    {
        let store = refresh_store.lock().unwrap();
        if store.get(&jti).is_none() {
            return (StatusCode::UNAUTHORIZED, "Refresh token revoked").into_response();
        }
    }

    // 生成新 access + 新 refresh（旋转）
    let new_jti = Uuid::new_v4().to_string();
    let new_access_claims = AccessClaims {
        sub: user_id.clone(),
        roles: vec!["user".to_string(), "admin".to_string()],
        exp: (SystemTime::now() + config.access_exp).duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs() as usize,
        jti: new_jti.clone(),
    };

    let new_access_token = encode(
        &Header::default(),
        &new_access_claims,
        &EncodingKey::from_secret(config.access_secret.as_ref()),
    ).unwrap();

    let new_refresh_claims = RefreshClaims {
        sub: user_id,
        jti: new_jti.clone(),
        exp: (SystemTime::now() + config.refresh_exp).duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs() as usize,
    };

    let new_refresh_token = encode(
        &Header::default(),
        &new_refresh_claims,
        &EncodingKey::from_secret(config.refresh_secret.as_ref()),
    ).unwrap();

    // 旧 jti 失效，新 jti 生效
    {
        let mut store = refresh_store.lock().unwrap();
        store.remove(&jti);
        store.insert(new_jti, (user_id, SystemTime::now() + config.refresh_exp));
    }

    let mut res = Json(serde_json::json!({ "access_token": new_access_token })).into_response();
    set_refresh_cookie(&mut res, &new_refresh_token).await;
    res
}

// === 登出 ===
async fn logout(
    Extension(refresh_store): Extension<RefreshStore>,
    cookie: Option<TypedHeader<Cookie>>,
    mut response: Response,
) -> Response {
    if let Some(TypedHeader(cookie)) = cookie {
        if let Some(token) = cookie.get("refresh_token") {
            if let Ok(token_data) = decode::<RefreshClaims>(
                token,
                &DecodingKey::from_secret(&std::env::var("REFRESH_SECRET").unwrap_or("refresh-ultra-secret-2026".to_string()).as_bytes()),
                &Validation::new(Algorithm::HS256),
            ) {
                let mut store = refresh_store.lock().unwrap();
                store.remove(&token_data.claims.jti);
            }
        }
    }

    let mut res = (StatusCode::OK, "Logged out").into_response();
    clear_refresh_cookie(&mut res).await;
    res
}

// === Handler ===
async fn protected(auth_user: AuthUser) -> impl IntoResponse {
    format!("Hello {}! Roles: {:?}", auth_user.0.sub, auth_user.0.roles)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let config = Arc::new(AuthConfig::new());
    let refresh_store: RefreshStore = Arc::new(Mutex::new(HashMap::new()));

    let cors = CorsLayer::new()
        .allow_origin("https://your-frontend.com".parse::<axum::http::HeaderValue>()?)
        .allow_credentials(true)
        .allow_methods([axum::http::Method::GET, axum::http::Method::POST])
        .allow_headers([axum::http::header::AUTHORIZATION, axum::http::header::CONTENT_TYPE]);

    let tls_config = RustlsConfig::from_pem_file("certs/fullchain.pem", "certs/privkey.pem").await?;

    let protected_routes = Router::new()
        .route("/protected", get(protected))
        .layer(middleware::from_fn_with_state(config.clone(), jwt_auth_middleware));

    let app = Router::new()
        .route("/api/login", post(login))
        .route("/api/refresh", get(refresh))
        .route("/api/logout", post(logout))
        .nest("/api", protected_routes)
        .layer(cors)
        .layer(Extension(config))
        .layer(Extension(refresh_store))
        .layer(TraceLayer::new_for_http());

    let addr = ([0, 0, 0, 0], 443).into();
    info!("Secure JWT + Refresh Token server starting on https://{}", addr);

    axum_server::bind_rustls(addr, tls_config)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
```

## 使用流程

1. `POST /api/login` → 返回 access_token + 设置 HttpOnly refresh_token cookie
2. 客户端每次请求带 `Authorization: Bearer <access_token>`
3. Access Token 过期 → 调用 `GET /api/refresh`（自动读取 cookie）
4. 返回新 access_token + 新 refresh_token cookie（旧的失效）
5. `POST /api/logout` → 清除 cookie 并撤销 refresh token

## 生产建议

- 使用 **Redis** 替换内存 HashMap 实现分布式撤销
- 添加 refresh token 家庭（family）防同时使用
- 使用 RS256 + 公钥验证（微服务）
- 记录登录/刷新日志

## 参考资料
- OWASP Refresh Token Best Practices
- Auth0 Refresh Token Rotation
- RFC 6749 OAuth 2.0
- https://datatracker.ietf.org/doc/html/rfc6750#section-2.1

现在你拥有了一个**完整企业级认证系统**：JWT + Refresh Token Rotation + HttpOnly Cookie + 撤销支持，安全、标准、工业级。

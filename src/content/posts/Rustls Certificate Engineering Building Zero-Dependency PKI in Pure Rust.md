---
title: "🦀 Rustls 证书工程：纯 Rust 构建零依赖 PKI 体系"
description: "告别 OpenSSL，以 Rustls + rcgen 打造全栈证书系统。从 CA 自签、证书签发至 CRL 吊销，手把手实现 mTLS 安全链。零外部依赖，云原生与嵌入式场景通吃，安全可移植一手掌控。"
date: 2026-03-7T09:00:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-alexeydemidov-10345219.jpg-slimming.webp"
categories: ["Rust", "工具链", "安全", "PKI", "证书管理", "Rustls", "rcgen", "mTLS"]
authors: ["houseme"]
tags: ["Rust", "工具链", "安全", "PKI", "证书管理", "Rustls", "rcgen", "mTLS", "云原生", "嵌入式", "零依赖", "自签证书", "证书签发", "CRL吊销"]
keywords: "rust,工具链,PKI,证书管理,Rustls,rcgen,mTLS,云原生,嵌入式,安全"
draft: false
---

# 使用 Rustls 与 rcgen 生成 CA、CRL 和证书：理论剖析与实战指南

## 引言与背景总结

在 Rust 生态中，Rustls 作为高性能、安全的 TLS 实现库，主要用于配置和处理 TLS 连接，但不直接支持证书生成。为生成 CA（Certificate Authority）、CRL（Certificate Revocation List）和客户端/服务器证书，我们结合 `rcgen` crate（Rust 的证书生成库）实现。这允许纯 Rust 环境中创建自签名 CA、签发证书和 CRL，支持 mTLS 等高级场景。截至 2026 年，`rcgen` 0.12+ 已成熟，支持 ECDSA/RSA 算法和扩展字段。本指南剖析证书体系理论，并提供完整实战代码，帮助开发者从零构建安全链。背景上，随着 Rust 在云原生和嵌入式的普及，这种纯 Rust 方法避免了 OpenSSL 依赖，提升了可移植性和安全性。

## 第一章：证书体系理论剖析

### 1.1 CA 与证书链基础
- **CA（Certificate Authority）**：信任根，负责签发证书。包括根 CA（自签名）和中间 CA。证书链：客户端/服务器证书 → 中间 CA → 根 CA。
- **证书结构**：X.509 格式，包括公钥、主体（CN/SAN）、颁发者、有效期、扩展（如 KeyUsage、ExtendedKeyUsage）。
- **生成过程**：使用私钥生成 CSR（Certificate Signing Request），CA 签名 CSR 产生证书。算法：RSA/ECDSA；哈希：SHA-256+。

### 1.2 CRL 与撤销机制
- **CRL**：撤销列表，CA 发布以标记无效证书（过期、泄露）。结构：序列号列表 + 下一更新时间。DER/PEM 格式。
- **理论剖析**：CRL 解决证书生命周期问题；分发方式：HTTP/CDP 或嵌入。缺点：大小增长；替代：OCSP（在线查询，但已弃用）。在 mTLS 中，服务器加载 CRL 验证客户端证书。
- **最佳实践**：定期更新 CRL；结合短寿命证书（<7 天）减少需求。

### 1.3 客户端/服务器证书
- **服务器证书**：包含域名/IP（SAN），用于 TLS 握手。
- **客户端证书**：用于 mTLS 身份验证。
- **安全考虑**：使用 ECDSA 提升性能；添加 OCSP Must-Staple 扩展。

## 第二章：实战代码与配置

### 2.1 项目依赖（Cargo.toml）
```toml
[package]
name = "rustls-cert-gen"
version = "0.1.0"
edition = "2021"

[dependencies]
rcgen = "0.12"
rustls = "0.23"
rustls-pemfile = "2"
time = "0.3"
```

### 2.2 完整代码（src/main.rs）
```rust
use rcgen::{Certificate, CertificateParams, DistinguishedName, DnType, KeyPair, SanType, IsCa, BasicConstraints, CrlScope, RevocationReason, CrlDistributionPoint, CrlDistributionPointName};
use rustls_pemfile::{certs, private_key};
use std::fs::File;
use std::io::{self, Write};
use time::{Duration, OffsetDateTime};

fn main() -> io::Result<()> {
    // 1. 生成根 CA
    let mut ca_params = CertificateParams::new(vec!["ca.example.com".into()]);
    ca_params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
    ca_params.distinguished_name = DistinguishedName::new();
    ca_params.distinguished_name.push(DnType::CommonName, "Test CA");
    ca_params.not_before = OffsetDateTime::now_utc();
    ca_params.not_after = ca_params.not_before + Duration::days(365 * 10);

    let ca_key = KeyPair::generate()?;
    let ca_cert = Certificate::from_params(ca_params.clone())?;
    let ca_pem = ca_cert.serialize_pem_with_signer_key(&ca_key)?;
    let ca_der = ca_cert.serialize_der_with_signer_key(&ca_key)?;

    File::create("ca.crt")?.write_all(ca_pem.as_bytes())?;
    File::create("ca.key")?.write_all(ca_key.serialize_pem().as_bytes())?;

    // 2. 生成服务器证书（由 CA 签名）
    let mut server_params = CertificateParams::new(vec![SanType::DnsName("localhost".into()), SanType::IpAddress([127, 0, 0, 1].into())]);
    server_params.distinguished_name.push(DnType::CommonName, "Server");
    server_params.not_before = OffsetDateTime::now_utc();
    server_params.not_after = server_params.not_before + Duration::days(365);

    let server_key = KeyPair::generate()?;
    let server_cert = Certificate::from_params(server_params)?;
    let server_pem = server_cert.serialize_pem_with_signer(&ca_cert, &ca_key)?;
    let server_der = server_cert.serialize_der_with_signer(&ca_cert, &ca_key)?;

    File::create("server.crt")?.write_all(server_pem.as_bytes())?;
    File::create("server.key")?.write_all(server_key.serialize_pem().as_bytes())?;

    // 3. 生成客户端证书（由 CA 签名）
    let mut client_params = CertificateParams::new(vec!["client.example.com".into()]);
    client_params.distinguished_name.push(DnType::CommonName, "Client1");
    client_params.not_before = OffsetDateTime::now_utc();
    client_params.not_after = client_params.not_before + Duration::days(365);

    let client_key = KeyPair::generate()?;
    let client_cert = Certificate::from_params(client_params)?;
    let client_pem = client_cert.serialize_pem_with_signer(&ca_cert, &ca_key)?;
    let client_der = client_cert.serialize_der_with_signer(&ca_cert, &ca_key)?;

    File::create("client.crt")?.write_all(client_pem.as_bytes())?;
    File::create("client.key")?.write_all(client_key.serialize_pem().as_bytes())?;

    // 4. 生成 CRL（撤销列表）
    let mut crl_params = rcgen::RevokedCertParams::default();
    crl_params.serial_number = client_cert.params.serial_number.clone().unwrap(); // 假设撤销客户端证书
    crl_params.reason_code = Some(RevocationReason::KeyCompromise);
    crl_params.revocation_time = OffsetDateTime::now_utc();

    let crl = ca_cert.generate_crl(&[crl_params], &ca_key, OffsetDateTime::now_utc(), Duration::days(30))?;
    let crl_der = crl.der().clone();

    File::create("ca.crl.der")?.write_all(&crl_der)?;

    println!("Certificates and CRL generated successfully.");

    Ok(())
}
```

### 2.3 实战步骤剖析
1. **运行**：`cargo run`，生成文件：ca.crt/key、server.crt/key、client.crt/key、ca.crl.der。
2. **验证**：使用 `openssl x509 -in server.crt -text` 检查链；`openssl crl -in ca.crl.der -inform der -text` 检查 CRL。
3. **集成 Rustls**：加载生成的文件到 `ServerTlsConfig` 和 `ClientTlsConfig`。
4. **高级扩展**：添加 CRL 分布点（CDP）：在 params 中设置 `crl_distribution_points`。
5. **性能与安全**：ECDSA 更快；定期生成新 CRL。

## 参考资料
- rcgen 文档：https://docs.rs/rcgen
- Rustls 集成示例：https://github.com/rustls/rustls/tree/main/examples
- X.509 标准：RFC 5280


----
结合上文内容和 clap 创建为二进制可执行工具

----
以下是一个基于上文内容的完整、可独立编译的 Rust 二进制工具示例，使用 **clap** 作为命令行参数解析库，将证书生成逻辑（CA、服务器证书、客户端证书、CRL）封装成一个方便使用的 CLI 工具。

### 项目结构建议

```
rustls-cert-gen-cli/
├── Cargo.toml
├── src/
│   └── main.rs
```

### Cargo.toml

```toml
[package]
name = "rustls-cert-gen-cli"
version = "0.1.0"
edition = "2021"
description = "A simple CLI tool to generate self-signed CA, server/client certs and CRL using rcgen + rustls"
authors = ["zhigang"]
license = "MIT OR Apache-2.0"
repository = "https://github.com/yourname/rustls-cert-gen-cli"

[dependencies]
rcgen = "0.13"                  # 建议使用最新稳定版
rustls-pemfile = "2.1"
clap = { version = "4.5", features = ["derive"] }
time = { version = "0.3", features = ["formatting", "parsing"] }
anyhow = "1.0"
thiserror = "1.0"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[[bin]]
name = "cert-gen"
path = "src/main.rs"
```

### src/main.rs 完整代码

```rust
use anyhow::{Context, Result};
use clap::{Parser, Subcommand, ValueEnum};
use rcgen::{
    BasicConstraints, Certificate, CertificateParams, DistinguishedName, DnType,
    IsCa, KeyPair, RevocationReason, SanType,
};
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::fs::{self, File};
use std::io::{self, BufReader, Write};
use std::path::PathBuf;
use time::{Duration, OffsetDateTime};
use tracing::{info, warn};

#[derive(Parser)]
#[command(
    name = "cert-gen",
    version,
    about = "Generate self-signed CA, server/client certificates and CRL using rcgen",
    long_about = None
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Output directory (default: current directory)
    #[arg(short, long, default_value = ".")]
    output: PathBuf,

    /// Enable verbose output
    #[arg(short, long)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate a new self-signed root CA
    Ca {
        /// Common Name for the CA
        #[arg(long, default_value = "My Test Root CA")]
        cn: String,

        /// Validity days
        #[arg(long, default_value_t = 3650)]
        days: i64,
    },

    /// Generate server certificate signed by the CA
    Server {
        /// Path to CA certificate (PEM)
        #[arg(long, required = true)]
        ca_cert: PathBuf,

        /// Path to CA private key (PEM)
        #[arg(long, required = true)]
        ca_key: PathBuf,

        /// Common Name / DNS name for server
        #[arg(long, default_value = "localhost")]
        cn: String,

        /// Additional SAN (can be repeated)
        #[arg(long, value_name = "DNS|IP")]
        san: Vec<String>,

        /// Validity days
        #[arg(long, default_value_t = 365)]
        days: i64,
    },

    /// Generate client certificate signed by the CA
    Client {
        /// Path to CA certificate (PEM)
        #[arg(long, required = true)]
        ca_cert: PathBuf,

        /// Path to CA private key (PEM)
        #[arg(long, required = true)]
        ca_key: PathBuf,

        /// Common Name for client
        #[arg(long, default_value = "client1")]
        cn: String,

        /// Validity days
        #[arg(long, default_value_t = 365)]
        days: i64,
    },

    /// Generate CRL (Certificate Revocation List) and revoke some serial numbers
    Crl {
        /// Path to CA certificate (PEM)
        #[arg(long, required = true)]
        ca_cert: PathBuf,

        /// Path to CA private key (PEM)
        #[arg(long, required = true)]
        ca_key: PathBuf,

        /// Serial numbers to revoke (hex or decimal)
        #[arg(long, required = true, value_delimiter = ',')]
        revoke_serials: Vec<String>,

        /// CRL validity days
        #[arg(long, default_value_t = 30)]
        days: i64,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // 初始化 tracing
    let level = if cli.verbose { "debug" } else { "info" };
    tracing_subscriber::fmt()
        .with_env_filter(level)
        .init();

    fs::create_dir_all(&cli.output)
        .with_context(|| format!("Failed to create output directory: {:?}", cli.output))?;

    match cli.command {
        Commands::Ca { cn, days } => generate_ca(&cli.output, &cn, days)?,
        Commands::Server {
            ca_cert,
            ca_key,
            cn,
            san,
            days,
        } => generate_server_cert(&cli.output, &ca_cert, &ca_key, &cn, &san, days)?,
        Commands::Client {
            ca_cert,
            ca_key,
            cn,
            days,
        } => generate_client_cert(&cli.output, &ca_cert, &ca_key, &cn, days)?,
        Commands::Crl {
            ca_cert,
            ca_key,
            revoke_serials,
            days,
        } => generate_crl(&cli.output, &ca_cert, &ca_key, &revoke_serials, days)?,
    }

    info!("All operations completed successfully.");
    Ok(())
}

fn generate_ca(out_dir: &PathBuf, cn: &str, days: i64) -> Result<()> {
    info!("Generating self-signed root CA: {}", cn);

    let mut params = CertificateParams::new(vec![]);
    params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
    params.distinguished_name = DistinguishedName::new();
    params.distinguished_name.push(DnType::CommonName, cn);
    params.not_before = OffsetDateTime::now_utc();
    params.not_after = params.not_before + Duration::days(days);

    let key = KeyPair::generate()?;
    let cert = Certificate::from_params(params)?;

    let pem = cert.serialize_pem_with_signer_key(&key)?;
    let key_pem = key.serialize_pem();

    write_file(out_dir, "ca.crt", pem.as_bytes())?;
    write_file(out_dir, "ca.key", key_pem.as_bytes())?;

    info!("CA certificate and key saved to: {:?}", out_dir);
    Ok(())
}

fn generate_server_cert(
    out_dir: &PathBuf,
    ca_cert_path: &PathBuf,
    ca_key_path: &PathBuf,
    cn: &str,
    extra_sans: &[String],
    days: i64,
) -> Result<()> {
    info!("Generating server certificate for CN: {}", cn);

    let (ca_cert, ca_key) = load_ca(ca_cert_path, ca_key_path)?;

    let mut params = CertificateParams::new(vec![SanType::DnsName(cn.into())]);
    for san in extra_sans {
        if san.contains('.') && san.parse::<std::net::IpAddr>().is_ok() {
            params.subject_alt_names.push(SanType::IpAddress(san.parse()?));
        } else {
            params.subject_alt_names.push(SanType::DnsName(san.into()));
        }
    }

    params.distinguished_name.push(DnType::CommonName, cn);
    params.not_before = OffsetDateTime::now_utc();
    params.not_after = params.not_before + Duration::days(days);

    let key = KeyPair::generate()?;
    let cert = Certificate::from_params(params)?;

    let pem = cert.serialize_pem_with_signer(&ca_cert, &ca_key)?;
    let key_pem = key.serialize_pem();

    write_file(out_dir, "server.crt", pem.as_bytes())?;
    write_file(out_dir, "server.key", key_pem.as_bytes())?;

    info!("Server certificate and key saved.");
    Ok(())
}

fn generate_client_cert(
    out_dir: &PathBuf,
    ca_cert_path: &PathBuf,
    ca_key_path: &PathBuf,
    cn: &str,
    days: i64,
) -> Result<()> {
    info!("Generating client certificate for CN: {}", cn);

    let (ca_cert, ca_key) = load_ca(ca_cert_path, ca_key_path)?;

    let mut params = CertificateParams::new(vec![]);
    params.distinguished_name.push(DnType::CommonName, cn);
    params.not_before = OffsetDateTime::now_utc();
    params.not_after = params.not_before + Duration::days(days);

    let key = KeyPair::generate()?;
    let cert = Certificate::from_params(params)?;

    let pem = cert.serialize_pem_with_signer(&ca_cert, &ca_key)?;
    let key_pem = key.serialize_pem();

    write_file(out_dir, format!("client-{}.crt", cn), pem.as_bytes())?;
    write_file(out_dir, format!("client-{}.key", cn), key_pem.as_bytes())?;

    info!("Client certificate and key saved.");
    Ok(())
}

fn generate_crl(
    out_dir: &PathBuf,
    ca_cert_path: &PathBuf,
    ca_key_path: &PathBuf,
    serials: &[String],
    days: i64,
) -> Result<()> {
    info!("Generating CRL, revoking {} serials", serials.len());

    let (ca_cert, ca_key) = load_ca(ca_cert_path, ca_key_path)?;

    let mut revoked = Vec::new();
    for serial_str in serials {
        let serial = if serial_str.starts_with("0x") {
            u64::from_str_radix(&serial_str[2..], 16)?
        } else {
            serial_str.parse::<u64>()?
        };

        revoked.push(rcgen::RevokedCertParams {
            serial_number: serial.into(),
            revocation_time: OffsetDateTime::now_utc(),
            reason_code: Some(RevocationReason::Unspecified),
        });
    }

    let crl = ca_cert.generate_crl(
        &revoked,
        &ca_key,
        OffsetDateTime::now_utc(),
        Duration::days(days),
    )?;

    let crl_der = crl.der().clone();
    write_file(out_dir, "ca.crl.der", &crl_der)?;

    info!("CRL generated with {} revoked entries.", serials.len());
    Ok(())
}

// 辅助函数：加载 CA 证书和私钥
fn load_ca(cert_path: &PathBuf, key_path: &PathBuf) -> Result<(Certificate, KeyPair)> {
    let cert_pem = fs::read_to_string(cert_path)?;
    let certs = certs(&mut cert_pem.as_bytes())?
        .into_iter()
        .collect::<Vec<_>>();

    if certs.is_empty() {
        anyhow::bail!("No certificates found in {}", cert_path.display());
    }

    let key_pem = fs::read_to_string(key_path)?;
    let mut reader = BufReader::new(key_pem.as_bytes());
    let keys = pkcs8_private_keys(&mut reader)?
        .into_iter()
        .collect::<Vec<_>>();

    if keys.is_empty() {
        anyhow::bail!("No private key found in {}", key_path.display());
    }

    // 简单起见，使用第一个证书和第一个私钥
    let cert = Certificate::from_der(&certs[0])?;
    let key = KeyPair::from_pkcs8_der(&keys[0])?;

    Ok((cert, key))
}

fn write_file(dir: &PathBuf, name: impl AsRef<str>, content: &[u8]) -> Result<()> {
    let path = dir.join(name.as_ref());
    let mut file = File::create(&path)?;
    file.write_all(content)?;
    info!("Wrote file: {:?}", path);
    Ok(())
}
```

### 使用示例

```bash
# 1. 生成 CA
cert-gen ca --cn "MyCompany Root CA" --days 3650

# 2. 生成服务器证书
cert-gen server \
    --ca-cert ca.crt \
    --ca-key ca.key \
    --cn localhost \
    --san 127.0.0.1 \
    --san ::1 \
    --days 180

# 3. 生成客户端证书
cert-gen client \
    --ca-cert ca.crt \
    --ca-key ca.key \
    --cn client-alice \
    --days 90

# 4. 生成 CRL 并撤销某个序列号
cert-gen crl \
    --ca-cert ca.crt \
    --ca-key ca.key \
    --revoke-serials 12345,0xABCD1234 \
    --days 30
```

### 小结 - 推荐使用方式

```bash
# 最常用的一条命令组合（适合快速测试 mTLS）
cert-gen ca --cn "Test CA" &&
cert-gen server --ca-cert ca.crt --ca-key ca.key --cn localhost --san 127.0.0.1 &&
cert-gen client --ca-cert ca.crt --ca-key ca.key --cn client-test &&
cert-gen crl --ca-cert ca.crt --ca-key ca.key --revoke-serials 2
```

这样你就可以得到一套完整的、可用于 Tonic mTLS 的证书链 + CRL，支持后续的 Rustls 加载和验证。

如果需要更复杂的扩展（如多中间 CA、OCSP responder stub、证书模板配置文件等），可以继续在此基础上迭代。

---
title: "🦀 Rust 1.93.0 发布公告：赋能可靠高效的软件开发"
description: "Rust 团队于今日凌晨发布 1.93.0 稳定版。此次更新聚焦“静默的可靠”：musl 工具链全线升级、内联汇编可精细化裁剪、全局分配器拥抱线程本地存储，并一次性 stabilization 了 21 组 API。"
date: 2026-01-22T07:32:00Z
image: "https://static-rs.bifuba.com/images/posts/pexels-introspectivedsgn-4157094.jpg-slimming.webp"
categories: ["Rust", "实战指南", "Rust 生态","Rust 发行版", "musl", "内联汇编", "全局分配器", "API 稳定","Rust 1.93","Rust Release","Rust 更新"]
authors: ["houseme"]
tags: ["Rust", "实战指南","Rust 生态","Rust 发行版","musl","内联汇编","全局分配器","API 稳定","Rust 1.93","Rust Release","Rust 更新","MaybeUninit","切片与裸指针","Vec FFI 拆解","unchecked 算术","VecDeque 条件出列","Duration 精度","字符编码常量","格式化闭包"]
keywords: "rust,实战指南,Rust 生态,Rust 发行版,musl,内联汇编,全局分配器,API 稳定,Rust 1.93,Rust Release,Rust 更新,MaybeUninit,切片与裸指针,Vec FFI 拆解,unchecked 算术,VecDeque 条件出列,Duration 精度,字符编码常量,格式化闭包"
draft: false
---

# Rust 1.93.0 发布公告：赋能可靠高效的软件开发

Rust 团队欣喜宣布 Rust 编程语言的新版本 1.93.0 正式发布。Rust 作为一门注重安全、性能与并发性的现代编程语言，正助力全球开发者构建可靠且高效的软件系统。自诞生以来，Rust 以其独特的内存安全机制和零成本抽象理念，深受业界青睐，广泛应用于系统编程、Web 开发、嵌入式设备等领域。此次更新进一步优化了语言特性、编译器与标准库，体现了 Rust 社区对创新与稳定的不懈追求。

如果您已通过 rustup 安装了先前版本的 Rust，只需执行以下命令即可升级至 1.93.0：

```console
$ rustup update stable
```

若尚未安装 rustup，可访问 Rust 官方网站的相应页面获取，并查看[1.93.0 详细发布说明](https://doc.rust-lang.org/stable/releases.html#version-1930-2026-01-22)。若希望参与未来版本的测试，可切换至 beta 通道（`rustup default beta`）或 nightly 通道（`rustup default nightly`），并通过 GitHub 报告任何发现的问题。

## 1.93.0 稳定版亮点

### 更新捆绑的 musl 至 1.2.5

本次更新将各种 `*-linux-musl` 目标平台的 musl 版本提升至 1.2.5。此变更主要影响 x86_64、aarch64 和 powerpc64le 的静态 musl 构建，此前这些平台捆绑的是 musl 1.2.3。新版本带来了多项修复与改进，同时引入一项对 Rust 生态系统的重大变更。

对于 Rust 生态而言，此更新的核心动力在于 musl 1.2.4 中对 DNS 解析器的重大改进，并在 1.2.5 中修复了相关 bug。在使用 musl 目标进行静态链接时，这将使涉及网络的便携式 Linux 二进制文件更可靠，尤其在处理大型 DNS 记录和递归名称服务器时。

然而，1.2.4 也移除了一些遗留兼容符号，这些符号此前被 Rust libc crate 使用。为此，libc 0.2.146 已于 2023 年 6 月（2.5 年前）发布修复。我们相信此变更已在生态中充分传播，因此 Rust 目标平台现已准备好采纳此更新。更多细节请参阅先前的[公告](https://blog.rust-lang.org/2025/12/05/Updating-musl-1.2.5/)。

### 允许全局分配器使用线程本地存储

Rust 1.93.0 调整了标准库内部机制，允许用 Rust 编写的全局分配器安全使用 `thread_local!` 宏和 `std::thread::current` 函数，而无重入性担忧。通过使用系统分配器替代，此举增强了分配器的灵活性。详情请参阅[文档](https://doc.rust-lang.org/nightly/std/alloc/trait.GlobalAlloc.html#re-entrance)。

### asm! 行上的 cfg 属性

以往，若 inline 汇编的个别部分需应用 cfg，则需重复整个 asm! 块。在 1.93.0 中，现可将 cfg 直接应用于 asm! 块内的单个语句。

```rust
asm!( // 或 global_asm! 或 naked_asm!
    "nop",
    #[cfg(target_feature = "sse2")]
    "nop",
    // ...
    #[cfg(target_feature = "sse2")]
    a = const 123, // 仅在 sse2 上使用
);
```

### 语言变更

- 添加默认警告 lint：function_casts_as_integer，用于函数转换为整数的潜在问题。
- 为 extern 块外的 ... 函数参数（无模式）引入未来不兼容警告。
- 稳定化多个 s390x 向量相关目标特性及 is_s390x_feature_detected! 宏。
- 稳定化系统 ABI 下 C 风格可变参数函数的声明。
- 当使用某些关键字作为 cfg 谓词时发出错误。
- 为 repr(C) 枚举引入未来兼容警告，若其判别值无法拟合 c_int 或 c_uint。
- 为忽略 repr(C) 类型作为 repr(transparent) 部分引入未来兼容警告。
- 稳定化 asm_cfg。
- 将 deref_nullptr lint 从默认警告升级至默认拒绝。
- 在常量求值期间，支持逐字节复制指针。
- 添加默认警告 lint：const_item_interior_mutations，用于警告突变内部可变常量项的调用。
- LUB 强制转换现正确处理函数项类型及不同安全性的函数。
- 允许常量项包含对静态的可变引用（极不安全，但并非总是 UB）。

### 编译器变更

- 稳定化 -Cjump-tables=bool 标志（先前称为 -Zno-jump-tables）。
- 将 riscv64a23-unknown-linux-gnu 提升至 Tier 2（无主机工具）。

### 平台支持

有关 Rust 分层平台支持的更多信息，请参阅 Rust 的平台支持页面。

### 库变更

- 停止在 Copy trait 上内部使用特化，因其在依赖生命周期的 Copy 实现中不健全。这可能导致某些性能回归，标准库 API 现可能调用 Clone::clone 而非位拷贝。
- 使 BTree::append 在追加已存在键时不更新现有键。
- 为 vec::IntoIter<T>: UnwindSafe 不要求 T: RefUnwindSafe。

### 稳定化 API

- `<MaybeUninit<T>>::assume_init_drop`
- `<MaybeUninit<T>>::assume_init_ref`
- `<MaybeUninit<T>>::assume_init_mut`
- `<[MaybeUninit<T>]>::write_copy_of_slice`
- `<[MaybeUninit<T>]>::write_clone_of_slice`
- `String::into_raw_parts`
- `Vec::into_raw_parts`
- `<uN>::unchecked_add`
- `<uN>::unchecked_sub`
- `<uN>::unchecked_mul`
- `<iN>::unchecked_add`
- `<iN>::unchecked_sub`
- `<iN>::unchecked_mul`
- `<[T]>::as_array`
- `<[T]>::as_array_mut`
- `<*const [T]>::as_array`
- `<*mut [T]>::as_array_mut`
- `VecDeque::pop_front_if`
- `VecDeque::pop_back_if`
- `Duration::from_nanos_u128`
- `char::MAX_LEN_UTF8`
- `char::MAX_LEN_UTF16`
- `std::fmt::from_fn`
- `std::fmt::FromFn`
- `<iN>::unchecked_neg`
- `<iN>::unchecked_shl`
- `<iN>::unchecked_shr`
- `<uN>::unchecked_shl`
- `<uN>::unchecked_shr`

### Cargo 变更

- 根据配置文件在构建脚本中启用 CARGO_CFG_DEBUG_ASSERTIONS。
- 在 cargo tree 中，支持 --format 变量的长形式。
- 为 cargo clean 添加 --workspace 选项。

### Rustdoc 变更

- 移除 #![doc(document_private_items)]。
- 在搜索过滤器中包含属性和派生宏的“macros”。
- 在搜索过滤器中包含外部 crate 的 import。
- 验证 crate 级 doc 属性的使用。若 html_favicon_url、html_logo_url 等缺少值、意外值或类型错误，rustdoc 将发出默认拒绝 lint：rustdoc::invalid_doc_attributes。

### 兼容性注意事项

- 将 pin_v2 引入内置属性命名空间。
- 更新捆绑 musl 至 1.2.5。
- 在 Emscripten 上，使用 panic=unwind 编译时的展开 ABI 从 JS 异常处理 ABI 变更为 wasm 异常处理 ABI。若链接 C/C++ 与 Rust 对象文件，现需向链接器传递 -fwasm-exceptions。在 nightly Rust 上，可通过 -Zwasm-emscripten-eh=false -Zbuild-std 获取旧行为，但未来将移除。
- #[test] 属性先前在无意义处（如 trait 方法或类型）被忽略。现将导致错误，并在生成 rustdoc 时可能出错。
- Cargo 现在更多情况下设置 CARGO_CFG_DEBUG_ASSERTIONS 环境变量。这将导致依赖 static-init 1.0.1 至 1.0.3 的 crate 编译失败。详情见相关 issue。
- offset_of! 宏中用户编写的类型现被检查是否良好形成。
- cargo publish 在 build.build-dir 配置未设置时，不再为用户访问发出 .crate 文件作为最终产物。

## 其他变更

查看 Rust、Cargo 和 Clippy 中的所有变更详情。

## 1.93.0 贡献者

Rust 1.93.0 的诞生离不开众多贡献者的共同努力。我们衷心感谢每一位参与者！

Rust 社区一贯秉持开源精神，鼓励开发者参与贡献。此次更新不仅提升了语言的稳定性和功能性，更体现了 Rust 在追求卓越中的谦逊与包容。如古语云：“工欲善其事，必先利其器。”Rust 1.93.0 正如一把更锋利的利器，助力开发者在编程之路上行稳致远。期待更多创新应用，推动软件行业可持续发展。

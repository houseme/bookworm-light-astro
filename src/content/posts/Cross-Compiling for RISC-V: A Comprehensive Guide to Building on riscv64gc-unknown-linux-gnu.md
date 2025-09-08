---
title: "Cross-Compiling for RISC-V: A Comprehensive Guide to Building on riscv64gc-unknown-linux-gnu"
description: "The RISC-V architecture, with its open-source instruction set, has sparked a revolution in hardware design, offering flexibility and accessibility for developers worldwide."
date: 2025-04-11T00:00:00Z
image: "https://riscv.org/wp-content/uploads/2021/02/Standard_2-1920x1080-1.jpg"
categories: ["Rust", "RISC-V", "Cross", "Compiling", "Linux", "QEMU"]
authors: ["houseme"]
tags:
  [
    "rust",
    "RISC-V",
    "Cross",
    "Compiling",
    "riscv64gc-unknown-linux-gnu",
    "gcc-riscv64-linux-gnu",
    "qemu-user",
    "libssl-dev",
    "libdbus-1-dev",
    "libwayland-dev",
    "libwebkit2gtk-4.1-dev",
    "libxdo-dev",
    "lld",
    "pkg-config",
    "build-essential",
    "openssl",
  ]
keywords: "rust,RISC-V,Cross,Compiling,riscv64gc-unknown-linux-gnu,gcc-riscv64-linux-gnu,qemu-user,libssl-dev,libdbus-1-dev,libwayland-dev,libwebkit2gtk-4.1-dev,libxdo-dev,lld,pkg-config,build-essential,openssl"
draft: false
---

# Cross-Compiling for RISC-V: A Comprehensive Guide to Building on `riscv64gc-unknown-linux-gnu`

## Introduction

The RISC-V architecture, with its open-source instruction set, has sparked a revolution in hardware design, offering
flexibility and accessibility for developers worldwide. As RISC-V gains traction in embedded systems, IoT, and even
high-performance computing, the ability to cross-compile software for RISC-V targets like `riscv64gc-unknown-linux-gnu`
becomes a critical skill. This guide takes you from zero to hero, providing a step-by-step, hands-on tutorial for
setting up a robust cross-compilation environment on a Linux system, specifically targeting the
`riscv64gc-unknown-linux-gnu` architecture.

Whether you're building a lightweight application for a RISC-V single-board computer or contributing to open-source
projects, this tutorial blends theory with practical examples, ensuring you understand both the "how" and the "why."
We'll cover toolchain setup, dependency installation, Rust and C/C++ cross-compilation, and even emulate the compiled
binaries using QEMU. By the end, you'll have a working binary running on a simulated RISC-V environment, along with the
confidence to tackle real-world RISC-V projects.

Let's dive into the world of RISC-V with precision and a touch of elegance.

---

## Prerequisites

Before we begin, ensure you have:

- A Linux system (Ubuntu 20.04 or later recommended).
- Administrative privileges (`sudo`) for installing dependencies.
- Basic familiarity with terminal commands and programming in C/C++ or Rust.
- An internet connection for downloading tools and dependencies.

---

## Step 1: Understanding the Target and Toolchain

### What is `riscv64gc-unknown-linux-gnu`?

The target triple `riscv64gc-unknown-linux-gnu` describes:

- **Architecture**: `riscv64` (64-bit RISC-V).
- **Extension**: `gc` (includes general-purpose extensions: I, M, A, F, D, C for integer, multiplication, atomic,
  floating-point, double-precision, and compressed instructions).
- **Vendor**: `unknown` (no specific vendor).
- **OS**: `linux` (Linux operating system).
- **ABI**: `gnu` (GNU C Library, glibc).

This is a common target for RISC-V Linux systems, compatible with devices like the SiFive HiFive Unleashed or VisionFive
boards.

### Why Cross-Compile?

Cross-compilation allows you to build software on one system (e.g., x86_64 Linux) for a different architecture (RISC-V).
This is essential when:

- The target device lacks the resources to compile code natively.
- You want to streamline development on a more powerful host machine.

### Toolchain Overview

To cross-compile, we need:

- A **compiler** (e.g., `gcc-riscv64-linux-gnu` for C/C++, Rust for Rust code).
- **Linker** and libraries compatible with the target (e.g., `lld`, `libssl-dev`).
- **Emulator** (`qemu-user`) to test binaries without physical hardware.
- Additional libraries for specific features (e.g., `libwebkit2gtk-4.1-dev` for webkit support, `libwayland-dev` for
  Wayland).

---

## Step 2: Setting Up the Environment

### Installing Dependencies

Let's install the required dependencies on an Ubuntu-based system. Open a terminal and run:

```bash
sudo apt-get update
sudo apt-get install -y \
  gcc \
  pkg-config \
  libssl-dev \
  lld \
  libdbus-1-dev \
  libwayland-dev \
  libwebkit2gtk-4.1-dev \
  libxdo-dev \
  build-essential \
  openssl \
  gcc-riscv64-linux-gnu \
  qemu-user
```

### Explanation of Dependencies

- **gcc, build-essential**: Provides the base C/C++ compiler and build tools.
- **gcc-riscv64-linux-gnu**: Cross-compiler for RISC-V 64-bit.
- **lld**: A fast linker, useful for cross-compilation.
- **libssl-dev, openssl**: Cryptography libraries for secure applications.
- **libdbus-1-dev**: For D-Bus communication (inter-process communication).
- **libwayland-dev**: For Wayland protocol support (modern display server).
- **libwebkit2gtk-4.1-dev**: For embedding web content in GTK applications.
- **libxdo-dev**: For X11 automation (e.g., mouse/keyboard simulation).
- **qemu-user**: Emulates RISC-V binaries on the host system.
- **pkg-config**: Helps locate libraries during compilation.

Verify the installation:

```bash
gcc-riscv64-linux-gnu-gcc --version
qemu-riscv64 --version
```

You should see version information for the RISC-V GCC toolchain and QEMU.

---

## Step 3: Cross-Compiling a C Program

Let's start with a simple C program to demonstrate the cross-compilation process.

### Example: Hello World in C

Create a file named `hello.c`:

```c
#include <stdio.h>

int main() {
    printf("Hello, RISC-V World!\n");
    return 0;
}
```

### Compiling for RISC-V

Compile the program using the RISC-V GCC toolchain:

```bash
riscv64-linux-gnu-gcc -o hello_riscv hello.c
```

This generates a binary `hello_riscv` for the RISC-V architecture.

### Verifying the Binary

Check the binary's architecture:

```bash
file hello_riscv
```

Output:

```
hello_riscv: ELF 64-bit LSB executable, RISC-V, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux-riscv64-lp64d.so.1, for GNU/Linux 5.4.0, not stripped
```

### Running with QEMU

Since you likely don't have RISC-V hardware, use QEMU to emulate:

```bash
qemu-riscv64 ./hello_riscv
```

Output:

```
Hello, RISC-V World!
```

If you encounter a library error (e.g., missing `libc`), ensure your system has the appropriate RISC-V libraries or use
a static build:

```bash
riscv64-linux-gnu-gcc -static -o hello_riscv hello.c
qemu-riscv64 ./hello_riscv
```

Static linking bundles all dependencies, making the binary portable.

---

## Step 4: Cross-Compiling with Rust

Rust is a modern systems programming language with excellent cross-compilation support, making it ideal for RISC-V
projects.

### Installing Rust

Install Rust using `rustup`:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

Verify:

```bash
rustc --version
```

### Adding the RISC-V Target

Add the `riscv64gc-unknown-linux-gnu` target to Rust:

```bash
rustup target add riscv64gc-unknown-linux-gnu
```

### Creating a Rust Project

Create a new Rust project:

```bash
cargo new riscv_hello
cd riscv_hello
```

Edit `src/main.rs`:

```rust
fn main() {
    println!("Hello, RISC-V from Rust!");
}
```

### Configuring the Linker

Rust requires a linker for the target architecture. Create a `.cargo/config.toml` file in the project directory:

```toml
[target.riscv64gc-unknown-linux-gnu]
linker = "riscv64-linux-gnu-gcc"
```

This tells Cargo to use the RISC-V GCC linker.

### Building the Project

Build for RISC-V:

```bash
cargo build --target riscv64gc-unknown-linux-gnu --release
```

The binary is located at `target/riscv64gc-unknown-linux-gnu/release/riscv_hello`.

### Running with QEMU

Run the binary:

```bash
qemu-riscv64 target/riscv64gc-unknown-linux-gnu/release/riscv_hello
```

Output:

```
Hello, RISC-V from Rust!
```

---

## Step 5: Advanced Example – Building a Webkit-Based Application

Let's build a more complex application using WebkitGTK to demonstrate the use of `libwebkit2gtk-4.1-dev`.

### C Example: Mini Web Browser

Create `mini_browser.c`:

```c
#include <webkit2/webkit2.h>
#include <gtk/gtk.h>

static void destroy_window_cb(GtkWidget* widget, gpointer data) {
    gtk_main_quit();
}

int main(int argc, char* argv[]) {
    gtk_init(&argc, &argv);

    GtkWidget* window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_window_set_title(GTK_WINDOW(window), "RISC-V Mini Browser");
    gtk_window_set_default_size(GTK_WINDOW(window), 800, 600);

    GtkWidget* web_view = webkit_web_view_new();
    GtkWidget* scrolled_window = gtk_scrolled_window_new(NULL, NULL);
    gtk_container_add(GTK_CONTAINER(scrolled_window), web_view);
    gtk_container_add(GTK_CONTAINER(window), scrolled_window);

    g_signal_connect(window, "destroy", G_CALLBACK(destroy_window_cb), NULL);

    webkit_web_view_load_uri(WEBKIT_WEB_VIEW(web_view), "https://www.example.com");

    gtk_widget_show_all(window);
    gtk_main();

    return 0;
}
```

### Compiling with Dependencies

Compile the program, linking against WebkitGTK and GTK:

```bash
riscv64-linux-gnu-gcc -o mini_browser mini_browser.c \
  $(pkg-config --cflags --libs webkit2gtk-4.1 gtk+-3.0)
```

### Running with QEMU

Running GUI applications in QEMU is tricky without a full system emulator. For testing, you may need a RISC-V device or
a full QEMU system emulation setup. Alternatively, verify the binary:

```bash
file mini_browser
```

If you have a RISC-V device with a graphical environment, transfer and run:

```bash
qemu-riscv64 ./mini_browser
```

---

## Step 6: Troubleshooting Common Issues

1. **Missing Libraries**:

- Error: `cannot find -lssl` or similar.
- Solution: Ensure `libssl-dev` and other `-dev` packages are installed.

2. **Linker Errors**:

- Error: `unknown target`.
- Solution: Verify the linker (`riscv64-linux-gnu-gcc`) is in your PATH.

3. **QEMU Fails**:

- Error: `qemu-riscv64: Could not open ...`.
- Solution: Use static linking (`-static`) or install RISC-V libraries.

4. **Rust Target Not Found**:

- Error: `target 'riscv64gc-unknown-linux-gnu' not found`.
- Solution: Run `rustup target add riscv64gc-unknown-linux-gnu`.

---

## Step 7: Best Practices and Optimization

- **Static Linking**: Use `-static` for portability when targeting devices without matching libraries.
- **Optimize Binaries**: Use `-O2` or `-O3` for performance, e.g., `riscv64-linux-gnu-gcc -O2 -o hello hello.c`.
- **Minimal Dependencies**: Only include necessary libraries to reduce binary size.
- **Testing**: Always verify binaries with `file` and test with QEMU before deploying.
- **Toolchain Updates**: Regularly update `apt-get` packages and `rustup` to avoid compatibility issues.

---

## Conclusion

Cross-compiling for `riscv64gc-unknown-linux-gnu` opens the door to the exciting world of RISC-V development. From
simple "Hello World" programs to sophisticated Webkit-based applications, this guide has equipped you with the tools,
knowledge, and confidence to build and test RISC-V software. By leveraging GCC, Rust, and QEMU, you can prototype and
deploy applications without needing physical hardware.

RISC-V's open nature invites innovation, and your journey has just begun. Experiment with more complex projects, explore
kernel development, or contribute to the RISC-V ecosystem. The future is open—build it with elegance and precision.

---

## Additional Resources

- [RISC-V Official Website](https://riscv.org/)
- [Rust Cross-Compilation Guide](https://rust-lang.github.io/rustup/cross-compilation.html)
- [QEMU Documentation](https://www.qemu.org/docs/master/)
- [WebkitGTK Documentation](https://webkitgtk.org/)

---

This guide assumes Ubuntu as the host system. For other distributions, adjust package names (e.g., use `dnf` for
Fedora). If you encounter specific issues or want to dive deeper into a topic, let me know!

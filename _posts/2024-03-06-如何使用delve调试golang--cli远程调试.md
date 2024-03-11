---
layout: post
title:  "如何使用 delve 调试 golang -- cli 远程调试"
date: 2024-03-06 15:23:00 +0800
categories: ["tool", "golang"]
tags: ["tool", "golang"]
---

工欲善其事，必先利其器。对于一个开发者而言，学会如何调试是非常重要的。而在学习调试技能的过程中，我们需要选择合适的调试工具。这篇文章将会介绍如何使用 delve 调试 golang 代码。

## 如何使用 delve

delve 是一个 golang 的调试工具，它可以帮助我们调试 golang 代码。delve 支持本地调试和远程调试。在这篇文章中，将主要介绍如何使用 delve 进行远程调试，同时也会简单介绍他的安装以及基本使用方法。

### 安装

安装可以参考 [delve 官方文档](https://github.com/go-delve/delve/tree/master/Documentation/installation#installation)。

简单介绍一下在 golang (1.16 版本以上)环境中的安装方法：

```bash
# Install the latest release:
$ go install github.com/go-delve/delve/cmd/dlv@latest

# Install at tree head:
$ go install github.com/go-delve/delve/cmd/dlv@master

# Install at a specific version or pseudo-version:
$ go install github.com/go-delve/delve/cmd/dlv@v1.7.3
$ go install github.com/go-delve/delve/cmd/dlv@v1.7.4-0.20211208103735-2f13672765fe
```

### 示例

安装完成之后，我将会通过一个示例来介绍如何使用 delve 进行远程调试。

**主要适用调试场景**：调试远程服务或者调试容器内服务。

**远程环境**：Linux 操作系统（CentOS、Ubuntu、Debian 等都可以），示例将会演示在 Ubuntu 远程服务器(IP: 192.168.1.10)中使用 Ubuntu 容器启动服务。

**本地环境**：必须有对应的 golang 版本并且有对应的代码和依赖类库。

**代码地址**：[remotedlv](https://github.com/cherubic/blogcode/tree/main/remotedlv)

**项目结构**：

```plaintext
- remotedlv
  | - main.go # 服务代码，启动了一个 http 服务
  | - go.mod  # 依赖文件
  | - dockerfile  
    | - Dockerfile.dev # 开发编译镜像
  | - hack
    | - dev.sh  # 编译脚本
```

首先是编译代码，可以使用 `hack/dev.sh` 脚本来编译代码，会生成 Linux 二进制文件到本地，以及构建一个 docker 镜像。

```bash
# 编译 linux x86_64 二进制文件 remotedlv，以及构建 docker 镜像
./hack/dev.sh build
```

启动容器，但是暂时不运行对应的服务。

```bash
# 启动容器后，执行等待命令
./hack/dev.sh run
```

有两种可以进行远程调试的方式：

1. 通过 `dlv exec` 命令，直接运行二进制文件，然后通过 `dlv connect` 命令连接。

    ```bash
    # 使用 dlv exec 命令启动服务
    # --listen=:4000 表示监听 4000 端口
    # --headless=true 表示以无头模式运行
    # --api-version=2 表示使用 API 版本 2
    # --accept-multiclient 表示接受多客户端连接
    # --continue 表示启动后立即运行
    docker exec -d remotedlv bash -c "/dlv exec --listen=:4000 --headless=true --api-version=2 --accept-multiclient --continue -- /app/remotedlv"

    # 本地机器连接到服务
    dlv connect 192.168.1.10:4000
    ```

2. 通过 `dlv attach` 命令，直接连接到运行中的服务。这个仅仅适用于容器内的服务，并且更适合于对运行中的服务进行调试。

    ```bash
    # 创建和宿主机相同的用户，否则会出现权限问题
    docker exec remotedlv bash -c "adduser $USER"

    # 使用创建的用户运行服务
    docker exec -d -u $USER remotedlv /app/remotedlv

    # 在服务器中找到对应的进程
    ps -ef | grep remotedlv | awk '{print $2}' | head -n 1

    # 远程服务器宿主机调试器附加到服务
    dlv attach --listen=:2333 --headless=true --api-version=2 --accept-multiclient <pid>

    # 本地机器连接到服务
    dlv connect 192.168.1.10:2333
    ```

> 注意事项：
> 对于本机 golang 类库地址与容器内地址不一致的情况，首先在编译的时候需要使用 `-gcflags="all=-trimpath` 或者 `-trimpath` 参数，然后在 `dlv connect` 之后需要配置 `config substitute-path /from/path /to/path` 来替换对应的路径。详细可以参考 [delve 官方文档](https://github.com/go-delve/delve/blob/master/Documentation/cli/substitutepath.md#path-substitution-configuration)。
> 如果 `dlv connect` 出现问题则优先排查网络连接以及端口开发的问题。

## 总结

本文主要介绍了如何使用 delve 进行远程调试 golang 代码。主要涉及 `dlv exec` 和 `dlv attach` 两种方式，这两种方式偏向于使用 cli 也就是命令行的方式进行调试。其实还有一种新的方式是通过 `dlv dap` 主要是配合 vscode/GoLand 等编辑器使用。后续有机会在进行介绍。

## 参考

- [delve 官方文档](https://github.com/go-delve/delve/blob/master/Documentation/faq.md#-how-can-i-use-delve-for-remote-debugging)
- [博客：dlv命令行的远程调试 golang 进程步骤(包含容器进程)](https://zhangguanzhang.github.io/2021/07/20/dlv-remote/#/%E9%9D%9E%E6%8E%A5%E5%8F%A3%E7%B1%BB%E6%9C%8D%E5%8A%A1%E5%AE%B9%E5%99%A8%E5%86%85%E8%B0%83%E8%AF%95)

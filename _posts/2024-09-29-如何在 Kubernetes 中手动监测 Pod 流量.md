---
layout: post
title:  "如何在 Kubernetes 中手动监测 Pod 流量"
date:   2024-09-28 11:31:00 +0800
categories: ["kubernetes", "docker", "network", "containerd"]
tags: [kubernetes, docker, network, containerd]
---

## 简介

本篇博客介绍如何在 Kubernetes 环境中手动监测 Pod 的流量，避免依赖复杂的第三方监控系统。文章聚焦于使用基础工具，在无法引入 `prometheus` 等监控系统的情况下，通过系统原生工具实现流量监测。适用于追求最小化依赖的特殊环境。

## 问题

在 Kubernetes 集群中，通常情况下需要通过监控系统如 `prometheus` 等来监测 Pod 流量，但当这些工具不可用、或因运行限制无法更换镜像时，如何实现对 Pod 流量的手动监测？本文介绍如何在不干扰运行容器的情况下监测其流量。

## 解决方案

对于 Kubernetes 要有基本的了解，以及对于 `linux` 网络有一定了解，才能从中找到解决方案。接下来我将会介绍一下所用到的一些基础知识以及工具，以及最终的解决方案。

### 基础知识以及相关工具

基础知识：

1. Kubernetes 相关知识：
   Kubernetes 的网络模型为每个 Pod 分配一个独立的 IP 地址，并通过 Pod 网络管理集群中的通信。Pod 之间的通信是通过网络命名空间隔离的，而容器之间的通信是通过 Linux 网桥实现的。
2. 容器网络模型：
   Kubernetes 默认使用 bridge 模式来管理 Pod 的通信，这种模式利用 Linux 内核中的虚拟网桥设备，使容器之间可以通过网络命名空间隔离并共享网络资源。简单来说，我们只需找到对应的网桥接口，即可通过 Linux 工具进行流量监测。

工具概览：

1. `tcpdump`: 一个网络抓包工具，可以用来抓取网络数据包，分析网络问题。
2. `nsenter`: 一个进入到指定的命名空间的工具，可以用来进入到容器的网络命名空间，查看容器的网络信息。

### 最终解决方案

了解基础知识以及相关工具后，对于 Kubernetes 中 Pod 的网络有一个大概的认识：Linux 宿主机通过创建网桥来连接宿主机与容器，容器与容器的网络，而 Kubernetes 的 Pod 是建立在这个机制之上的。因此如果我们想要监测 Pod 流量，等同于监测 Pod 所使用的网桥的流量，并且网桥是在 Linux 宿主机中可以看到，也就避免了破坏或者入侵容器进行一些操作。再配合使用 `tcpdump` 工具，则可以完成整个监测链路。具体方案如下：

1. 获取 Pod 所在节点和 PID。
2. 在节点上找到 PID 对应的网络接口。
3. 使用 `tcpdump` 监测接口流量，保存到文件便于分析。

## 相关工具以及脚本

```bash
# 获取 Pod 所在节点和 PID
kubectl get pod -n <namespace> -o wide
kubectl get pod <pod-name> -n $  -o jsonpath='{.status.containerStatuses[0].containerID}' | cut -d '/' -f 3
docker inspect <container-id> | jq '.[0].State.Pid'
# 在节点上找到 PID 对应的网络接口
nsenter -t <PID> -n ip addr | grep eth0@ | cut -d ':' -f 2 | sed 's/eth0@if//g' 
ip a | grep <network-index> | cut -d ':' -f 2 | cut -d '@' -f 1
# 使用 tcpdump 监测接口流量
tcpdump -i <network-name> -w <output-file>
```

完整代码可以参考 **代码地址**：[monitor-pod-net](https://github.com/cherubic/blogcode/tree/main/monitor-pod-net)

## 总结

本文介绍了如何在 Kubernetes 中手动监测 Pod 流量的操作步骤，适用于受限于工具引入的环境。我们通过了解 Kubernetes 的网络模型、容器通信方式及 Linux 命名空间，结合 `tcpdump` 工具，实现在不改变镜像和不干扰容器的情况下对 Pod 流量进行分析。这种手动流量监测方式简单实用，适合于集群中网络异常排查等场景。

## 参考

- [Kubernetes 网络模型](https://kubernetes.io/zh/docs/concepts/cluster-administration/networking/)
- [Linux cgroup 命名空间](https://man7.org/linux/man-pages/man7/cgroup_namespaces.7.html)
- [tcpdump 使用文档](https://www.tcpdump.org/manpages/tcpdump.1.html)
- [nsenter 使用文档](https://man7.org/linux/man-pages/man1/nsenter.1.html)
- [Docker 容器网络模型](https://docs.docker.com/network/)
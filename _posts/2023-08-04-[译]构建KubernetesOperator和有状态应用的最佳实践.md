---
layout: post
title:  "[译]构建 Kubernetes Operator 和有状态应用的最佳实践"
date:   2023-08-04 16:10:00 +0800
categories: ["kubernetes", "operator"]
tags: ["translate", "kubernetes", "operator"]
---

refer: [Best practices for building Kubernetes Operators and stateful apps](https://cloud.google.com/blog/products/containers-kubernetes/best-practices-for-building-kubernetes-operators-and-stateful-apps)

最近，Kubernetes 社区开始支持运行大规模有状态应用，如数据库、分析和机器学习。例如，您可以使用 [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) 工作负载控制器来为每个 Pod 维护标识，并使用持久卷（ [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) ）持久化数据，以便在服务重新启动后数据仍然存活。如果您的工作负载依赖于本地存储，您可以使用 [PersistentVolumes 与 Local SSD](https://cloud.google.com/kubernetes-engine/docs/how-to/persistent-volumes/local-ssd) ，还可以使用 [SSD 持久磁盘作为引导磁盘](https://cloud.google.com/kubernetes-engine/docs/how-to/custom-boot-disks)，以改进不同类型工作负载的性能。

然而，对于许多高级用例，如备份、恢复和高可用性，这些核心的 Kubernetes 原语可能不足够。这就是 [Kubernetes Operator](https://github.com/operator-framework) 的用武之地。它们通过使用[自定义资源](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/)和自定义控制器为 Kubernetes 功能提供了扩展，以应用程序特定的逻辑来扩展 Kubernetes 功能。使用 Operator 模式，您可以将特定应用程序的领域知识编码到 Kubernetes API 扩展中。使用这种方法，您可以像处理内置资源（例如 Pods ）一样使用 `kubectl` 来创建、访问和管理应用程序。

在 Google Cloud ，我们使用 Operator 来更好地支持 Kubernetes 上的不同应用程序。例如，我们为在 Kubernetes 中以本机方式运行和管理 [Spark](https://github.com/GoogleCloudPlatform/spark-on-k8s-operator) 和 [Airflow](https://github.com/GoogleCloudPlatform/airflow-operator) 应用程序创建了 Operator。我们还将这些 Operator 提供在 [GCP Marketplace](https://console.cloud.google.com/marketplace/browse?filter=solution-type:k8s&_ga=2.268432846.-1350438422.1709107647) 上，以便轻松地点击部署。 Spark Operator 会自动代表用户运行 `spark-submit` ，提供定时运行 Spark 作业的 `cron` 支持，支持自动应用重启和重试，并支持从本地 Hadoop 配置和 Google Cloud Storage 挂载数据。 Airflow Operator 会为 Airflow 部署创建和管理必要的 Kubernetes 资源，并支持创建具有不同执行器的 Airflow 调度程序。

作为开发人员，我们在构建这些 Operator 时学到了很多东西。如果您正在编写自己的 Operator 来管理 Kubernetes 应用程序，以下是我们推荐的一些最佳实践。

1. 为每个应用程序开发一个 Operator

    一个 Operator 可以自动化应用程序的各种功能，但它应该特定于单个应用程序。例如，Airflow 通常与 MySQL 和 Redis 一起使用。您应该为每个应用程序开发一个 Operator（即三个  Operator ），而不是一个涵盖所有三个应用程序的单个 Operator。这样可以更好地将每个应用程序的领域专业知识分开。

2. 使用类似 [Kubebuilder](https://github.com/kubernetes-sigs/kubebuilder) 的 SDK

    Kubebuilder 是用于构建和发布 Kubernetes API 和控制器的综合开发工具包，使用[自定义资源定义（ CRDs ）](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/) 。使用 Kubebuilder ，您可以轻松地编写 Operator，无需了解Kubernetes库的所有低级细节。欲了解更多信息，请查看 Kubebuilder [书籍](http://book.kubebuilder.io/)。

3. 使用声明式 API

    为 Operator 设计声明式API ，而不是命令式 API 。这与 Kubernetes 的 API 本质上是[声明式](https://kubernetes.io/docs/concepts/overview/object-management-kubectl/declarative-config/)的相吻合。通过声明式 API ，用户只需要表达他们所需的群集状态，而 Operator 会执行所有必要的步骤来实现它。相反，通过命令式 API ，用户必须明确并按顺序指定执行所需状态的每个步骤。

4. 通过多个控制器对功能进行分隔

    一个应用程序可能具有不同的功能，如缩放、备份、恢复和监控。 Operator 应由多个专门处理这些功能的控制器组成。例如， Operator 可以有一个主控制器来生成和管理应用程序实例，一个备份控制器来处理备份操作，一个恢复控制器来处理恢复操作。这通过更好的抽象和简化的同步循环简化了开发过程。请注意，每个控制器应对应一个特定的 [CRD](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/) ，以便每个控制器的责任领域明确。

5. 使用异步同步循环

    如果 Operator 在将当前群集状态与期望状态进行调和时检测到错误（例如，创建 Pod 失败），它应立即终止当前的同步调用并返回错误。然后，工作队列应在稍后的时间安排重新同步；同步调用不应通过继续轮询群集状态来阻塞应用程序，直到错误被解决。同样地，发起和监视长时间运行操作的控制器不应同步等待操作。相反，控制器应该再次进入睡眠状态并稍后进行检查。

**监视和记录您的应用程序**

一旦您编写了自己的 Operator，您将需要为您的应用程序启用日志记录和监视。对于新手来说，这可能会很复杂。以下是您可以遵循的一些最佳实践。

1. 进行应用程序级别、节点级别和群集级别的日志聚合

    Kubernetes 集群可能会变得庞大，尤其是具有有状态应用程序的集群。如果为每个容器保留日志，您可能会得到无法管理的大量日志。为了解决这个问题，您可以对日志进行聚合。您可以通过聚合容器日志并过滤满足特定严重性和详细程度日志级别的日志消息来执行应用程序级日志记录。应用程序级别的聚合需要能够识别哪个应用程序的日志所属。为此，您可能需要将应用程序特定的细节集成到日志消息中，比如为应用程序名称添加前缀。

    同样地，对于节点级和群集级日志记录，您可以聚合一个节点或群集内的所有应用程序级日志。Kubernetes 本身不支持这一点，因此您可能需要使用外部日志记录工具，如 Google Stackdriver、 Elasticsearch、 Fluentd 或 Kibana 进行聚合。

2. 为了更容易查看、聚合和分析，正确标记您的度量指标

    我们建议为度量指标添加标签，以便监控系统可以轻松进行聚合和分析。例如，如果您正在使用 Prometheus 来分析您的 Prometheus 样式度量指标，添加的标签有助于系统在查询和聚合指标时帮助系统。

3. 通过Pod端点公开应用程序指标以供抓取

    与将应用程序指标写入日志、文件或其他存储介质相比，一个更可行的选择是应用程序 Pod 公开一个指标HTTP端点供监视工具抓取。这样提供了更好的可发现性、统一性，并且与度量分析工具（如 Google Stackdriver ）进行集成。实现这一点的好方法是使用开源应用程序特定的导出器（ exporters ）来公开Prometheus样式指标。

在 Kubernetes 上运行有状态应用程序与在虚拟机上运行一样简单的工作还有很多要做，但是有了使用 Kubernetes Operator 编写自定义控制器的能力，我们已经取得了长足的进步。

有关 Kubernetes 和 Google Kubernetes Engine（GKE） 开发人员体验的更多见解，请查看以下最近的帖子：对于拥有小型环境的开发人员，了解我们如何让入门变得更加简单和经济实惠，对于希望直接从开发人员学习的人，请参阅我们的[精选演讲清单](https://cloud.google.com/blog/products/containers-kubernetes/watch-and-learn-kubernetes-and-gke-for-developers)，涵盖各种重要主题。在接下来的几周中，我们将发布更多关于Kubernetes开发人员体验的内容，敬请关注我们的[系列](https://cloud.google.com/blog/products/containers-kubernetes)并关注我们的 @GCPcloud 获取最新信息。

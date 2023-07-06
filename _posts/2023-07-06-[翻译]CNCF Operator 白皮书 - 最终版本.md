---
layout: post
title:  "[翻译]CNCF Operator 白皮书 - 最终版本"
date:   Thu Jul 6 15:01:51 2023 +0800
categories: ["kubernetes", "operator"]
tags: ["translate", "kubernetes", "operator"]
---

refer: [CNCF Operator White Paper - Review Version](https://github.com/cncf/tag-app-delivery/blob/163962c4b1cd70d085107fc579e3e04c2e14d59c/operator-whitepaper/v1/Operator-WhitePaper_v1-0.md)

## 摘要

维护应用程序基础架构需要许多重复的人工活动，这些活动缺乏持久价值。计算机是执行精确任务、验证对象状态并因此使基础架构需求能够被编码的首选方法。Operator通过封装应用程序的所需活动、检查和状态管理，提供了一种方式。

在 Kubernetes 中，Operator通过扩展 API 的功能提供智能的动态管理能力。

这些Operator组件可以自动化常见流程，以及可以持续适应其环境的反应性应用程序。这反过来可以实现更快的开发、更少的错误、更低的恢复时间和增加的工程自主权。

鉴于Operator模式的日益流行，有必要提供一份参考文献，以帮助初学者和专家从社区认可的最佳实践中学习和实现他们的目标。在本文档中，我们不仅概述了Operator的分类法，还介绍了Operator应用管理系统的推荐配置、实施和用例。

## 引言

本白皮书对Operator的范围进行了更广泛的定义，而不仅限于 Kubernetes。它描述了Operator的特性和组件，概述了当前使用的常见模式，并解释了它们与 Kubernetes Controller的区别。

此外，它详细介绍了Operator的功能，包括备份、恢复和自动配置调优。深入了解当前使用的框架、生命周期管理、安全风险和用例。

本文档包括最佳实践，包括可观察性、安全性和技术实现。

最后，它列出了相关工作，突出了它们在本白皮书之外的附加价值，以及Operator的下一步发展。

### 本文档的目标

本文档旨在为云原生应用程序中的Operator在 Kubernetes 和其他容器编排器的上下文中提供定义。

### 目标受众/最低经验水平

本文档适用于应用程序开发人员、Kubernetes 集群运维人员和服务提供商（内部或外部），他们希望了解Operator及其可以解决的问题。它还可以帮助已经在研究Operator的团队学习何时以及在哪里最好地使用Operator。它假设受众具有基本的 Kubernetes 知识，如熟悉 Pod 和 Deployments。

## 基础

Kubernetes 和其他编排器的成功是由于它们专注于容器的主要功能。当公司开始走向云原生时，使用更具体的用例（微服务、无状态应用程序）更有意义。随着 Kubernetes 和其他容器编排器的声誉和可扩展性的增长，需求变得更加宏大。对高度分布式数据存储也希望使用编排器的完整生命周期能力。

Kubernetes 原语默认情况下不支持管理状态。仅仅依赖 Kubernetes 原语会带来一些困难，如无法满足有关状态应用程序的需求：复制、故障转移自动化、备份/恢复和升级（这些可能基于过于特定的事件）。

Operator模式可用于解决管理状态的问题。通过利用 Kubernetes 内置的自愈、协调功能以及结合应用程序特定复杂性的方式，可以自动化任何应用程序的生命周期、操作，并将其转化为高度可靠的解决方案。

Operator被视为与 Kubernetes 同义词。然而，一个完全自动化管理的应用程序的概念可以导出到其他平台。本文的目的是将这个概念提升到比 Kubernetes 本身更高的水平。

### Operator设计模式

本节描述了高级概念下的模式。下一节的"Kubernetes Operator定义"将描述以Kubernetes对象和概念为基础的模式实现。

Operator设计模式定义了如何使用特定领域知识和声明性状态来管理应用程序和基础设施资源。该模式的目标是通过将领域特定知识编码并使用声明性API进行公开，减少手动命令式工作（如备份、扩展、升级等），以使应用程序处于健康和良好维护的状态。

通过使用Operator模式，如何调整和维护资源的知识被编码并通常在单个服务（也称为控制器）中完成。

当使用Operator设计模式时，用户只需描述应用程序和资源的期望状态即可。Operator实现应对现实状态进行必要的更改，使其达到期望的状态。Operator还将持续监视实际状态并采取行动以保持其健康和相同状态（防止漂移）。

一个Operator的一般图示将包含能够读取所需规范并创建和管理所描述资源的软件。

![Operator Design Pattern](/assets/img/posts/20230706_02_1_operator_pattern.png)

Operator模式由三个组件组成

* 我们要管理的应用程序或基础架构。
* 一种特定于领域的语言，使用户能够以声明方式指定应用程序的期望状态。
* 一个连续运行的Controller：
  * 读取并了解状态。
  * 在操作状态更改时执行操作。
  * 以声明性方式报告应用程序的状态。

该设计模式将在下一节中应用于 Kubernetes 及其Operator。

### Operator特征

任何Operator的核心目的是通过使用新的领域知识扩展其编排器的底层 API。例如，通过 Pod 和 Service 对象，Kubernetes 中的编排平台本身就可以理解容器和第4层负载均衡器。Operator为更复杂的系统和应用程序引入了新的功能。例如，prometheus-operator 引入了新的对象类型“Prometheus”，通过扩展 Kubernetes 为部署和运行 Prometheus 服务器提供高级别的支持。

Operator提供的功能可以归类为三个主要类别：动态配置、运维自动化和领域知识。

#### 动态配置

自软件开发的早期阶段以来，已经有两种主要的配置软件的方式：配置文件和环境变量。云原生世界创建了基于在启动时查询众所周知的 API 的新进程。大多数现有软件依赖于这两个选项的组合。Kubernetes 自然提供了许多工具来实现自定义配置（例如 ConfigMaps 和 Secrets）。由于大多数 Kubernetes 资源是通用的，它们不了解修改给定应用程序的具体方法。相比之下，Operator可以定义新的自定义对象类型（自定义资源），以更好地表达在 Kubernetes 上下文中的特定应用程序的配置。

通过提供更好的验证和数据结构化，可以减少小的配置错误的可能性，并提高团队自助服务的能力。这消除了每个团队都需要了解基础编排器或目标应用程序的要求的需求。这可以包括渐进式的默认值，其中使用几个高级设置来填充基于最佳实践的配置文件，或自适应配置，例如根据可用硬件或预期负载调整资源使用情况。

#### 运维自动化

除了自定义资源外，大多数Operator都包括至少一个自定义Controller。这些Controller是在编排器内部运行的守护程序，但与底层 API 连接并提供常见或重复性任务的自动化。这与实施编排器（如 Kubernetes）的方式相同。到目前为止，您可能已经在您的旅程中看到过 kube-controller-manager 或 cloud-controller-manager 的提及。然而，正如配置所示，Operator可以通过扩展和增强编排器实现更高级别的自动化，例如部署集群软件、提供自动备份和恢复，或根据负载进行动态缩放。

通过将这些常见的运维任务放入代码中，可以确保它们可以重复、可测试，并以标准化的方式升级。在频繁任务中不涉及人类运维，可以确保不会错过或排除步骤，并且任务的不同部分之间不会失去同步。与前面一样，这可以通过减少应用程序备份等重要但乏味的维护任务上花费的时间来提高团队的自主权。

#### 领域知识

类似于运维自动化，可以将特定领域的专业知识编写到Operator中，以处理特定软件或流程的知识。一个常见的例子是应用程序升级。简单的无状态应用程序可能只需要 Deployment 的滚动升级，而数据库和其他有状态应用程序通常需要按照特定的顺序执行非常具体的步骤才能安全地执行升级。Operator可以根据当前和请求的版本来自动处理这个过程。更一般地说，这可以适用于预云原生环境中使用手动检查清单的任何事物（有效地将Operator用作可执行的运行簿）。 利用自动化领域知识的另一种常见方式是错误纠正。例如，Kubernetes 的内置纠正行为主要是“重启容器，直到它正常工作”，这是一个强大的解决方案，但通常不是最好或最快的解决方案。Operator可以监视其应用程序，并根据错误采取特定行为来解决错误，或者如果无法自动解决问题，则升级问题。这可以减少故障恢复时间（MTTR），同时减少Operator因反复出现的问题而产生的疲劳。

### Kubernetes中的Operator组件

_"Operator是一个理解 Kubernetes 和其他领域的 2 个领域的 Kubernetes Controller。通过结合对这两个领域的了解，它可以自动化通常需要理解这两个领域的Operator才能执行的任务"_
(Jimmy Zelinskie, <https://github.com/kubeflow/tf-operator/issues/300#issuecomment-357527937>)

![Operator Big Picture](/assets/img/posts/20230706_02_2_operator.png)
Operator通过将观察的对象与 Kubernetes API 扩展的操作知识结合起来，扩展了 Kubernetes API 的功能。 这是通过组合 Kubernetes Controller和描述所需状态的监视对象实现的。Controller可以监视一个或多个对象，这些对象可以是 Kubernetes 的原语（如 Deployments、Services）或位于集群之外的其他对象，如虚拟机或数据库。

所谓的期望状态指的是在代码中定义的任何资源，Operator配置为管理这些资源。随后，当前状态引用部署的这些资源的实例。

Controller将通过调谐循环不断比较期望状态和当前状态，确保监视的对象按照定义的方式过渡到期望状态。

期望状态被封装在一个或多个 Kubernetes 自定义资源中，Controller包含了将对象（如部署、服务）转换到目标状态所需的操作知识。

#### Kubernetes Controller

Kubernetes Controller负责处理常规任务，以确保特定资源类型所表达的期望状态与当前状态相匹配 (当前状态, <https://fntlnz.wtf/post/what-i-learnt-about-kubernetes-controller/>)。例如，部署Controller负责确保所需数量的Pod副本正在运行，并在删除或故障时启动新的 Pod。

从技术上讲，典型的Controller和Operator之间没有区别。通常所说的区别是Operator中包含的操作知识。因此，Controller是实现，Operator是使用自定义Controller与 CRD 并实现自动化的模式。因此，当创建自定义资源时，Controller会启动一个 Pod，并在之后销毁该 Pod，可以将其描述为简单的Controller。如果Controller具有关于如何升级或从错误中纠正的操作知识，那么它就是一个Operator。

#### 自定义资源和自定义资源定义

自定义资源用于在 Kubernetes 中存储和检索结构化数据，作为默认 Kubernetes API 的扩展  (<https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/>)。
对于Operator来说，自定义资源包含了资源（例如应用程序）的期望状态，但不包含实现逻辑。这样的信息可以包括应用程序组件的版本信息，以及应用程序的启用功能或备份信息可能是其中的一部分。自定义资源定义（CRD）定义了这种对象的外观，例如哪些字段存在以及如何命名 CRD。这样的 CRD 可以使用工具（如Operator SDK）生成，也可以手动编写。

下面的示例演示了自定义资源实例定义的样子：

```yaml
apiVersion: example-app.appdelivery.cncf.io/v1alpha1
kind: ExampleApp
metadata:
  name: appdelivery-example-app
spec:
  appVersion: 0.0.1
  features:
    exampleFeature1: true
    exampleFeature2: false
  backup:
    enabled: true
    storageType: “s3”
    host: “my-backup.example.com”
    bucketName: “example-backup”
  status:
    currentVersion: 0.0.1
    url: https://myloadbalancer/exampleapp/
    authSecretName: appdelivery-example-app-auth
    backup:
      lastBackupTime: 12:00
```

这个例子表示了一个名为“appdelivery-example-app”的自定义资源，其类型为“ExampleApp”。

“spec”部分是用户可以声明期望状态的地方。该示例声明应使用应用程序版本0.0.1部署，其中一个功能启用，另一个功能禁用。此外，应备份该应用程序，并使用 S3 存储类型。

“status”部分是Operator可以向用户提供有用信息的地方。在此示例中，状态显示了当前部署的版本。如果它与规范中的“appVersion”不同，则用户可以期望Operator正在努力部署规范中请求的版本。状态部分中的其他常见信息包括如何连接到应用程序以及应用程序的健康状况。

#### 控制循环

Kubernetes Controller中的控制（协调）循环确保用户使用 CRD 声明的状态与应用程序的状态相匹配，并确保状态之间的过渡按预期进行。一个常见的用例可能是在升级应用程序时迁移数据库模式。控制循环可以在特定事件（如 CRD 的更改）或基于时间（如在特定时间备份数据）触发。

### Operator能力

Operator可以通过解决许多不同的任务来帮助操作应用程序或其他受管理组件。在谈到Operator时，最常见且最为人熟知的能力是能够安装和升级有状态应用程序。然而，Operator可以在不需要手动输入安装/升级的情况下管理应用程序的整个生命周期。

以下各节应提供Operator可能具备的能力概述，以及用户可以期望Operator在实现这些能力时的表现。

#### 安装应用程序/接管应用程序

Operator应能够预置和设置所有所需资源，因此在安装过程中不需要手动工作。Operator必须检查和验证已预置的资源是否按预期工作，并准备好供使用。

Operator还应该能够识别在安装过程之前预置的资源，并且仅在以后使用时才接管这些资源。在这种情况下，接管过程应无缝进行，并且不会造成停机时间。接管的目的是为了实现资源的简单迁移到Operator。

Operator应在过程中报告资源的版本和健康状态。

#### 升级应用程序

Operator应能够升级应用程序/资源的版本。Operator应知道如何更新所需的依赖关系，并执行自定义命令，例如运行数据库迁移。

Operator应监视更新过程，并在过程中进行回滚，如果有问题发生。

Operator应在过程中报告资源的版本和健康状态。如果发生错误，则报告的版本应为当前使用的版本。

#### 备份

此功能适用于管理数据并确保Operator能够创建一致的备份。此备份应以用户Operator可以确保在数据丢失或受损时可以恢复以前版本的方式进行。此外，所提供的状态信息应提供有关备份上次运行的时间和位置的见解。

![Example Backup Process](/assets/img/posts/20230706_backup-sequence.png)

上面的示例显示了这样一个过程可能的样子。首先，备份由人员或其他触发器（例如时间触发器）触发。Operator指示其观察的资源（应用程序）设置一致状态（如一致的快照）。然后，使用适当的工具将应用程序的数据备份到外部存储。这可以是一步完成的过程（直接备份到外部存储）或多步完成的过程，例如首先写入持久卷，然后再写入外部存储。外部存储可以是本地的 NFS/CIFS 共享（或任何其他网络文件系统），也可以是云提供商基础架构上的对象存储/桶。无论备份是否失败或成功，备份的状态（包括备份的应用程序版本和备份位置）可能会写入自定义资源的状态部分。

#### 从备份中恢复

Operator的恢复能力可以帮助用户从成功的备份中恢复应用程序状态。因此，应恢复应用程序状态（应用程序版本和数据）。

有许多实现这一目标的方式。一种可能的方式是当前应用程序状态也进行备份（包括配置），因此用户只需为应用程序创建一个自定义资源并指向备份。Operator将读取配置，恢复应用程序版本并恢复数据。另一种可能的解决方案可能是用户仅备份了数据，并可能需要指定所使用的应用程序版本。然而，在这两种方式中，Operator都会确保在使用指定备份的数据后应用程序正常运行。

#### 自动修复

Operator的自动修复能力应确保能够从更复杂的失败状态中恢复应用程序，这些状态可能无法通过健康检查（活动状态和就绪探测）等机制来处理或检测到。因此，Operator需要对应用程序有深入的了解。这可以通过指标来实现，这些指标可能指示应用程序的故障或错误，还可以通过处理Kubernetes机制（如健康检查）来实现。

一些示例可能包括：

* 如果版本更改后一定数量的Pod启动不成功，则回滚到上次已知的配置。 在某些情况下，应用程序的重新启动可能是一个短期解决方案，Operator也可以执行此操作。
* 还可以想象Operator通知依赖服务的另一个Operator当前无法访问后端系统（以执行修复操作）。

在任何情况下，此功能使Operator能够采取行动以保持系统的正常运行。

#### 监控/指标 - 可观察性

虽然受管应用程序应为自身提供遥测数据，但Operator可以提供有关其自身行为的指标，并提供有关应用程序状态的高级概述（就像自动修复可能提供的那样）。此外，Operator提供的典型遥测数据可能包括修复操作的计数、备份持续时间，以及有关最近错误或已处理的操作任务的信息。

#### 扩展（Operator支持扩展）

扩展是Operator在日常运营中可以管理的部分，以保持应用程序/资源的功能性。扩展能力并不要求自动化扩展，而是要求Operator知道如何根据水平和垂直扩展来改变资源。

Operator应能够增加或减少其所拥有的任何资源，例如CPU、内存、磁盘大小和实例数量。

理想情况下，扩展操作不会导致停机。扩展操作在所有资源处于一致状态且可以使用时结束，因此Operator应验证所有资源的状态并报告它。

#### 自动扩展

Operator应能够根据持续收集的指标和阈值来执行扩展能力。Operator应能够自动增加和减少其所拥有的每个资源。

Operator应遵守最小和最大扩展配置的基本规则。

#### 自动配置调整

此功能应使Operator能够管理托管应用程序的配置。例如，Operator可以根据操作环境（例如 Kubernetes）或 DNS 名称的更改来调整应用程序的内存设置。此外，Operator应能够以无缝的方式处理配置更改，例如，如果配置更改需要重新启动，应触发重新启动。

这些功能对用户来说应该是透明的。用户应该有可能覆盖自动配置机制，如果他们愿意的话。此外，自动重新配置应该以用户可以理解基础架构中发生了什么的方式进行充分记录。

#### 卸载/断开连接

在删除声明性请求的状态（在大多数情况下是自定义资源）时，Operator应允许两种行为：

* 卸载：Operator应能够完全删除或删除每个托管资源。
* 断开连接：Operator应停止管理已配置的资源。

这两个过程都应应用于Operator直接配置的每个资源。 Operator应以声明性方式报告过程中的任何失败（例如，使用[状态字段](https://kubernetes.io/docs/concepts/overview/working-with-objects/kubernetes-objects/#object-spec-and-status)）。

## 安全性

![operator model](/assets/img/posts/20230706_04_1_operator_model.png)

Operator旨在通过使用自定义资源定义（CRD）通过Kubernetes API服务器管理其状态和配置。它们管理的从属API资源（通常是运行有状态应用程序的Pod）也通过Kubernetes API管理其生命周期、支持的RBAC、服务等。在某些情况下，Operator还将通过网络与应用程序的API进行交互。所有这些途径都有可能危及Operator及其资源的安全性，应按照下文所述的最佳实践进行保护。

### Operator开发者

Operator开发者应意识到Operator引入的安全风险，并记录其安全使用方式。在开发Operator时，重点关注透明度和文档、Operator范围以及漏洞分析等关键领域是非常重要的。

#### 透明度和文档

在开发Operator时，开发者应清楚地了解它将如何在Kubernetes中工作和接口。当开发者从开发转向发布Operator时，应向用户提供清晰的了解Operator的功能和工作原理的文档。 你可能对自己编写的东西感到自豪，但请从最终用户的角度来考虑：他们应该信任来自互联网的源代码吗？他们应该允许Operator以管理员权限在可能是庞大且昂贵的集群上运行，或者处理敏感信息吗？开发者能够为用户提供关于软件的速成知识，如它的工作原理、如何进行安全配置以及它可能对他们的集群产生的影响，这将使用户更容易接受该软件。

以下是一些有助于用户做出明智决策的项目，判断他们是否应该使用Operator：

* 提供描述性的图表（威胁模型），说明Operator如何进行通信以及使用什么工具有助于用户了解如何确保其安全性并为Operator应用策略。
* 使用用例说明软件的预期使用方式，以便在合规性方面保持在范围内，否则可能会面临范围外的漏洞风险。
* 记录的RBAC范围、威胁模型、通信端口、可用的API调用、Pod安全策略要求（或其他Kubernetes策略引擎要求），或为Kubernetes开发的任何其他策略引擎要求，如OPA。
* 安全报告、披露和事件响应流程：如果有人发现潜在的安全问题，他们应该联系谁，可以期待什么类型的响应？
* 通过暴露的端点、日志级别或日志聚合附加日志和监控。
* Operator问题、功能和版本跟踪。
* 如果项目过去曾有过安全披露，将这些披露（及其CVE标识）列在网页上是建立与用户的信任的重要步骤。每个项目在某个时间点都会有安全问题-如何处理这些问题展示了一个项目的成熟度。

对于开发过程安全性的更多想法，读者可以查阅CNCF安全标签组（Security TAG）的 [自我评估问卷](https://github.com/cncf/sig-security/blob/master/assessments/guide/self-assessment.md).

#### Operator范围

Operator有许多用例，你设计它的范围几乎没有限制。为了清楚地了解Operator的安全性质，应该在每个范围内进行清晰的沟通。可以使用的一般范围包括集群范围Operator、命名空间Operator和外部Operator。为了更好地保护它们的安全性，需要理解通信方式、任何创建的API、Controller及其责任以及任何应用程序的指标端点。如果Operator提供了这些信息，可以用它们来进一步保护Operator在实施范围内的应用程序。如果未提供这些信息，可能会面临各种攻击的风险。

**集群范围Operator**用于在整个集群中执行自定义资源，无论这些资源是否存在于其他命名空间中。 **命名空间Operator**用于在命名空间内执行自定义资源。通常会应用策略引擎策略来限制命名空间内的范围，并且仅与命名空间内的Pod进行通信。从本质上讲，这被认为是更安全的，但相同的规则适用。 **外部Operator**用于执行外部于集群的自定义资源。除了遵循相同的规则外，还必须了解从集群到外部组件的通信方式。

虽然本文还讨论了从用户角度进行的范围划定，但Operator的设计方式将在生产环境中对可应用的安全控制措施产生重大影响。通常情况下，权限会较为宽松，有意在发布前应用安全概念；在开发人员开始工作时花费一些时间思考Operator的安全设计，将使开发人员和用户在此过程中更加容易。

#### 漏洞分析

作为Operator开发者，专注于Operator的开发和安全性，必须采取一些步骤来确保已进行验证和适当的安全性分析。遵循CNCF云原生安全白皮书中的指南，定义了Operator开发者的[关注层](https://github.com/cncf/tag-security/blob/main/security-whitepaper/v2/cloud-native-security-whitepaper.md#cloud-native-layers)的清晰生命周期过程。在Operator开发者的范围内，应严格遵守这三个层面，特别关注开发和分发层。在开发和分发层有许多详细的指南，将有助于对供应链应用做出健全的漏洞分析，以确保正在开发的Operator被签名和信任，以达到最佳的完整性。CNCF [云原生安全白皮书](https://github.com/cncf/tag-security/blob/main/security-whitepaper/v2/cloud-native-security-whitepaper.md)可在此链接中获取。

除了供应链之外，还需要关注执行威胁模型以保持开发人员的警惕，并确保没有遗漏可能导致攻击的问题。可以在CNCF云原生安全白皮书的[威胁建模](https://github.com/cncf/tag-security/blob/main/security-whitepaper/v2/cloud-native-security-whitepaper.md#threat-modeling)中观察到用于检查威胁的基本模型。

### 应用开发者（Operator用户）

Operator代表用户执行管理任务，例如卷的创建/挂载、应用部署和证书管理。由于用户将控制权委托给Operator，因此必须提供机器授权以执行所需的操作，但同时也必须小心，不要授予Operator比其角色所需的更多权限。

部署Operator将第三方软件赋予对Kubernetes命名空间或集群的某种级别访问权限。尽管使用Operator不需要安全专业知识，但以下 Kubernetes 概念强调在使用Operator时应进行的安全准备：

**命名空间** 是分组和隔离一组资源的主要方式之一。对于Operator而言，用户应考虑Operator需要与哪些命名空间一起工作。虽然在某些情况下可能存在单个Operator需要访问整个集群的用例，但在2021年普遍情况下，Operator通常与Kubernetes中的特定应用程序一起工作，因此为该应用程序以及相关资源和Operator提供一个命名空间通常是合理的。为了进一步减少Operator与从属资源的命名空间中的任何松散或被窃取的RBAC的隔离，为Operator提供一个专用的命名空间可以提供更多的隔离。

**基于角色的访问控制（RBAC）** 在现代版本的 Kubernetes 中可用。在授予Operator对资源的访问权限时，重点应放在授予Operator执行其任务所需的最有限权限集上。这意味着仅在绝对必要的情况下授予 ClusterRoles，而为特定资源/命名空间授予特定权限。用户指南中的[使用 RBAC 授权](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)章节详细介绍了这个主题。例如，Operator SDK等Operator构建工具使用了通用的 RBAC 默认设置，开发人员可能还没有为其特定Operator进行细化。在集群之外的服务账户标识获得的权限包括在其他 Kubernetes 集群中具有权限的联合和跨集群Operator。随着Operator越来越多地用于管理集群外和云端资源，应配置云 IAM 集成权限，以防止被入侵的Operator接管云账户。

_需要注意的一点_：权限的“抢占” - 即请求显著/管理访问权限 - 不一定是恶意的。开发人员可能不了解更好的方式，或者没有时间来调整所需权限以满足最低权限概念。即使在最无辜的情况下，这仍然是一个警示信号：也许Operator已经得到足够多的采用，以至于其他人发现并提出了关于权限过度使用的担忧，并且也许这是Operator内部其他安全弱点的迹象。如果发现了这样的“抢占”行为，建议谨慎对待。

**软件来源**：在编写本白皮书时，“软件供应链”正在引起越来越多的关注。考虑Operator的源代码、安装方式以及为什么或如何恶意用户可能希望访问 Kubernetes 集群。在运行安装脚本之前，请花几分钟时间查看它。虽然 kubectl 命令支持直接从公共互联网应用 yaml 脚本的能力（例如，`kubectl create -f https://publicwebsite.com/install/operator.yaml`），但强烈建议首先将该文件下载到本地，进行审核，然后运行 `kubectl create -f operator.yaml`。

要审查脚本，请问以下问题：

* 这个脚本的目的是什么？
* 脚本创建了哪些资源？这个脚本是否创建了 Roles 和 RoleBindings？
* 脚本尝试使用哪些第三方资源？（例如，容器镜像、其他 yaml 文件）Git 和 Docker 镜像仓库有多受欢迎和维护良好？这可能是一个新项目、不再接收安全更新的废弃软件的迹象，或者是一个带有恶意意图的非官方仓库的指标。
* 脚本尝试获取哪些权限？脚本是否尝试以主机共享或“特权模式”运行容器 securityContexts？

有关软件供应链安全的更多信息，请参阅[CNCF 供应链安全白皮书](https://github.com/cncf/tag-security/tree/main/supply-chain-security/supply-chain-security-paper)。

**高级安全控制**，如 SELinux、AppArmor 或 seccomp，可能是集群策略的强制要求。开源Operator不太可能具有针对这些 Linux 安全模块的配置，但如果组织熟悉其中一种控制系统，则编写适当的Operator安全配置应不会产生重大开销。

**Operator配置**：理想情况下，项目应该是“安全默认”的，以增加安全Operator或应用程序部署的可能性。不安全的默认设置需要手动配置以保护环境。尽管学习新Operator的配置参数可能看起来是不必要的工作，但通常更好的选择是手动调整Operator本身的配置和/或源代码以达到所需的安全级别。

## Kubernetes的Operator框架

目前，有许多框架可简化Operator/Controller项目的启动过程并编写Operator。本章介绍其中一些框架，但并不完整。

### CNCF Operator框架

[Operator 框架](https://github.com/operator-framework) 是一个开源工具包，用于以有效、自动化和可扩展的方式管理 Kubernetes 原生应用程序（称为Operator）。

它面向Operator开发人员，提供了一个 SDK，使用基于 [kubebuilder](https://github.com/kubernetes-sigs/kubebuilder) 的脚手架工具来简化Operator开发，提供了用于单元测试、集成测试、功能测试的测试工具，以及用于发布Operator版本历史记录和用户可配置的更新图的打包/分发机制。支持的项目类型包括 Golang、Helm 和 Ansible。Python 和 Java 目前正在开发中。

它还为需要在多租户环境中安装、配置和更新Operator的 Kubernetes 管理员提供了一个中心点。它涵盖了Operator生命周期的以下方面：

* 持续更新Operator目录、发布机制和更新源。
* 依赖关系模型，使Operator能够依赖集群功能或彼此之间的Operator
* 可发现性，使通常无法列出 CRD 或查看单独命名空间中已安装的Operator的特权较低的租户能够发现它们
* 集群稳定性，在尊重 CRD 的全局性质、CRD 版本控制和 CRD 转换的微妙之处上，避免多租户集群上的运行时冲突
* 声明式用户界面控件，允许控制台为与Operator服务交互的最终用户生成丰富的用户界面体验

### Kopf

[Kopf](https://github.com/nolar/kopf)（Kubernetes Operator Pythonic Framework）是一个框架，可以快速、简便地创建 Kubernetes Operator，只需使用几行 Python 代码即可。它减少了与低级 Kubernetes API 通信的麻烦，并将 Kubernetes 资源更改与 Python 函数之间进行转换。

```python
import kopf 
@kopf.on.create(kind='KopfExample')
def created(patch, spec, **_):
 patch.status['name'] = spec.get('name', 'world')  

@kopf.on.event(kind='KopfExample', field='status.name', value=kopf.PRESENT)
def touched(memo, status, **_):
 memo.last_name = status['name']
 
@kopf.timer('KopfExample', interval=5, when=lambda memo, **_: 'last_name' in memo) def greet_regularly(memo, **_):
 print(f"Hello, {memo['last_name']}!")
```

如果您希望或需要在 Python 3.7+ 中创建即席的（即此处和现在仅一次非通用化的）Operator，特别是如果您希望将应用程序领域直接带入 Kubernetes 作为自定义资源，那么您应该考虑使用此框架。有关更多功能，请参阅[文档](https://kopf.readthedocs.io/en/stable/)。

### kubebuilder

kubebuilder 框架提供了一种扩展 Kubernetes API 的可能性，通过使用自定义资源定义（CRD）创建处理这些自定义资源的Controller。

kubebuilder 框架提供的主要入口点是 _Manager_。与原生的 Kubernetes Controller被组合到单个 Kubernetes Controller管理器（`kube-controller-manager`）中一样，您将能够创建多个Controller并由单个管理器管理它们。

由于 Kubernetes API 资源附加到域并按组、版本和类型进行排列，您定义的 Kubernetes 自定义资源将附加到您自己的域，并按您自己的组、版本和类型进行排列。

在使用 kubebuilder 时的第一步是创建一个附加到您的域的项目，该项目将创建构建单个 Manager 的源代码。

在使用特定域初始化项目后，您可以向域添加 API，并使这些 API 由管理器管理。

向项目添加资源将为您生成一些示例代码：一个示例的 _自定义资源定义_，您将调整该定义以构建自己的自定义资源，以及一个示例的 _Reconciler_，该 Reconciler 将为Operator处理此资源实现协调循环。

kubebuilder 框架利用了 `controller-runtime` 库，该库提供了 Manager 和 Reconciler 等概念。

kubebuilder 框架提供了构建管理器二进制文件的所有必需品，以及启动管理器的容器映像和部署此管理器所需的 Kubernetes 资源，包括定义您的自定义资源的 `CustomResourceDefinition` 资源、用于部署管理器的 `Deployment`，以及Operator能够访问 Kubernetes API 的 RBAC 规则。

### Metacontroller-作为服务的轻量级 Kubernetes Controller

[Metacontroller](https://metacontroller.github.io/metacontroller/) 是一个Operator，可简化编写和部署自定义Operator的过程。

它本身引入了两个自定义资源定义（CRD）：

* [Composite Controller](https://metacontroller.github.io/metacontroller/api/compositecontroller.html) - 允许编写由 CRD 触发的Operator
* [Decorator Controller](https://metacontroller.github.io/metacontroller/api/decoratorcontroller.html) - 允许编写由任何 Kubernetes 对象触发的Operator（也可以由其他Operator管理）

Metacontroller 本身通过其 CRD 之一进行配置，将负责观察集群状态并调用用户提供的Controller（用户Controller）来执行操作。

用户Controller应该根据给定的资源作为输入，计算依赖对象的期望状态。

这也可以称为“lambda Controller”模式（在此处阅读更多详细信息：[链接](https://metacontroller.github.io/metacontroller/concepts.html#lambda-controller)），因为输出仅考虑输入，并且 Metacontroller 使用的逻辑也可以存在于函数即服务提供者中。

Metacontroller 的主要优点：

* 只需提供一个函数（通过 webhook 调用），无需提供与观察 Kubernetes 资源相关的任何样板代码
* 这样的函数可以用任何语言编写，并通过 HTTP 公开

主要限制：

* 只能实现某些模式，如上所述
* 当前架构依赖于集群中的单个 Metacontroller
* Metacontroller 不知道任何外部状态，完全依赖于集群状态

下面是一个示例 Metacontroller 配置，用于为 `StatefulSet` 添加附加的网络暴露，而无需显式定义 `Service` 清单。

```yaml
apiVersion: metacontroller.k8s.io/v1alpha1
kind: DecoratorController
metadata:
  name: service-per-pod
spec:
  resources:
  - apiVersion: apps/v1
    resource: statefulsets
    annotationSelector:
      matchExpressions:
      - {key: service, operator: Exists}
      - {key: port, operator: Exists}
  attachments:
  - apiVersion: v1
    resource: services
  hooks:
    sync:
      webhook:
        url: http://service-per-pod.metacontroller/sync-service-per-pod
        timeout: 10s
```

通过上述配置：

* `metacontroller` 对于与 `spec.resources` 描述匹配的每个对象（在本例中为带有 `service` 和 `port` 注释的 `apps/v1/statefulsets`）的任何更改（创建/更新/删除）进行监视，并在每个对象上调用 `hooks.sync`
* `hooks.sync` 可以返回在 `spec.attachments` 中描述的对象（在本例中为 `v1/services`），`metacontroller` 将根据 `hook` 的响应创建/更新/删除这些对象 例如，如果部署了以下 `StatefulSet`：

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  annotations:
    service: "statefulset.kubernetes.io/pod-name"
    ports: "80:8080"
...
```

则 `metacontroller` 将创建以下 `Service` 对象：

```yaml
apiVersion: "v1"
kind: "Service"
spec:
  selector: "statefulset.kubernetes.io/pod-name"
  ports:
  - port: 80
    targetPort: 8080
```

用户定义的端点（在此示例中为 `http://service-per-pod.metacontroller/sync-service-per-pod`）只需关心如何计算 `Service` 并根据给定的 `StatefulSet` 确定其样子。

可以在 [metacontroller-examples](https://metacontroller.github.io/metacontroller/examples.html) 页面上找到使用 metacontroller 实现的其他示例和想法！

如果有任何问题，请访问我们的 Slack 频道（[#metacontroller](https://kubernetes.slack.com/archives/CA0SUPUDP)）或在 [GitHub 讨论](https://github.com/metacontroller/metacontroller/discussions/) 上提问。

## Operator生命周期管理

Operator是一个应用程序，本节将描述Operator本身的生命周期相关考虑事项。

### 升级Operator

在升级Operator时，需要特别注意管理的资源。在Operator升级过程中，应保持管理的资源处于相同的状态和健康状态。

### 升级声明式状态

声明式状态是Operator的 API，可能需要进行升级。使用 CRD 版本可以指示 CRD 和Operator的稳定性 - [了解有关 CRD 版本控制的更多信息](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definition-versioning/)

### 管理CRD的关系

随着Operator和 CRD 的数量增加，管理的复杂性也会增加。例如，如何管理Operator之间的冲突，例如两个与 Ingress 相关的功能？如何管理 CRD 之间的依赖关系和/或数据流的相关性，例如 DB 集群和 DB 备份 CRD？

为了解决这个问题，我们需要一个具体的模型来管理Operator和 CRD，并使用基于策略的引擎监督它们。 像 [KubeVela](https://kubevela.io/) 和 [Crossplane](https://crossplane.io/) 这样的社区努力一直在尝试通过提供 CRD 组合的解决方案来解决这个问题。 KubeVela 还提供了管理自定义资源之间数据依赖关系的功能。

## Operator的用例

示例： Operator用于安装应用程序，或者通过定义一组由Operator管理的对象及其相互作用来提供其他对象。安装完成后，目标应用程序应该在没有人工干预的情况下运行。进一步而言，Controller用于重新配置系统。

为了实现这一点，Operator会监视当前状态以及在自定义资源或外部事件中定义的内容。通过比较它们并开始协调应用程序，以在需要时达到期望的状态。自定义资源的更改可以是启用功能或更改版本，外部事件可以是由 API 报告的应用程序更新的可用性。由于Operator管理的对象被删除，导致当前应用程序状态可能会有所不同，因此它们也会被重新创建以达到期望的状态。

在更新应用程序时，Operator包含了到新应用程序版本的升级逻辑以及如何进行过渡的方法。正如上一章所述，这些可以是在更新数据库模式之前备份数据的机制。因此，Operator中包含的逻辑知道构建一致备份所需的先决条件，如何备份数据以及如何恢复到正常状态。

最后，Operator能够删除应用程序和生成的对象。

### Prometheus Operator

Prometheus Operator是最早编写的Operator之一，与 etcd 一起证明了这个问题空间的用例。

“Prometheus Operator的目标是尽可能简化在 Kubernetes 上运行 Prometheus 的过程，同时保留 Kubernetes 本地配置选项。”

当安装 [Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator/blob/master/Documentation/user-guides/getting-started.md) 时，除了OperatorController pod/部署之外，还提供了广泛的 API 来配置 Prometheus 栈。这些 API 以自定义资源定义（CRD）的形式呈现，允许我们配置负责的对象，其中包括但不限于：

* 描述要由 Prometheus 监控的一组目标（ServiceMonitor）。
* 以声明方式描述 Prometheus 部署的期望状态。
* 描述用于处理客户端应用程序发送的警报的 [AlertManager](https://github.com/prometheus/alertmanager) 集群。

优势在于使用 Kubernetes 本地配置作为配置整个操作堆栈的方式，从 Kubernetes 资源验证和自愈能力中获益。

OperatorController将与 Kubernetes API 服务器通信，添加服务度量端点，并自动生成所配置服务所需的 Prometheus 抓取配置。

### Operator for GitOps

通常，Operator与安装、升级和操作应用程序相关联。一个例子是在 GitOps 领域中可以找到的一种Operator可以在不管理应用程序的情况下“操作”事物。GitOps 是使用 Git 作为所有资源的单一真实来源的实践。

可能会出现这样一种情况，即主要以命令方式管理的应用程序应以更声明性和 Git 驱动的方式进行编排。因此，Operator可以帮助从 Git 存储库中获取配置，分析配置以确定是否需要进行更改以及应采取哪些操作。

上述示例说明了这样一个情况：

1. 一段配置被提交到 Git 存储库中。
2. Operator通过使用自定义资源定义（存储库路径和有关密钥的信息存储在其中）来确认 Git 存储库。
3. Operator获取配置并进行分析。
4. 它应用其操作知识，从当前状态到期望状态（通过查询应用程序的当前状态并发送指令以达到期望状态）。

这使得用户可以在 Git 存储库中拥有可复制的、有版本的配置。

## 成功的模式

随着时间的推移，各种来源已经发布了许多编写Operator的最佳实践。下面列出了其中一些来源，并基于一个场景描述了其中的部分内容。

场景：一个微服务应用程序 ("The PodTato Head", <https://github.com/cncf/podtato-head>) 应该通过Operator完全进行管理（即使使用其他部署机制可能更合理）。该应用程序由4个服务和1个数据库组成，可以用下图表示：

![Sample Application](/assets/img/posts/20230706_08_1_sample.png)

这些最佳实践应该应用于该应用程序的部署。

### 管理单个类型的应用程序

Operator提供的功能应该针对单个应用程序。应用于我们的示例，这意味着应该有5个Operator，每个Operator一次管理一个组件（podtato-server、arm-service、foot-service、hat-service和数据库）。这为所有Operator提供了良好的关注点分离（基于 <https://cloud.google.com/blog/products/containers-kubernetes/best-practices-for-building-kubernetes-operators-and-stateful-apps>）.

### Operator of Operators

随着在应用程序工作负载部署和管理的生命周期中使用的Operator数量不断增长，就出现了跨一组Operator的资源和元行为之间的新互动机会。无论目标是减少管理多个异步Operator执行资源更改的认知负担，还是确保发布版本之间的连续性；在某些行业中的一些使用案例中，正在应用“Operator的Operator”架构。这种范式通常利用“元”Operator创建多个资源，这些资源依次异步创建，然后在元资源中进行更新。它使得单个自定义资源定义可以表达所需的状态结果，并且要求对其进行分割并异步执行。

![distributed](/assets/img/posts/20230706_09_1_distributedops.png)

协调整个堆栈的设置和生命周期可能仍然很复杂。一个控制元数据资源的Operator可以通过协调堆栈的各个部分并公开表示整个堆栈的CRD来帮助用户屏蔽这种复杂性。如果是这种情况，_元_Operator应该将工作委托给其他Operator处理更具体的部分。

拥有这些堆栈子组件的Controller可以以两种方式出现：

* Operator 分发包可以包含多个独立的Controller，每个Controller处理堆栈的一个子组件，以及一个主Controller（负责面向最终用户的CRD，表示整个堆栈）。将这样一个多ControllerOperator作为单个包部署将导致所有Controller同时运行（每个`Pod`一个），但只有面向最终用户的API/CRD实际上是公开和记录的以供公众使用。当发生这种情况时，负责此API的Controller将多个职责委派给其他Controller，这些Controller是其使用“内部”CRD打包的一部分。当整个“堆栈”由相同的Operator作者组拥有和开发，并且“从属”Controller作为独立项目没有意义时，这很有用。对于最终用户，这组Controller仍然显示为单个Operator。这里的主要好处是在Operator项目中实现关注点分离。

![Stack-Operator](/assets/img/posts/20230706_08_2_umbrella.png)

从技术上讲，会有一个用于由Operator管理的整个堆栈的自定义资源定义。该Operator为堆栈的每个组件创建一个自定义资源，这些资源再次由Operator进行管理并管理底层资源。

* 上述第二个模式描述了更高级的工作负载Operator。这些Operator依赖于其他通用Operator项目来部署堆栈的子组件。一个示例是一个Operator，它依赖于 `cert-manager`、`prometheus operator` 和 `postgresql` Operator来部署具有旋转证书、监控和 SQL 数据库的工作负载。在这种情况下，更高级别的工作负载Operator不应尝试在运行时发出和安装 `cert-manager` 等。这是因为Operator作者需要为这些依赖项的特定版本进行签名和维护，并处理 CRD 生命周期管理的一般问题领域。

    _相反，应该使用支持安装时的依赖项解析的软件包管理解决方案，以便将其他所需的Operator的安装委托给后台的软件包管理器，而不是作为高级Operator的启动代码的一部分。_

    这对于依赖于其他Operator的Operator非常有益，这些Operator本身在其自己的情况下很有用，甚至可能与群集上的多个其他Operator共享。Operator Framework 项目的一部分，[OLM](https://github.com/operator-framework/operator-lifecycle-manager) 就是这样一种软件包管理器。

### 一个Controller一个CRD

由Operator管理的每个 CRD 应在单个Controller中实现。这使得代码更易读，并有助于关注点的分离。

### Operator的发布和查找位置

有一些服务，如 operatorhub.io 和 artifacthub.io，可以帮助终端用户查找Operator，包括安装它们的说明。这些服务通常包括有关当前安全问题和Operator来源的信息。此外，还提供了有关Operator功能的信息。

### 深入阅读

还有很多其他最佳实践，例如：

* 一个Operator不应安装其他Operator
* Operator不应对其部署的命名空间做出假设，同时也不应该
* 使用 SDK 编写Operator

等等，可以在互联网上找到许多其他最佳实践。可以在以下来源找到更多最佳实践：

* <https://github.com/operator-framework/community-operators/blob/master/docs/best-practices.md>
* <https://cloud.google.com/blog/products/containers-kubernetes/best-practices-for-building-kubernetes-operators-and-stateful-apps>

## 设计Operator

前一章节描述了一个Operator的用例，它是最早的一批Operator之一。本章根据我们自己的经验或社区的描述，介绍了编写Operator时的一些最佳实践。然而，如果对实际状态没有清楚的了解，也没有明确的目标，我们还需要一些方法和技术来说明我们的Operator应该做什么。因此，我们还需要处理一些需求工程的方面。

### 需求分析

Kubernetes 的一个关键承诺是，它可以自动化操作任务，以在多个环境中部署、扩展和管理容器化应用程序，几乎不需要人工干预（或最少的人工干预）。在 Kubernetes 中，无状态的云原生应用程序非常适合水平扩展、自动化的自我修复重启或逐步部署新的容器。然而，在群集或分布式环境中运行的具有复杂组件的有状态应用程序并不总是适合基于容器的基础设施。它们在持久性、升级或高可用性方面仍然需要人工干预，以保持稳定状态。

当然，Kubernetes 通过创建和管理使用Operator的自定义应用程序以一种新颖的方式解决了这些问题。然而，这里的第一个问题是：作为开发人员，你真的知道这种类型的应用程序如何在内部和外部进行工作和交互吗？日常的 IT 运维工作是如何进行的？应用程序如何进行备份（包括恢复）？在故障切换或停机时需要采取哪些步骤，软件组件之间是否存在任何依赖关系？

因此，强烈建议进行全面的需求分析，以确定Operator的要求或条件。需求分析对于Operator的成功与否至关重要。所有需求都应该记录下来，可衡量、可测试、可追溯，与已识别的需求相关，并以足够详细的级别定义，以便进行系统设计。

构建正确Operator的步骤：

1. 如果不确定是否使用Operator，请尝试进行可行性评估。找到使用Operator的合理和可理解的原因。将Operator的好处与实施和运营所需的工作量进行对比。

2. 研究您的应用程序的现有文档，采访负责的系统管理员和其他相关方（如有必要），获取可能的系统检查活动列表、业务和与 SLA 相关的关键绩效指标，并将其与现有的事故报告或错误跟踪列表进行对比。

3. 详细描述一个具体的场景（例如应用程序故障切换），按照“谁在什么时候、如何以及为什么”等方式进行详细描述。

4. 描述Operator在运行上述场景时需要了解的内容，以保持应用程序的稳定和高效状态。

### 自定义或第三方Operator

现在已经明确了使用Operator的情况，本文的下一部分将重点介绍可用的Operator实现以及最符合要求的Operator。

找到合适的 Kubernetes Operator可能是一项挑战。一方面，您需要找到符合您收集到的需求的内容。另一方面，Operator需要定期更新，并得到供应商的积极支持。

简而言之，获取Operator有三种选择：

1. 如果您有一个数据库，并且需要一个Operator，请查阅供应商的网站。

2. 您可以搜索提供可用 Kubernetes Operator的公共（或私有）注册表。例如，[OperatorHub](https://operatorhub.io/) 提供了一种发布和共享Operator的平台，以简化分发方式。该平台使查找受支持的服务和基本文档更加容易。它还识别出活跃的Operator社区和供应商支持的倡议。

3. 编写自己的Operator，可以从头开始或使用合适的框架。

Operator是特定于应用程序的，它们的功能范围从简单的安装脚本到处理升级、备份和故障的复杂逻辑。在公共注册表中查找合适的Operator需要时间和精力，代价是过大或缺少功能。相比之下，编写自定义Operator可以实现开发人员想要或需要实现的任何功能，但需要进行开发和维护。

### 使用合适的工具

在完成并进行了完整的需求分析，并决定编写自定义 Kubernetes Operator后，下一个问题是开发人员应该使用哪些工具。\[2\] 的文章讨论了编写Operator的不同方法，并列举了每种解决方案的优缺点。文章以一个Operator作为示例，并使用了各种技术和工具。作者详细描述了以下工具：

* Operator SDK（Helm、Go、Ansible）
* Operator框架 KOPF（Python）
* 原始编程语言（Java）

正如前面提到的，这篇文章不仅描述了各个工具，还比较了它们的方法。作者演示了在开发过程中，命令式编程方法需要更多的时间、工作和谨慎。作为回报，它们为开发人员提供了灵活性，可以编写所需的任何类型的逻辑。相比之下，声明式方法（Helm Chart、Ansible）允许以非常简单、准确且易于阅读的形式实现Operator。

\[2\] 的最佳实践是：

1. 如果您已经有一个适用于软件的 Helm chart，并且不需要任何复杂的能力级别 => Operator SDK：Helm

2. 如果您想快速创建自己的Operator，并且不需要任何复杂的能力级别 => Operator SDK：Helm

3. 如果您需要复杂的功能，或者对任何未来实现具有灵活性 => Operator SDK：Go

4. 如果您希望在组织中保持单一的编程语言

    a. 如果您的语言存在流行的Operator框架，或者您想为其做出贡献 => Operator框架

    b. 如果您的编程语言中不存在流行的Operator框架 => 原始编程语言

5. 如果上述都不适用 => Operator SDK：Go

### 使用合适的编程语言

Operator是可以用任何选择的编程语言编写的程序。这是因为 Kubernetes 提供了一个 REST API，允许使用诸如 HTTP 等轻量级协议与客户端进行通信。因此，只要遵循 REST API 规范，软件开发人员可以使用他们首选的编程语言编写Operator。

然而，如果开发人员可以自由选择他们的编程语言，迟早会出现不同技术和语言的拼接。这最终会增加维护、故障排除、错误修复和支持请求的成本。一个更好的策略是专注于一种编程语言，并将其作为团队的开发语言。这极大地支持团队的协作和互相支持。

然而，根据\[1\]的说法，**Go 语言编写的Operator**是目前最流行的。原因有两点：首先，Kubernetes 环境本身就是用 Go 编写的，因此客户端库经过了完美优化。其次，Operator SDK（带有内置的 Kubebuilder）支持在 Go 中实现Operator，减少了开发人员的大量代码构建工作，并提供了免费的代码生成。

### 根据需求设计您的Operator

最后一段总结了一些未经排序的最佳实践，这些实践是由各种来源发现和发布的。

* 编写Operator涉及使用 Kubernetes API。使用类似 Operator-SDK 的框架可以节省时间，并提供一套工具来简化开发和测试。\[3\]

* 设计一个Operator，使得即使在Operator停止或删除的情况下，应用程序实例仍然可以不受影响地有效运行。

* 每个应用程序开发一个Operator。\[4\]

* Operator应该向后兼容，并始终了解已经创建的先前版本资源。

* 使用异步同步循环。\[4\]

* Operator应该利用内置的 Kubernetes 原语，如副本集和服务。在可能的情况下，使用经过充分理解和经过充分测试的代码。

* 在可能的情况下，使用测试套件对Operator进行测试，模拟 Pod、配置、存储和网络的潜在故障。

### 参考资料1

\[1\] [OperatorHub](https://operatorhub.io/)

\[2\] [使用正确的工具构建您的 Kubernetes Operator](https://hazelcast.org/blog/build-your-kubernetes-operator-with-the-right-tool/)

\[3\] [Operator最佳实践](https://github.com/operator-framework/community-operators/blob/master/docs/best-practices.md)

\[4\] [构建 Kubernetes Operator和有状态应用的最佳实践](https://cloud.google.com/blog/products/containers-kubernetes/best-practices-for-building-kubernetes-operators-and-stateful-apps)

## 未来的新模式

随着Operator的日益普及，出现了新的用法和模式，挑战着传统的最佳实践和设计原则。

### Operator 生命周期管理

随着Operator复杂性和版本化、分布式Controller的增加，需要管理和透明化Operator及其资源。这种模式通过发现性、最小依赖性和声明性 UI 控件来支持Operator的重复使用。此外，随着Operator越来越多地被设计为与预期的最终状态相协调，通过适当的管理在集群中维护生命周期，可以实现新行为的迭代、实验和测试\[1\]。

### 支持策略的Operator

许多Operator在集群中具有静态的基于角色的授权集，用于协调资源。目前正在进行的工作是为Operator提供更动态的访问权限，基于所需的资源协调行为。这可能意味着临时提升权限以直接创建资源，或者请求将自定义资源定义加载到 Kubernetes API 服务器中。

已有的Operator\[2\]已经支持代表Operator进行特权创建资源的功能，扩展到新的模式和操作模型\[3\]。这种模式的未来潜力还包括使用策略引擎来控制Operator授权。

### 参考资料2

\[1\] [Operator Lifecycle Manager](https://olm.operatorframework.io/)

\[2\] [kubeplus](https://github.com/cloud-ark/kubeplus)

\[3\] [Open Application Model](https://oam.dev/)

## 结论

最初，Operator是将有状态应用程序纳入到通常处理无状态工作负载的编排器的一种主流解决方案。它们增强了其 API 的功能，进一步增强了容器编排器的功能，但并没有解决应用程序配置和“第二天”的操作的所有问题。需要记住的是，Operator是一种管理特定要求并促进操作的模式，但它们也带来了一些复杂性，在实施之前应该权衡。

## 相关工作

最初，Operator是由 CoreOS 博客上的一篇文章介绍的。该文章提供了关于Operator的概述，解释了为什么开发了这个概念以及如何构建Operator。本文档的定义主要基于该文章的见解。由于该博客文章只提供了简明的概述，因此本文档更详细地描述了功能、安全性和其他概念。

Kubernetes 文档中介绍了Operator模式的概念，为编写示例Operator提供了概述，并为编写Operator提供了起点。[1]

书籍《Kubernetes Operators》提供了关于Operator的全面概述，介绍了它们解决的问题和不同的开发方法。本文档中的定义汇集了这本书中的内容。同样适用于《Kubernetes Patterns》（Ibryam，2019）一书，该书提供了更多有关Operator的技术和概念见解。本文档中的定义总结了这些书中的内容（以提供Operator的共同声明）。[2]

Michael Hausenblas 和 Stefan Schimanski 的书籍《Programming Kubernetes》 提供了有关 client-go、自定义资源以及编写Operator的更深入的见解。[3]

Google 提供了一篇关于构建 Kubernetes Operator和有状态应用程序的最佳实践的博客文章。本文档的一些建议是根据该博客文章的内容编写的。[4]

许多文档描述了Operator的能力级别（也称为成熟级别）。由于在某些情况下，Operator可能支持处于最高能力级别的所有功能，但不支持某些较低级别的功能，因此本文档选择涵盖“功能”而不是“能力级别”。然而，对于每个能力级别所需的功能也考虑在内。[5]

CNCF TAG 安全性小组在本白皮书中添加与Operator相关的安全性相关主题时付出了很大努力。由于本白皮书的内容主要涵盖与Operator相关的安全措施，因此他们编写了一份有关云原生安全性的白皮书，这是一份非常有用的资源。[6]

### 参考资料3

[1] [https://kubernetes.io/docs/concepts/extend-kubernetes/operator/](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)

[2] Dobies, J., & Wood, J. (2020). Kubernetes Operators. O'Reilly.

[3] Michael Hausenblas and Stefan Schimanski, Programming Kubernetes: Developing Cloud-Native Applications, First edition. (Sebastopol, CA: O’Reilly Media, 2019)

[4] [https://cloud.google.com/blog/products/containers-kubernetes/best-practices-for-building-kubernetes-operators-and-stateful-apps](https://cloud.google.com/blog/products/containers-kubernetes/best-practices-for-building-kubernetes-operators-and-stateful-apps)

[5] Operator Framework. Retrieved 11 2020, 24, from [https://operatorframework.io/operator-capabilities/](https://operatorframework.io/operator-capabilities/), [https://github.com/cloud-ark/kubeplus/blob/master/Guidelines.md](https://github.com/cloud-ark/kubeplus/blob/master/Guidelines.md)

[6] [https://github.com/cncf/sig-security/blob/master/security-whitepaper/cloud-native-security-whitepaper.md](https://github.com/cncf/sig-security/blob/master/security-whitepaper/cloud-native-security-whitepaper.md)

## 致谢

本文档是 CNCF TAG App-Delivery Operator Working Group 的社区驱动成果。感谢所有为本文档做出贡献、参与讨论和审查本文档的人员。

### 贡献者

* Omer Kahani (github.com/OmerKahani)
* Jennifer Strejevitch (github.com/Jenniferstrej)
* Thomas Schuetz (github.com/thschue)
* Alex Jones (github.com/AlexsJones)
* Hongchao Deng (github.com/hongchaodeng)
* Grzegorz Głąb (github.com/grzesuav)
* Noah Kantrowitz (github.com/coderanger)
* John Kinsella (github.com/jlk)
* Philippe Martin (github.com/feloy)
* Daniel Messer (github.com/dmesser)
* Roland Pellegrini (github.com/friendlydevops)
* Cameron Seader (github.com/cseader)

### 审阅者

* Umanga Chapagain (github.com/umangachapagain)
* Michael Hrivnak (github.com/mhrivnak)
* Andy Jeffries (github.com/andyjeffries)
* Daniel Pacak (github.com/danielpacak)
* Bartlomiej Plotka (github.com/bwplotka)
* Phil Sautter (github.com/redeux)
* Roberth Strand (github.com/roberthstrand)
* Anais Urlichs (github.com/AnaisUrlichs)

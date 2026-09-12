# 生产部署与运维

## 构建

镜像目标为 Linux `amd64`，运行阶段使用 Node.js 20，并切换到非 root 的 `node` 用户。

```bash
docker build --platform linux/amd64 -t jiahui:<git-sha> .
```

本机没有 Docker 时，可先完成代码级检查：

```bash
npm ci
npm run check
npm test
npm run build
npm audit --omit=dev
```

正式交付仍需在装有 Docker 的 Linux `amd64` 主机完成镜像构建和启动验收。

## 配置

生产环境至少配置：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
JIAHUI_DEPLOYMENT_MODE=integrated
INTERNAL_SERVICE_TOKEN=<至少32个随机字符>
AI_API_KEY=<secret>
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
AI_REVIEW_ENABLED=true
AI_TIMEOUT_MS=70000
JOB_DATA_DIR=/data/jobs
JOB_CONCURRENCY=2
JOB_RETENTION_HOURS=24
JOB_QUEUE_LIMIT=100
JOB_USER_ACTIVE_LIMIT=10
R2_ALLOWED_HOSTS=<R2签名下载链接的域名>
```

`INTERNAL_SERVICE_TOKEN` 和 `AI_API_KEY` 通过 Compose secret、主机 secret 文件或部署平台的 secret 功能注入。不要写入镜像、Compose 文件或仓库。

## 启动

```bash
docker volume create jiahui-jobs
docker run -d \
  --name jiahui \
  --restart unless-stopped \
  --env-file /opt/tongclass/secrets/jiahui.env \
  -p 127.0.0.1:3301:3001 \
  -v jiahui-jobs:/data \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  jiahui:<git-sha>
```

生产 Compose 中应把嘉会与官网网关放在同一个私有网络。只有官网服务端可以访问嘉会业务接口，无需向公网发布容器端口。

健康检查：

```bash
curl http://127.0.0.1:3301/api/v1/health/live
curl http://127.0.0.1:3301/api/v1/health/ready
```

`live` 只检查进程；`ready` 检查认证配置、模型配置和任务目录，不向模型服务发请求。

## 数据目录与清理

`JOB_DATA_DIR` 保存正在排队、执行中和近期完成的任务。任务文件权限为 `0600`，完成或取消后会移除原始输入，降低 R2 签名链接和用户简报的留存。任务到期后会在服务启动或后续健康检查、创建、查询时清理，默认保留 24 小时。

官网数据库和 R2 保存正式活动数据与文件，按官网既有策略备份。嘉会任务卷只用于短期恢复。升级前可等待队列清空并保留一次卷快照；恢复卷后，服务会把中断时处于 `running` 的任务重新排队。

文件队列当前按单实例运行。增加副本前需改用共享数据库或消息队列。

## 日志

服务向 stdout 输出单行 JSON，字段包括时间、request ID、方法、路径、状态码和耗时。日志不记录请求体、响应体、Authorization、模型 Key 或 R2 签名链接。

可按 `requestId` 关联官网网关日志和嘉会日志。建议为 401、429、5xx、任务失败率、队列长度和就绪检查失败配置告警。

## 升级与回滚

1. 以明确 commit SHA 构建新镜像。
2. 在测试环境运行 `npm test` 和接口冒烟测试。
3. 启动新容器并确认 `ready` 返回 200。
4. 将官网网关切换到新容器。
5. 保留上一镜像和任务卷快照，观察一个发布窗口后再清理。

回滚时把网关切回上一镜像。版本 1.1.0 没有数据库迁移；任务 JSON 为短期数据，旧版本无法识别时可以停止接收新任务、等待当前任务结束后使用空任务卷启动。

## 资源与时延

2026-09-13 在 macOS arm64、Node.js 24.11.1 上使用生产构建进行本地测量。模型地址使用不可达占位值，规则方案没有调用第三方 API。

| 项目 | 本地结果 |
| --- | ---: |
| 空载服务 RSS | 约 74 MiB |
| 50 个并发规则方案后的 RSS | 约 87 MiB |
| 50 个并发规则方案总耗时 | 118 ms |
| 规则方案延迟 p50 / p95 / max | 70 / 84 / 86 ms |
| 规则方案吞吐 | 约 425 请求/秒 |
| 生产依赖目录 | 约 64 MiB |
| 前后端构建产物与模板 | 约 1.6 MiB |
| 单个典型任务文件 | 约 10 KiB |

模型模式的主要时延来自第三方模型。单次调用超时默认 70 秒；启用合理性复核时最多进行两次顺序调用。官网接入使用异步任务接口，默认同时运行 2 项模型任务，队列上限 100，每位用户最多 10 项进行中任务。

初始容器配额建议为 1 vCPU、512 MiB 内存和 1 GiB 任务卷。上线前需要在生产同架构主机使用实际模型账号重复测量，结合官网并发和模型限流调整 `JOB_CONCURRENCY`。

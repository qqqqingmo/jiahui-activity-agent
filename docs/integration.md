# 官网接入说明

## 系统边界

通班官网负责账号登录、角色权限、活动与任务数据、方案版本、反馈记录和长期存储。嘉会作为内网服务，负责方案生成、方案修订、历史资料解析和经费表生成。

官网浏览器只访问官网接口。官网服务端调用嘉会时传入内部服务令牌、请求 ID 和应用范围用户 ID。嘉会不接收浏览器会话令牌。

历史活动文件由官网上传到 R2。官网服务端生成短期签名下载链接后提交给嘉会；嘉会只接受 `R2_ALLOWED_HOSTS` 中的 HTTPS 域名，单次最多 30 个文件，单个文件最多 8 MB。

## 接入顺序

1. 运维部署嘉会镜像，配置模型、内部服务令牌、R2 域名和持久卷。
2. 官网服务端配置嘉会内网地址及相同的内部服务令牌。
3. 官网为每次调用生成 `X-Request-ID`，并把当前用户映射为稳定的 `X-App-User-ID`。
4. 方案生成、修订和资料解析提交到 `POST /api/v1/jobs`。
5. 官网保存返回的任务 ID，轮询 `GET /api/v1/jobs/{jobId}`。
6. 任务成功后，官网将 `result` 写入正式业务表并创建方案版本。
7. 刷新页面后，官网根据数据库中的任务 ID 继续查询。嘉会任务结果默认保留 24 小时。

`X-App-User-ID` 参与任务读取和取消权限判断。不同用户查询同一个任务 ID 时返回 404，减少资源枚举信息。

## 请求示例

```ts
const requestId = crypto.randomUUID();
const response = await fetch(`${JIAHUI_SERVICE_URL}/api/v1/jobs`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${JIAHUI_INTERNAL_TOKEN}`,
    "X-Request-ID": requestId,
    "X-App-User-ID": appUserId,
  },
  body: JSON.stringify({
    operation: "generate-plan",
    input: { brief, mode: "model", knowledgeCases },
  }),
});
```

完整字段、响应和错误结构以仓库根目录的 `openapi.yaml` 为准。

## 任务与业务数据

嘉会的任务目录用于应对模型调用超过网关时间、页面刷新和单进程重启。正式活动、成员分工、执行状态、备注和反馈由官网数据库保存。方案每次生成或修订后建议写入新版本，保留操作者、创建时间、输入反馈和嘉会请求 ID。

当前文件任务队列按单实例部署设计。需要多副本水平扩容时，应先把队列适配到官网统一使用的数据库或消息队列，再由负载均衡分发。

## 接口错误

版本化接口统一返回：

```json
{
  "error": {
    "code": "MODEL_TIMEOUT",
    "message": "模型服务响应超时",
    "retryable": true,
    "requestId": "9c64a3f0-5bb2-4da9-a62e-bf97581661cd"
  }
}
```

常见错误码包括 `INVALID_REQUEST`、`UNAUTHORIZED`、`MODEL_NOT_CONFIGURED`、`MODEL_AUTH_FAILED`、`MODEL_RATE_LIMITED`、`MODEL_TIMEOUT`、`MODEL_INVALID_RESPONSE`、`FILE_SOURCE_NOT_ALLOWED`、`FILE_TOO_LARGE` 和 `JOB_NOT_FOUND`。官网可根据 `retryable` 决定是否展示重试入口。

## 兼容策略

`/api/v1` 是官网稳定接口。新增可选字段保持向后兼容；删除字段、修改含义或收紧已有枚举时发布新的主版本路径。`shared/types.ts` 与 `openapi.yaml` 同步维护。

独立演示使用的 `/api/plan`、`/api/refine` 等接口只在 `standalone` 模式注册。`integrated` 模式不提供模型设置接口和演示页面。

# 嘉会（JIAHUI）

嘉会是一个面向高校集体活动策划与执行的结构化 Agent。名字出自《周易·乾卦》，“嘉是美，会是聚”，意为美好的事物汇聚、众人相会。它根据活动目标、场景、人数、预算范围和限制条件生成可继续推进的活动方案，包括现场流程、任务分工、物资预算、通知和风险处理。

活动方案以结构化方式呈现，负责人、状态、备注和反馈都可以继续修改；方案也支持按自然语言反馈整体调整或导出为 Markdown。

当前官网接入版本为 `v1.1.0`，维护账号为 [@qqqqingmo](https://github.com/qqqqingmo)。

## 主要功能

- 通用活动建模：综合目标、正式程度、参与方式、规模、地点移动、时长和不确定性形成活动画像。
- 能力必要性判断：分别判断交通、分组、主持、彩排、设备检查、奖品、保险、供应商和专用道具是否需要，并在总览展示关键取舍。
- 预算范围：输入预算上下限，系统按实际必要项估算建议支出。
- 历史活动：内置 8 个从过往材料整理的案例；案例可查看详细依据、可复用做法和踩坑提醒，来源材料在本地存在时可直接下载。
- 资料导入：选择本地活动资料文件夹，服务端提取 DOCX、XLSX、TXT、Markdown、CSV 或 JSON 的文本，再由当前模型整理成新案例。
- 任务协作：任务支持添加、编辑、删除、负责人调整、三状态推进、备注和成员反馈。
- 成员视角：选择当前身份后切换“我的任务”，查看该成员负责的任务。
- 方案反馈：指出流程中不合理的环节，模型会同步修改流程、任务、物资、预算、通知和风险。
- 活动文件：在具体活动中下载北京大学学生活动经费支出明细表空白模板，或根据当前活动名称、时间、地点、流程和预算生成预填写 Word 版本。
- 执行进度：按任务优先级和任务状态加权；刚生成且尚未开始执行的方案为 0%。
- 模型配置：左下角可配置任意 OpenAI 兼容 Chat Completions 接口、模型名和 API Key。
- 合理性复核：可选的第二次模型调用，专门检查场景矛盾和冗余环节。

## 快速开始

环境要求：Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开 [http://127.0.0.1:5173](http://127.0.0.1:5173)，然后点击左下角“运行配置”连接模型。

也可以复制环境变量示例：

```bash
cp .env.example .env
```

```dotenv
AI_API_KEY=your_key_here
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
AI_REVIEW_ENABLED=true
PORT=3001
```

为兼容旧配置，仍会读取 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL` 和 `DEEPSEEK_MODEL`，新代码统一使用通用模型接口命名。`.env` 已加入 `.gitignore`，请勿将真实 Key 写入代码或提交记录。

### 生产模式

```bash
npm run build
npm start
```

生产模式监听 `0.0.0.0:3001`，本机可通过 [http://127.0.0.1:3001](http://127.0.0.1:3001) 访问。

### 官网接入模式

官网接入使用 `integrated` 模式。模型配置由运维通过环境变量提供，业务接口需要内部服务令牌、请求 ID 和官网生成的应用用户 ID。浏览器不会直接调用嘉会服务。

```bash
JIAHUI_DEPLOYMENT_MODE=integrated \
INTERNAL_SERVICE_TOKEN=replace_with_a_random_secret \
AI_API_KEY=replace_with_model_key \
R2_ALLOWED_HOSTS=example.r2.cloudflarestorage.com \
npm start
```

接口契约见 [openapi.yaml](./openapi.yaml)，接入步骤见 [docs/integration.md](./docs/integration.md)，部署与回滚见 [docs/operations.md](./docs/operations.md)。

## 生成逻辑

```text
活动简报（含预算范围）
   │
   ├─ 活动画像：目标 / 正式程度 / 参与方式 / 规模 / 空间移动 / 时长 / 不确定性
   ├─ 能力闸门：交通 / 分组 / 主持 / 演练 / 设备 / 奖品 / 保险 / 供应商 / 道具
   ├─ 历史活动检索：类型 + 场地 + 规模 + 标签 + 人均预算 + 迁移条件
   ├─ 规则草案：提供字段骨架、基础计算和可解释的初步判断
   └─ 已配置的模型：独立复核画像和必要性后重写完整方案
          │
          ├─ 可选一致性复核：核对跨模块矛盾和冗余配置
          └─ Zod 结构校验 + 预算范围校验 + 关键判断记录
                     │
                     ▼
                活动方案
        流程 / 分工 / 物资 / 通知 / 风险 / 反馈 / 导出
```

模型会结合活动类型、目标和实际条件逐项判断所需能力，并检查流程、任务、物资、预算和通知之间的一致性。活动时间明显长于目标所需时，系统保留合理的核心流程，并将时间差异列为待确认项。

## 历史活动导入

“历史活动”页面支持选择本地文件夹。目前解析：

- Word：`.docx`
- Excel：`.xlsx`
- 文本：`.txt`、`.md`、`.markdown`
- 表格与数据：`.csv`、`.tsv`、`.json`

单次最多处理 30 个文件、每个文件最多 8 MB。提取后的文本会调用当前配置的模型整理成结构化案例；整理结果保存在浏览器本地，并在后续生成方案时参与检索。资料导入需要先配置模型。

## 数据保存

- 独立演示模式：活动方案、任务编辑、反馈、进度、物资状态和导入案例保存在当前浏览器。
- 官网接入模式：官网数据库保存活动、方案版本、任务、反馈和成员权限；嘉会返回结构化生成结果。
- 异步任务状态：嘉会在 `JOB_DATA_DIR` 中短期保存，默认保留 24 小时，进程重启后会恢复排队任务。
- 模型凭据：从服务端环境变量读取，不进入浏览器、接口响应或请求日志。

## 项目结构

```text
.
├── server/
│   ├── app.ts              # API、模型配置和上传路由
│   ├── activity-profile.ts # 通用活动画像与能力必要性判断
│   ├── expense-form.ts     # 经费表预填写
│   ├── history-import.ts   # DOCX/XLSX/文本提取
│   ├── knowledge.ts        # 内置历史活动与检索
│   ├── model.ts            # 通用模型调用、提示词、复核与资料整理
│   ├── planner.ts          # 规则草案、意图判断和基础计算
│   ├── jobs.ts             # 可恢复的短期异步任务队列
│   ├── remote-files.ts     # R2 签名链接下载与边界检查
│   └── service.ts          # 生成、修订和资料整理服务层
├── shared/types.ts         # 前后端共享数据结构
├── src/
│   ├── components/         # 简报、活动方案、历史活动和运行配置
│   ├── api.ts
│   ├── demoData.ts
│   └── styles.css
├── .env.example
├── Dockerfile
├── openapi.yaml
└── package.json
```

## API

独立演示界面继续使用以下本地接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务与模型状态 |
| `GET` / `PUT` | `/api/settings` | 读取或更新脱敏后的运行配置 |
| `POST` | `/api/settings/test` | 使用极小请求测试模型连接 |
| `GET` | `/api/knowledge` | 读取内置历史活动 |
| `GET` | `/api/knowledge/:caseId/source/:fileIndex` | 下载内置案例的本地来源材料 |
| `POST` | `/api/knowledge/import` | 解析上传资料并整理案例 |
| `POST` | `/api/plan` | 生成活动方案 |
| `POST` | `/api/refine` | 按用户反馈修改完整方案 |
| `GET` | `/api/forms/expense/blank` | 下载空白经费表 |
| `POST` | `/api/forms/expense/prefilled` | 按当前方案生成预填写经费表 |

官网使用 `/api/v1` 版本化接口，包括方案生成与修订、R2 历史资料解析、经费表下载和异步任务。除健康检查外，请求必须携带：

```http
Authorization: Bearer <INTERNAL_SERVICE_TOKEN>
X-Request-ID: <request-id>
X-App-User-ID: <app-scoped-user-id>
```

模型生成、方案修订和资料解析可以提交到 `POST /api/v1/jobs`。任务状态包括 `queued`、`running`、`succeeded`、`failed` 和 `cancelled`。

## 测试

```bash
npm run check
npm test
npm run build
```

自动化测试覆盖预算范围、历史检索、人数/预算联动、通用活动画像、加权执行进度、来源材料下载、经费表生成和 HTTP API。轻量交流、正式大会、校外体育活动与午餐参访等不同场景都作为回归样例。

生产依赖审计可运行 `npm audit --omit=dev`。当前接入接口还覆盖内部认证、请求追踪、用户隔离、异步状态恢复和配置缺失等情况。

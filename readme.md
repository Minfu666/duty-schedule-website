# 图书馆值班管理系统（duty-schedule-website）

这是一个用于“查看值班表 + 管理员交换值班”的小系统。  
当前版本已经改为前后端一体运行，交换后会写入后端文件，刷新页面不会丢失。

## 目前范围（按你的要求）

- 保留：按图片对应的值班结构展示（按楼层、时段）
- 保留：管理员交换/移动值班
- 保留：排序规则统一，保证展示与交换定位稳定
- 保留：后端持久化（最关键）
- 不做：自动排班
- 不做：OCR 图片识别模块

## 核心逻辑

### 1) 排序与定位规则（统一）

数据统一按以下规则排序：

1. 楼层顺序：`二层 -> 三层 -> 四层`
2. 时段顺序：`slot 1 -> slot 2`
3. 时间字符串次序（同楼层同 slot 时）

`slot` 规则：

- 有 `slot` 时直接使用
- 缺失 `slot` 时按时间推断：
  - 含 `19:00` 视为 `slot=2`
  - 其他默认 `slot=1`

这样可保证：

- 前端显示顺序稳定
- 交换时按 `date + floor + slot` 能准确定位

### 2) 交换持久化

交换/移动后会：

1. 更新内存中的排班数据
2. 记录变更日志到后端
3. 将完整排班写回后端 `data/schedule.json`

因此刷新页面后数据仍保留。

## 后端接口

后端文件：`server.js`（Node 原生 `http`，无额外依赖）

- `GET /api/schedule`：读取排班
- `POST /api/schedule`：保存排班
- `GET /api/change-logs`：读取交换日志
- `POST /api/change-logs`：新增日志
- `DELETE /api/change-logs`：清空日志

数据文件：

- `data/schedule.json`：排班主数据
- `data/change_logs.json`：交换日志（自动创建）

## 运行方式

在项目根目录执行：

```bash
npm start
```

启动后访问：

```text
http://localhost:3000
```

说明：

- 推荐通过 `npm start` 启动（可用后端持久化，刷新不丢）。
- 也支持直接打开 `index.html`（离线降级模式）：会读取 `data/schedule_data.js`，并使用浏览器本地存储保存交换结果与日志。

## 主要文件

- `server.js`：后端与静态文件服务
- `script.js`：前端数据加载、排序、交换、日志界面
- `index.html` / `styles.css`：页面结构与样式
- `data/schedule.json`：值班数据
- `data/change_logs.json`：交换日志数据（运行后生成）

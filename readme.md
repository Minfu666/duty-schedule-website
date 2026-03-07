# Duty Schedule (GitHub Pages + Zeabur)

详细部署步骤见：`DEPLOY_ZEABUR.md`

## 目标架构

- 前端：`GitHub Pages`（静态页面）
- 后端：`Zeabur`（Node 服务 + 持久化卷）
- 数据：只放在后端卷，不提交到 GitHub

这套架构下，值班交换后写入 Zeabur 后端，刷新不会回退。

## 后端改造点

后端文件：`server.js`

- 支持 `DATA_DIR` 环境变量（用于 Zeabur Volume 挂载目录）
- 支持 `ALLOWED_ORIGINS` 环境变量（给 `github.io` 开 CORS）
- 数据文件：
  - `${DATA_DIR}/schedule.json`
  - `${DATA_DIR}/change_logs.json`
  - `${DATA_DIR}/schedule_data.js`

API：

- `GET /api/health`
- `GET /api/schedule`
- `POST /api/schedule`
- `GET /api/change-logs`
- `POST /api/change-logs`
- `DELETE /api/change-logs`

## 前端改造点

前端配置文件：`config.js`

- `CONFIG.API.BASE_URL`：后端地址
- 推荐在 GitHub Pages 场景设置为你的 Zeabur 地址，如：
  - `https://your-backend.zeabur.app`

前端逻辑文件：`script.js`

- 所有 API 调用改为基于 `CONFIG.API.BASE_URL`
- API 不可用时，自动降级到本地缓存模式

## 每月文件夹上传流程（保留历史）

新增脚本：`tools/push_month_folder.py`

作用：

1. 读取你每个月的文件夹（可包含一个或多个 `.xlsx`）
2. 解析为日程数据（例如 `3.02-3.15.xlsx`）
3. 先从后端拉取当前全量历史
4. 只覆盖本次上传涉及日期
5. 回写后端，历史月份保留

依赖：

```bash
pip install -r tools/requirements.txt
```

示例命令（从今年 3 月开始）：

```bash
python tools/push_month_folder.py --folder "E:\\duty-schedule-website\\monthly-data\\2026-03" --api "https://your-backend.zeabur.app" --year 2026
```

建议每个月单独建一个目录（例如 `monthly-data/2026-03/`），目录内只放当月 `.xlsx`，避免误导入其他月份文件。

## Zeabur 部署配置

已添加 `zbpack.json`：

- `build_command`: `npm install`
- `start_command`: `npm run start`

部署后建议配置环境变量：

- `DATA_DIR=/data`（示例，需与你挂载卷路径一致）
- `ALLOWED_ORIGINS=https://<你的用户名>.github.io,https://<你的自定义前端域名>`

## 数据不进 GitHub

`.gitignore` 已加入：

- `data/schedule.json`
- `data/change_logs.json`
- `data/schedule_data.js`
- `data/monthly/`
- `monthly-data/`
- `*.xlsx`

注意：如果这些文件之前已经被 Git 跟踪，需要执行一次取消跟踪（保留本地文件）：

```bash
git rm --cached data/schedule.json data/change_logs.json data/schedule_data.js
git rm --cached *.xlsx
```

## 本地运行

```bash
npm install
npm start
```

访问：`http://localhost:3000`

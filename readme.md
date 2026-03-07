# 图书馆值班管理系统（GitHub Pages + Supabase）

## 这个项目是做什么的

这是一个值班排班展示与交换系统，核心功能是：

1. 展示每天二层/三层/四层的值班信息（每层 2 个时段）
2. 管理员在页面中执行“交换/移动”操作
3. 把修改结果持久化到 Supabase，页面刷新后不丢失
4. 记录更换日志（谁和谁交换、时间、位置）

## 当前最小架构（已精简）

- 前端：GitHub Pages（静态）
- 数据后端：Supabase（REST + PostgreSQL）
- 月度导入：`tools/push_month_folder.py`（本地脚本，读取 `.xlsx` 上传）

## 必要与不必要

必要：

- `index.html`
- `styles.css`
- `script.js`
- `config.js`
- `supabase/schema.sql`
- `tools/push_month_folder.py`
- `.github/workflows/deploy-pages.yml`

不必要（已移除）：

- Zeabur 部署文件与说明
- 本地 Node API 服务（`/api/*`）
- GitHub Token 云同步模块
- `data/schedule_data.js` 前端静态注入模式
- 自动排班模块
- OCR 预处理模块（按你的流程改为线下转换后再导入）

## Supabase 一次性初始化

1. 在 Supabase 控制台打开 SQL Editor
2. 执行 [`supabase/schema.sql`](supabase/schema.sql)
3. 在 [`config.js`](config.js) 填入：
   - `CONFIG.SUPABASE.URL`
   - `CONFIG.SUPABASE.ANON_KEY`

说明：前端只使用 `anon key`，不要放 `service_role key`。

## 每月导入流程（保留历史）

建议每月一个目录，例如 `monthly-data/2026-03/`，目录里放当月 `.xlsx`。

先试运行：

```bash
python tools/push_month_folder.py --folder "E:\duty-schedule-website\monthly-data\2026-03" --year 2026 --dry-run
```

再正式上传：

```bash
python tools/push_month_folder.py --folder "E:\duty-schedule-website\monthly-data\2026-03" --year 2026 --supabase-url "https://<your-project>.supabase.co" --supabase-service-key "<service_role_key>"
```

脚本会仅覆盖本次上传涉及的日期，不会清空历史月份。

## GitHub Pages 部署与 404 排查

本仓库已提供 Pages workflow：[`deploy-pages.yml`](.github/workflows/deploy-pages.yml)。

请在 GitHub 仓库设置中确认：

1. `Settings -> Pages -> Source` 选择 `GitHub Actions`
2. 默认分支是 `main`
3. Actions 里 `Deploy Pages` 工作流运行成功

如果出现 404，按顺序检查：

1. 根目录存在 [`index.html`](index.html)
2. 资源路径用相对路径（当前已是 `styles.css` / `script.js`）
3. 等待 1-3 分钟后强刷
4. 查看 Actions 的失败日志（最关键）

## 数据文件与 Git

`.gitignore` 已忽略每月原始 `.xlsx` 和本地 `data/` 数据，避免把敏感排班文件直接上传到 GitHub。

## 本地检查

```bash
npm test
node --check script.js
python tools/push_month_folder.py --folder "E:\duty-schedule-website" --year 2026 --dry-run
```

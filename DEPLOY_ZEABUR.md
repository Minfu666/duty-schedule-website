# Zeabur + GitHub Pages 部署说明

## 1. 部署后端到 Zeabur

1. 在 Zeabur 新建项目并连接 GitHub 仓库。
2. 选择 Node 服务（仓库根目录部署）。
3. 为服务挂载持久化卷，挂载路径建议 `/data`。
4. 设置环境变量：
   - `DATA_DIR=/data`
   - `ALLOWED_ORIGINS=https://<你的GitHub用户名>.github.io`
5. 启动命令使用仓库内 `zbpack.json`，即：
   - `npm install`
   - `npm run start`
6. 部署完成后，拿到后端地址，例如：
   - `https://your-backend.zeabur.app`

## 2. 配置前端（GitHub Pages）

编辑 `config.js`：

```js
API: {
  BASE_URL: 'https://your-backend.zeabur.app'
}
```

然后推送到 GitHub，让 Pages 更新。

## 3. 每月上传排班文件夹（保留历史）

本地执行：

```bash
pip install -r tools/requirements.txt
python tools/push_month_folder.py --folder "E:\\your-month-folder\\2026-03" --api "https://your-backend.zeabur.app" --year 2026
```

脚本行为：

1. 读取月度文件夹中的 `.xlsx`
2. 解析为排班日期
3. 从后端读取现有全量数据
4. 合并（只覆盖本月涉及日期）
5. 回写后端

这样旧月份会保留，新月份会增量更新。

## 4. 数据文件不进 GitHub

仓库已忽略以下文件：

- `data/schedule.json`
- `data/change_logs.json`
- `data/schedule_data.js`
- `monthly-data/`
- `*.xlsx`

若历史上已跟踪过，需要执行：

```bash
git rm --cached data/schedule.json data/change_logs.json data/schedule_data.js
git rm --cached *.xlsx
```

# GPT Image Generator

一个极简的 GPT 图片生成 Web 应用。

**没有框架、没有数据库、没有额外依赖。**
前端使用原生 HTML / CSS / JavaScript，后端使用 Node.js 原生 `http` 服务，开箱即用，适合个人部署、内网部署和二次改造。

![1777815956018.png](assets\1777815956018.png)

## 特性

- 极简架构：仅 `server.js + index.html + script.js + styles.css`
- 零外部运行时依赖：无需 `npm install`
- 服务端代理上游图片接口，前端不暴露 API Key
- 支持 GPT 图片生成
- 支持 3 种尺寸：`1024x1024`、`1024x1792`、`1792x1024`
- 支持本地保存生成结果和历史记录
- 支持历史分页：每页 50 条
- 支持历史排序：按时间 / 按点赞
- 支持单浏览器点赞切换
- 支持图片预览、下载、复制
- 适合快速部署到云服务器、Windows 主机、NAS 或局域网机器

## 为什么说它极简

这个项目刻意保持最少抽象：

- **前端**：纯静态页面，无构建流程
- **后端**：单文件 HTTP 服务，无 Express / Koa
- **存储**：本地文件存储，无 MySQL / Redis
- **配置**：一个 `.env` 即可完成上游对接
- **部署**：装好 Node.js 后直接启动

如果你想要一个**可自己掌控、便于分享、便于私有部署**的图片生成站点，这种结构非常直接。

## 项目结构

```text
GTP-Image-web/
├── server.js          # Node.js 原生 HTTP 服务
├── index.html         # 页面结构
├── script.js          # 前端交互逻辑
├── styles.css         # 页面样式
├── .env.example       # 环境变量示例
├── data/
│   ├── history.json   # 历史记录
│   └── images/        # 本地缓存的生成图片
└── README.md
```

## 运行环境

- Node.js >= 14
- 一个可用的上游图片生成 API

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd GTP-Image-web
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，然后填写你自己的上游接口地址和密钥：

```env
BASE_URL=https://your-api-host.example.com/v1/images/generations
API_KEY=sk-your-api-key
```

### 3. 启动服务

```bash
npm start
```

或者：

```bash
node server.js
```

启动成功后会看到类似输出：

```text
Server running at http://localhost:3000
API endpoint configured: yes
Authorization header configured: yes
```

然后浏览器打开：

```text
http://localhost:3000
```

## 部署说明

### 方式一：本地或 Windows 服务器部署

适合个人电脑、办公室机器、内网服务器：

```bash
npm start
```

默认端口：

```js
const PORT = 3000;
```

如需修改端口，可直接编辑 [server.js](server.js)。

### 方式二：云服务器 / Linux / NAS 部署

推荐步骤：

1. 安装 Node.js
2. 上传项目文件
3. 配置 `.env`
4. 运行 `node server.js`
5. 使用 Nginx / Caddy 反向代理到 `3000` 端口

示例反向代理思路：

- 外部访问域名：`https://your-domain.com`
- 应用监听地址：`http://127.0.0.1:3000`

### 方式三：局域网共享访问

当前服务监听的是 `0.0.0.0`，局域网内其他设备可直接通过你的机器 IP 访问，例如：

```text
http://192.168.1.100:3000
```

如果无法访问，请检查：

- 防火墙是否放行 3000 端口
- 设备是否在同一局域网
- 服务是否已正常启动

## 使用流程

1. 首次使用输入用户名
2. 输入提示词
3. 选择图片尺寸
4. 点击“生成图片”
5. 生成结果会展示在当前页面
6. 同时写入本地历史记录
7. 可在历史区进行预览、点赞、翻页、排序

## 本项目依赖的上游 API 是什么

这是最关键的部分。

本项目**不是直接集成某一个固定厂商 SDK**，而是通过服务端代理一个“图片生成接口”。
只要你的上游接口满足下面的格式，就可以接入。

### 1. 请求方式

项目会向上游发送：

- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authorization**: `Bearer <API_KEY>`

### 2. 请求地址规则

`.env` 中的 `BASE_URL` 支持以下几种写法：

#### 写完整地址

```env
BASE_URL=https://your-api-host.example.com/v1/images/generations
```

#### 写到 `/v1`

```env
BASE_URL=https://your-api-host.example.com/v1
```

程序会自动补成：

```text
https://your-api-host.example.com/v1/images/generations
```

#### 写基础域名

```env
BASE_URL=https://your-api-host.example.com
```

程序也会自动补成：

```text
https://your-api-host.example.com/v1/images/generations
```

### 3. 上游接口请求体格式

前端当前发送的请求体如下：

```json
{
  "model": "gpt-image-2",
  "prompt": "一只橘猫坐在窗边看雨，电影感构图，高细节",
  "size": "1024x1024",
  "n": 1
}
```

字段说明：

| 字段       | 类型   | 说明                             |
| ---------- | ------ | -------------------------------- |
| `model`  | string | 当前固定为 `gpt-image-2`       |
| `prompt` | string | 用户输入的提示词                 |
| `size`   | string | 图片尺寸                         |
| `n`      | number | 生成数量，当前前端实际使用 `1` |

### 4. 上游接口返回格式要求

项目兼容两种常见返回格式。

#### 格式 A：返回 Base64

```json
{
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUg..."
    }
  ]
}
```

#### 格式 B：返回图片 URL

```json
{
  "data": [
    {
      "url": "https://your-image-host.example.com/output/abc.png"
    }
  ]
}
```

### 5. 程序如何处理上游结果

- 如果上游返回 `b64_json`：服务端会写入本地文件，再返回本地可访问路径
- 如果上游返回 `url`：服务端会下载图片到本地，再返回本地可访问路径
- 前端最终统一使用本站路径展示图片，例如：

```text
/api/images/img_1740000000000_0.png
```

### 6. 适配什么类型的接口

最适合的是 **OpenAI Images API 风格** 或 **兼容 OpenAI Images API 的中转接口**。

也就是说，你的上游只要大致兼容：

```text
POST /v1/images/generations
```

并且支持：

- Bearer Token 鉴权
- JSON 请求体
- 返回 `data` 数组
- 数组项中包含 `b64_json` 或 `url`

本项目就可以直接工作。

## 本地 API

除了上游接口，这个项目自身也暴露了一组本地 API，供前端页面调用。

### `POST /api/generate`

代理图片生成请求到上游接口。

### `GET /api/history?page=1&pageSize=50&sort=time`

读取历史记录。

查询参数：

| 参数         | 说明                  |
| ------------ | --------------------- |
| `page`     | 页码，从 1 开始       |
| `pageSize` | 每页数量，默认 50     |
| `sort`     | `time` 或 `likes` |

返回示例：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 50,
  "total": 0,
  "totalPages": 0,
  "sort": "time"
}
```

### `POST /api/history`

写入一条历史记录。

### `POST /api/history/:id/like`

切换某条历史记录的点赞状态，并更新点赞数。

请求体示例：

```json
{
  "liked": true
}
```

### `DELETE /api/history`

清空全部历史记录。

### `DELETE /api/history/:id`

删除单条历史记录。

### `GET /api/images/:filename`

访问本地缓存图片。

## 数据存储说明

本项目不使用数据库，数据都存在本地文件：

- 历史记录：`data/history.json`
- 图片文件：`data/images/`

这意味着：

- 部署简单
- 迁移简单
- 备份简单
- 适合轻量使用

但也意味着：

- 不适合超大规模并发
- 不适合多机共享同一份历史记录
- 不适合复杂权限系统

## 安全与分享建议

- `.env` 不要提交到 GitHub
- 对外分享项目时保留 `.env.example`
- API Key 只放在服务端 `.env`
- 如果部署到公网，建议配合反向代理和 HTTPS
- 如需更严格权限控制，可在 `server.js` 上继续增加鉴权逻辑

## 常见问题

### 1. 启动时报 `未配置 BASE_URL`

说明你还没有正确配置 `.env`。

请检查：

```env
BASE_URL=https://your-api-host.example.com/v1/images/generations
API_KEY=sk-your-api-key
```

### 2. 页面能打开，但生成失败

通常检查这几项：

- `BASE_URL` 是否正确
- `API_KEY` 是否有效
- 上游接口是否真的兼容 `POST /v1/images/generations`
- 上游返回是否包含 `data`
- `data` 内是否提供 `b64_json` 或 `url`

### 3. 为什么不用数据库？

因为这个项目追求的是：

- 简单
- 可控
- 易部署
- 易分享

对于个人项目、小团队内部工具、演示站，这种方案往往更省事。

## License

MIT

# NewsNow Desktop Glass · 桌面液态玻璃新闻卡片

> **这是基于 [newsnext/newsnow](https://github.com/newsnext/newsnow) 改装的第三方 Windows 桌面版，不是 NewsNow 官方桌面客户端，也不是从零开发的新闻聚合项目。**
>
> 新闻聚合、内容源、网页界面、缓存和登录等基础能力来自上游 NewsNow。此仓库由 [yanyan759](https://github.com/yanyan759) 维护改装，主要增加桌面嵌入、拖动缩放和桌面背景折射效果。保留上游 MIT 许可证及原作者 ourongxing 的版权声明。

将新闻阅读器放到 Windows 桌面，像小组件一样移动、缩放；透过玻璃卡片看到当前壁纸和桌面图标，曲面边缘呈现折射、拉伸、轻微色散与高光。

## 与原项目的关系

| 部分 | 来源 / 改装范围 |
| --- | --- |
| 新闻聚合网站、各新闻源和后端服务 | 来自 [NewsNow](https://github.com/newsnext/newsnow)，保留原项目结构 |
| Windows 桌面外壳 | 新增 `desktop-widget/`，Electron + Win32 原生桌面子窗口 |
| 液态玻璃背景 | 本改装版新增：采集桌面图标层、读取静态壁纸，通过 WebGL 模拟曲面折射 |
| 新闻顺序 | 「最热」前三项调整为 **36氪 → GitHub → 华尔街见闻**，其余内容源继续保留 |
| 本地运行 | 增加服务启动与退出管理、桌面快捷方式、位置保存、缩放适配和页面缓存刷新 |

本地基础源码来自用户提供的 NewsNow ZIP，未包含上游 Git 历史，无法准确还原该 ZIP 对应的上游提交。因此这里按改装版本管理，不宣称与当前上游 main 完全一致。保留的网页代码还包含本地 PWA 更新与依赖调整。

原版说明的存档见 [上游中文 README](docs/upstream/README.zh-CN.md)；最新说明以 [上游仓库](https://github.com/newsnext/newsnow) 为准。

## 功能

- **桌面嵌入**：挂在 Windows 桌面宿主上，不占任务栏；普通应用可以正常遮挡卡片。
- **拖动与缩放**：拖动顶部移动，拖动四边或四角调整大小；窄时单列，拉宽自动多列，位置与尺寸自动保存。
- **背景折射**：真实静态壁纸和桌面图标作为纹理，使用曲面法线、折射率与 GPU 着色器计算采样偏移；不是只给窗口降低透明度。
- **清晰文字**：新闻文字独立于背景折射层，保持正常阅读和点击。
- **托盘控制**：显示、隐藏、刷新、恢复默认位置、重新贴到桌面和完全退出。
- **一键启动**：首次安装后双击桌面快捷方式，自动启动本地新闻服务，无需每次打开终端。
- **保留网页能力**：热门 / 实时 / 关注栏目、缓存，以及配置后可用的 GitHub 登录与同步能力。

## 环境要求

- Windows 10 / 11；当前验证环境为 Windows 桌面与 200% 显示缩放。Explorer 桌面嵌入属于系统相关实现，其他版本可能需要适配。
- **Node.js 24.16.0 或更新的 24.x**，并将 `node` 加入 PATH。本改装使用的代理启动参数需较新的 Node，勿直接沿用上游旧版 Node 20 要求。
- Corepack，以及项目固定的 **pnpm 10.30.3**。桌面外壳独立使用 npm 安装。
- 可正常使用 WebGL 的显卡驱动；网络能访问各新闻源与依赖下载服务。

## 首次安装（PowerShell）

克隆本仓库并进入项目目录后运行以下命令。

### 1. 安装并构建网页

```powershell
# 如果没有 corepack 命令，先执行：npm install --global corepack
corepack pnpm install --frozen-lockfile

# 首次安装时创建本地配置；已有配置不要覆盖
if (-not (Test-Path .env.server)) {
  Copy-Item example.env.server .env.server
}

corepack pnpm build
```

本地新闻阅读可不配置 GitHub OAuth。示例配置的 `INIT_TABLE=true` 与 `ENABLE_CACHE=true` 用于初始化本地缓存。若需要登录和同步，再填写自己的 `G_CLIENT_ID`、`G_CLIENT_SECRET` 和 `JWT_SECRET`；回调地址为你的站点地址加 `/api/oauth/github`。

`.env.server` 包含本机配置，不纳入版本控制。

### 2. 安装桌面外壳

```powershell
Set-Location desktop-widget
npm ci
npm run setup

# 把本机真实 Node 路径写入配置；不要填写 electron.exe
$nodeExecutable = (Get-Command node -CommandType Application).Source
$configJson = @{ nodePath = $nodeExecutable } | ConvertTo-Json
[System.IO.File]::WriteAllText(
  (Join-Path (Get-Location).Path 'config.json'),
  $configJson,
  [System.Text.UTF8Encoding]::new($false)
)

# 创建桌面快捷方式
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-shortcut.ps1

# 也可直接启动
npm start
```

`config.example.json` 提供配置格式。实际 `config.json` 因包含本机路径而被 Git 忽略。请保留项目文件夹和 Node 安装位置，快捷方式依赖它们。

如果 `npm run setup` 下载 Electron 失败，请检查网络连接后重试。服务端口固定为 `127.0.0.1:4444`；端口冲突时会显示错误。

### 3. 日常使用

双击桌面 **NewsNow 新闻卡片**，然后回到桌面查看。

- 拖动顶部「NewsNow 桌面新闻」移动卡片。
- 拖动边缘或右下角缩放；最小为 280×240。
- 右上角「⋯」或系统托盘右键打开菜单。
- 隐藏后再次双击快捷方式可恢复；「完全退出」只关闭插件自己启动的新闻服务。
- 新闻链接使用系统默认浏览器打开。
- 默认不添加开机自启。

更多说明见 [桌面插件使用说明](desktop-widget/使用说明.md)。

## 液态玻璃如何实现

1. 后台工作线程通过 Win32 `PrintWindow` 获取 Explorer 的桌面图标层，保留透明通道；从 Windows 读取当前静态壁纸。
2. 把背景纹理与窗口的物理坐标发送到隔离的渲染上下文。
3. WebGL 根据圆角玻璃曲面计算法线，用 `refract` 模拟光线折射；边缘加入少量色散和高光。
4. 新闻内容使用单独的 DOM 前景层，不参与变形。窗口移动或缩放时重新计算取景位置。

桌面图标与壁纸约每 2 秒检查变化；静止且内容不变时不重复上传纹理或持续重绘。正式运行在本机内存处理背景，不向远端上传或写入截图。

技术思路参考 [liquidGL](https://github.com/naughtyduk/liquidGL) 和 [archisvaze/liquid-glass](https://github.com/archisvaze/liquid-glass) 的背景纹理与折射方案；本仓库未直接引入它们的代码或包。桌面采样基于 [Microsoft PrintWindow 文档](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-printwindow)。[Electron 官方说明](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles)指出，普通 CSS 模糊无法直接处理窗口外的内容，因此需要额外的桌面取景层。

### 当前边界

- 支持静态壁纸与 Explorer 图标；不支持动态壁纸视频逐帧折射，多显示器 / 不同 DPI 组合尚未全面验证。
- 这是实时图形模拟，不是操作系统自带的 Liquid Glass，也不是完整物理光线追踪。
- **图标可见不等于鼠标穿透**：卡片区域仍接收新闻点击，不会自动重新排列桌面图标。
- 显卡上下文失效时退回半透明样式，可刷新恢复。Explorer 更新后可尝试「重新贴到桌面」。
- 浏览器和 Docker 运行的是网页，只有 Windows 桌面外壳提供桌面嵌入与背景折射。
- 已验证内部渲染、折射条纹、实际图标采样、拖动缩放与原生窗口层级；最近一次全桌面视觉复核受锁屏影响未完成，不将内部截图等同于所有环境的屏幕显示保证。

## 开发和验证

项目根目录：

```powershell
corepack pnpm dev
corepack pnpm exec vitest run
corepack pnpm build
```

桌面外壳目录：

```powershell
npm test
node --test qa/desktop-capture.test.cjs
# 以下测试启动真实桌面窗口；运行前完全退出插件
node qa/refraction-check.cjs
node desktop.integration.cjs
```

原生测试需要 Windows 桌面会话；集成测试会移动并缩放卡片。验收脚本可能把桌面图标等个人内容写入 `desktop-widget/qa/` 截图，输出已被 Git 忽略。仓库保留可复现的源码和测试，不包含本机截图、数据库、日志、依赖目录或构建产物。

更新网页后重新运行 `corepack pnpm build`，然后完全退出卡片并启动。项目沿用上游的网页部署结构，云部署与新增数据源可参考 [原版说明](docs/upstream/README.zh-CN.md) 和 [贡献指南](CONTRIBUTING.md)。

## 目录

```text
src/                 NewsNow 网页前端
server/              新闻源抓取与 API
shared/              共享类型、内容源与栏目配置
desktop-widget/      Windows 桌面外壳、取景、折射与测试
docs/upstream/       收到的原项目 README 存档
```

## 致谢与许可证

感谢 [newsnext/newsnow](https://github.com/newsnext/newsnow)、原作者 **ourongxing** 及上游贡献者。本项目的新闻聚合基础由他们提供，桌面改装不替代或抹去上游署名。

沿用 [MIT License](LICENSE)，保留 `Copyright (c) 2024 ourongxing`。改装维护者：[@yanyan759](https://github.com/yanyan759)。新闻内容、图标与第三方商标的权利归相应权利人所有。

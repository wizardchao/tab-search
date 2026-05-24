# Tab Search

Chrome 浏览器扩展 - 快速搜索和切换已打开的标签页

## 项目背景

在日常使用浏览器时，我们经常会打开大量标签页，导致难以快速找到并切换到目标页面。Tab Search 扩展旨在解决这一痛点，通过简单的快捷键或点击图标，即可打开搜索框，输入关键字快速定位并跳转到目标标签页。

## 功能特性

- 快速搜索已打开的标签页
- 按相似性和最近使用排序
- 支持快捷键打开（Ctrl+Shift+F / Command+Shift+F）
- 点击搜索结果即可跳转
- 支持自定义设置

## 技术栈

- **Chrome Extension Manifest V3**: 使用最新的 Chrome 扩展清单版本
- **原生 JavaScript**: 无框架依赖，轻量高效
- **HTML/CSS**: 构建用户界面
- **Chrome API**:
  - `tabs` API: 获取和管理标签页
  - `storage` API: 存储用户设置
  - `commands` API: 注册快捷键

## 项目结构

```
tab/
├── manifest.json      # 扩展配置文件
├── background.js      # 后台服务脚本
├── content.js         # 内容脚本
├── popup.html         # 弹出窗口 HTML
├── popup.js           # 弹出窗口逻辑
├── popup.css          # 弹出窗口样式
├── options.html       # 设置页面 HTML
├── options.js         # 设置页面逻辑
├── icons/             # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── build.sh           # 打包脚本
└── README.md          # 项目说明文档
```

## 打包方式

### 使用打包脚本

```bash
# 赋予脚本执行权限（首次使用）
chmod +x build.sh

# 执行打包
./build.sh
```

打包脚本会：
1. 清理并创建 `dist/` 目录
2. 复制所有扩展文件到 `dist/`
3. 生成 `tab-search.zip` 压缩包

### 打包产物

- **未打包扩展**: `dist/` 目录，可用于 Chrome 开发者模式加载
- **打包扩展**: `tab-search.zip`，可上传至 Chrome 网上应用店

## 安装使用

### 开发模式安装

1. 打开 Chrome 浏览器，访问 `chrome://extensions`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist/` 目录

### 使用方法

- **快捷键**: `Ctrl+Shift+F` (Windows/Linux) 或 `Command+Shift+F` (Mac)
- **点击图标**: 点击浏览器工具栏中的 Tab Search 图标
- **搜索**: 输入关键字，从搜索结果中点击目标标签页即可跳转

## 权限说明

- `tabs`: 获取所有已打开标签页的信息
- `storage`: 存储用户自定义设置

## 开源协议

MIT License

# 1.0.1-security-rc1 验收记录

日期：2026-10-28；源码提交：`3838d49`。仅本地候选包，不是已发布的正式安全认证版本。

## 构建与校验

产物位于 `/Users/serge/Downloads/`，未覆盖仓库 `releases/` 的旧 ZIP。

| 包 | SHA256 |
| --- | --- |
| `BAW-Original-Multiwallet-Mac-1.0.1-security-rc1.zip` | `fe16981abb3fc792a4043af9eed27b7319928a59e4c7c2ddef54372c99438d06` |
| `BAW-Original-Multiwallet-Windows-1.0.1-security-rc1.zip` | `2f5430c8c7f5de48b7fbefe7b9fc5af54a253697bc708440d0d640d1d061f172` |

每包附 `.zip.sha256`；程序内 `release-metadata.json` 记录源码提交。包内文件清单逐项复核通过，修复模块与工作区逐字节一致；1879 个未修改原始文件保持一致。

## 已执行

- `git diff --check`；Python 打包脚本 AST 语法检查。
- `node tests/run-safe.mjs`：Node 26.11.1，46/46 通过。
- `npm exec --yes --package=node@24.13.0 -- node tests/run-safe.mjs`：Node 24.13.0，46/46 通过。
- `node --import ./tests/network-guard.mjs tests/security-browser.mjs`：源码 Chrome CSP 初始化与恶意符号文本渲染通过。
- `python3 packaging/build.py`：Mac arm64/x86_64 编译，ad-hoc 签名校验通过；未经 Apple 公证。
- `python3 packaging/verify-package.py`：Mac arm64 临时路径安装、精确复制、拒绝无标记目录、端口保护、更新备份通过；未注册个人 Native Messaging 组件。
- `python3 packaging/build-windows.py`：Windows ZIP、payload 清单及 SHA256 校验通过。
- 两个 ZIP 在临时目录展开，分别运行 `node --test tests/http.test.mjs tests/security-http.test.mjs tests/security-runtime.test.mjs tests/security-ui.test.mjs tests/original-integrity.test.mjs`：各 13/13 通过；两包均通过 `tests/security-browser.mjs`。

包内测试将仓库 tests 与原始 SHA 清单复制到临时 program 目录，使用虚拟 CLI、临时数据与浏览器 profile。NODE_OPTIONS 使用 file URL，避免含中文/空格路径被拆分。首次验收参数错误已更正；Chrome 不能使用空白临时 HOME 运行其系统辅助程序，改为保持 OS HOME，仍强制临时 --user-data-dir。最后两包 Chrome 均退出 0。

详细本地结果：`/Users/serge/Downloads/BAW-1.0.1-security-rc1-acceptance.json`。两个包的共享逻辑检查均运行于 macOS arm64，不能作为 Windows 或 Intel 原生验收结论。

## 尚待平台验收

- Windows x64 / Node 24：在隔离 Windows 测试机展开本修复包，将原包 node_modules 放到该源码检出目录，再执行以下命令，使用本包路径，不使用旧 rc5 包。

```powershell
node tests/run-safe.mjs
node tests/windows-e2e.mjs "C:\QA\BAW-Original-Multiwallet-Windows-1.0.1-security-rc1"
node tests/windows-native-e2e.mjs "C:\QA\BAW-Original-Multiwallet-Windows-1.0.1-security-rc1"
```

- 现有 Windows CI 固定引用旧 rc5，不能证明本候选包；本次未推送源码或触发远端 CI。
- Intel Mac 安装器运行；隔离 Chrome profile 中真实扩展加载、侧栏 iframe、按需启动/复用与占用端口报错。扩展安装/组件注册仍须明确授权。
- 当前主机 8787 被 Python PID 19057 占用；未终止或修改该服务。

## 真实钱包验证安排

平台验收未完成前不进入真实钱包阶段。先完成真实扩展与虚拟 CLI 端到端检查，记录操作系统、Node/CLI 版本、包 SHA 和结果。

平台通过后再由用户明确授权指定设备、独立测试身份、独立 BAW_DATA_DIR 与配对操作。第一阶段只检查配对、地址隔离、余额和预演；预演结果必须确认没有 execute/swap/claim。私钥不进入浏览器输入或测试记录。

真实买卖、授权或转账不在本次执行范围。若后续需要，以明确链、代币、金额、gas/滑点上限与单次执行授权另行确认，不直接开启自动买入或跟单。

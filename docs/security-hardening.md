# 本地安全修复与验证

本地仓库 `/Users/serge/crypto/meme-bsc/baw-8788`，远端 `https://github.com/zxlls666/8788.git`，分支 `local/security-hardening`，基于审计提交 `31e4ff3c01645293e4ee0bf6e2eb57e770f4f468`。

原始审计及复现留在 `/Users/serge/crypto/meme-bsc/audits/8788-31e4ff3/review-20261028/`，未移动或改写。本文只记录本地修复，原审计结论仍适用于未修复提交及其 ZIP。

## 变更

| 审计项 | 本地实现 |
| --- | --- |
| SEC-01 XSS | 转义代币/计价符号、状态等外部 HTML 文本；页面 CSP 限制为本地脚本及确切入口脚本哈希；应用私钥后清空输入框 |
| SEC-02 预演 | 四条 DEX/Gang 路径预演只报价；PHASE 3 预演不 claim；服务端对执行接口及 CLI `execute/swap` 再次拦截；直接私钥签名入口要求真实模式 |
| SEC-03 默认状态 | 快速模式默认关闭；开启快速模式不再改写预演偏好 |
| SEC-04 停止竞态 | 每次启用/停止更新执行代次，预演后核对授权；旧一轮任务即使随后重新启用也不能执行 |
| SEC-05 日预算 | 按链 56、钱包及 Asia/Shanghai 日期保留每日预算；执行前锁定并原子写入预留，重启后仍有效；已预留代币不重复提交 |
| SEC-06 HTTP | 仅接受回环 Host/匹配端口、同源或固定扩展 Origin；跨站 API 拒绝无 Origin 请求；CSP 仅允许本页及固定扩展嵌入；health 必须鉴权 |

服务端缺少或收到非 `0` 的 `x-baw-preview-only` 时，默认预演。真实模式必须明确使用 `x-baw-preview-only: 0`，同时通过桥 token、来源和原有交易校验。页面会根据当前预演开关发送该请求头；原有脚本若不声明执行模式将被阻止。该头不是新的身份凭据，同源页面失陷仍是风险。

`/api/launcher-status` 保留无鉴权、无钱包访问的就绪探测，供固定扩展和本地启动器使用。扩展 ID 从现有 manifest 公钥计算，不扩大到所有扩展；未把合法侧栏 iframe 一并禁用。

预算账本为 `BAW_DATA_DIR/autobuy-budget.json`（未指定时沿用程序默认数据目录），含钱包地址等运行元数据，不入 Git。预留失败、不确定提交及执行失败均不会自动退回次数，以避免超额或重复买入；`spentBnb` 代表保守预留量，不是已确认链上成交量。断电持久性、链上对账与自动额度退款不在本次实现中。

遗留写锁或账本损坏会阻止提交。应先停服务、核对未决交易，再由操作者处理账本/锁；不得直接删文件使预算归零。

## 本地放置与状态

- 源码、独立 `.git` 和本地测试依赖已就位；没有运行 npm 生命周期安装脚本。
- 没有安装应用/Chrome 扩展/Native Messaging 组件，没有登录或连接真实钱包，没有实盘或后台服务部署，没有推送远端。
- 当前 `releases/` 的全部 ZIP 是上游原始包，**不包含修复**。打包白名单已增加两个新运行模块；本次未构建或发布修复版安装器。
- 父工作区已忽略整个 `meme-bsc/`，该项目由自己的 Git 仓库管理，不需要修改父仓库。
- 启动前必须核对 8787 端口；此前发现该端口已有 Python 进程，本次未停止它或更改全局端口。

## 验证

```sh
# 全套虚拟钱包回归，临时 HOME/数据目录，阻断外部 fetch/WebSocket
node tests/run-safe.mjs

# 可选真实 Chrome 验证；仅临时 profile、本机服务、虚拟 CLI 和模拟 RPC
node --import ./tests/network-guard.mjs tests/security-browser.mjs
```

本次环境为 macOS / Node 26.11.1。46 项自动回归通过；Chrome 检查确认实际页面能在 CSP 下初始化，恶意符号在不依赖 CSP 的渲染夹具中也仅作为文本显示。

测试覆盖身份隔离、跟单去重、安装器模拟、HTTP 边界、并发请求预演隔离、预算重新加载/重复/写锁/损坏、停止及旧代次阻断，以及 UI 的四条预演路径。未测试真实配对、链上成交、真实扩展加载、Windows 桌面或 Node 24 运行矩阵。CLI、链上合约、RPC、原始私钥模式及原审计“其他观察”中的事项仍需单独评估，不能把本次修复视为全面安全认证。

## 本次修改的文件

- `.gitignore`
- `AGENTS.md`
- `README.md`
- `baw-oneclick/README.md`
- `baw-oneclick/auto-budget.mjs`
- `baw-oneclick/gang-buy.mjs`
- `baw-oneclick/index.html`
- `baw-oneclick/preset-autobuy.mjs`
- `baw-oneclick/request-policy.mjs`
- `baw-oneclick/serve.mjs`
- `baw-oneclick/wallet-runtime.mjs`
- `docs/security-hardening.md`
- `packaging/build-windows.py`
- `packaging/build.py`
- `tests/http.test.mjs`
- `tests/network-guard.mjs`
- `tests/original-integrity.test.mjs`
- `tests/run-safe.mjs`
- `tests/security-browser.mjs`
- `tests/security-http.test.mjs`
- `tests/security-runtime.test.mjs`
- `tests/security-ui.test.mjs`

## 修复候选包审查（2026-10-28）

- 审查范围：相对 `31e4ff3` 的工作区变更、新增策略/预算模块、回归测试与打包流程。
- 六项修复的调用点与测试对应关系已检查；本次审查范围内未发现阻止隔离候选包构建的问题，不代表完整安全认证。
- 修正打包问题：使用独立 `1.0.1-security-rc1` 名称、Mac 版本元数据和源码提交指针；Mac 安装器要求两个新模块存在；替换验收脚本的开发者硬编码 Node 路径；包内明确标注旧文档/CI 为历史证据。
- 提交前重新运行 `node tests/run-safe.mjs`：46/46 通过；`node --import ./tests/network-guard.mjs tests/security-browser.mjs`：Chrome CSP 初始化与恶意符号文本渲染通过；`git diff --check` 与 Python 打包脚本 AST 检查通过。
- Mac 安装器、打包后虚拟钱包测试和 ZIP 清单校验在构建后单独记录。Windows runner、Node 24、Intel 与真实扩展加载未由这些检查覆盖。
- 原始 ZIP 保持不变；新包输出到 Downloads，不自动安装、不推送。

构建后验收与剩余平台门禁见 [修复候选包验收记录](release-acceptance.md)。

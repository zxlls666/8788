import { AsyncLocalStorage } from 'node:async_hooks';

const execution = new AsyncLocalStorage();
export function executionScope(headers, fn) {
  // Missing or malformed execution intent always means preview, including legacy clients.
  return execution.run({ previewOnly: headers['x-baw-preview-only'] !== '0' }, fn);
}
export function assertLiveExecution() {
  if (execution.getStore()?.previewOnly !== false) {
    throw Object.assign(new Error('预演禁止签名或提交交易；真实执行需要明确的执行模式'), { statusCode: 403 });
  }
}
export function assertCliExecution(args) {
  if ((args[0] === 'contract-call' && args[1] === 'execute') ||
      (args[0] === 'market-order' && args[1] === 'swap')) assertLiveExecution();
}
export function validateLocalRequest(req, port, extensionOrigin) {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (!hosts.has(req.headers.host)) throw new Error('不允许此 Host');
  const origin = req.headers.origin;
  if (origin !== undefined && !new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, extensionOrigin]).has(origin)) {
    throw new Error('不允许此 Origin');
  }
  // Navigations are additionally restricted by frame-ancestors. Cross-site API requests need an allowed Origin.
  if (req.headers['sec-fetch-site'] === 'cross-site' && !origin && req.url.startsWith('/api/')) {
    throw new Error('不允许跨站 API 请求');
  }
}
export function pagePolicy(extensionOrigin, scriptHash) {
  return `script-src 'self' 'sha256-${scriptHash}'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' ${extensionOrigin}`;
}

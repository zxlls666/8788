import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

// Reserve before execute. Failed/uncertain submissions remain charged until operator reconciliation.
export class AutoBuyBudget {
  constructor(directory, maximum = 10) {
    this.directory = directory; this.file = join(directory, 'autobuy-budget.json');
    this.maximum = maximum;
  }
  read() {
    if (!existsSync(this.file)) return { version: 1, records: {} };
    const value = JSON.parse(readFileSync(this.file, 'utf8'));
    if (value.version !== 1 || !value.records || typeof value.records !== 'object' || Array.isArray(value.records)) throw new Error('自动买入预算账本损坏，禁止继续执行');
    return value;
  }
  key(wallet, day) {
    if (!/^0x[0-9a-f]{40}$/i.test(wallet) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('预算钱包或日期无效');
    return `56:${wallet.toLowerCase()}:${day}`;
  }
  record(data, key) {
    if (!Object.hasOwn(data.records, key)) return { count: 0, tokens: [] };
    const row = data.records[key];
    if (!row || !Number.isInteger(row.count) || row.count < 0 || row.count > this.maximum ||
        !Array.isArray(row.tokens) || row.tokens.length !== row.count || new Set(row.tokens).size !== row.tokens.length ||
        row.tokens.some(t => !/^0x[0-9a-f]{40}$/.test(t))) throw new Error('自动买入预算记录无效，禁止继续执行');
    return row;
  }
  snapshot(wallet, day) { return structuredClone(this.record(this.read(), this.key(wallet, day))); }
  reserve(wallet, day, token) {
    const key = this.key(wallet, day), address = String(token).toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error('预算代币无效');
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const lock = this.file + '.lock';
    // A crashed writer leaves a lock: fail closed rather than silently reset a budget.
    const fd = openSync(lock, 'wx', 0o600);
    try {
      const data = this.read(), row = this.record(data, key);
      if (row.count >= this.maximum) throw new Error(`今日已达 ${this.maximum} 笔上限`);
      if (row.tokens.includes(address)) throw new Error('该代币今日已预留执行，不重复买入');
      const next = { count: row.count + 1, tokens: [...row.tokens, address] };
      data.records[key] = next;
      const temp = this.file + '.' + randomBytes(8).toString('hex') + '.tmp';
      writeFileSync(temp, JSON.stringify(data) + '\n', { mode: 0o600, flag: 'wx' });
      renameSync(temp, this.file);
      return structuredClone(next);
    } finally { closeSync(fd); unlinkSync(lock); }
  }
}

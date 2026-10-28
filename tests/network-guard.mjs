// For automated fake-wallet tests only. Never use this as a production network configuration.
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('TEST_EXTERNAL_NETWORK_BLOCKED');
  return fetchOriginal(input, init);
};
globalThis.WebSocket = class { constructor() { throw new Error('TEST_EXTERNAL_WEBSOCKET_BLOCKED'); } };

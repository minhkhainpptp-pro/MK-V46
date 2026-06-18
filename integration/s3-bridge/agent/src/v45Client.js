'use strict';

const { createNonce, createSignature } = require('./signature');

class V45HttpError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'V45HttpError';
    this.status = status;
    this.response = response;
    this.code = response?.code || 'V45_HTTP_ERROR';
    this.retryable = status >= 500 || status === 408 || status === 429;
  }
}

class V45Client {
  constructor(config, options = {}) {
    this.config = config;
    this.fetch = options.fetch || globalThis.fetch;
    if (typeof this.fetch !== 'function') throw new Error('Runtime không hỗ trợ fetch');
  }

  async request(method, path, payload = {}) {
    const hasBody = !['GET', 'HEAD'].includes(String(method).toUpperCase());
    const bodyString = hasBody ? JSON.stringify(payload ?? {}) : '';
    const bodyBuffer = Buffer.from(bodyString, 'utf8');
    const timestamp = String(Date.now());
    const nonce = createNonce();
    const signature = createSignature({
      method,
      path,
      timestamp,
      nonce,
      bodyBuffer,
      secret: this.config.integrationSecret
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const options = {
        method,
        headers: {
          'content-type': 'application/json',
          'x-integration-key': this.config.integrationKey,
          'x-agent-id': this.config.agentId,
          'x-timestamp': timestamp,
          'x-nonce': nonce,
          'x-signature': signature
        },
        signal: controller.signal
      };
      if (hasBody) options.body = bodyString;
      const response = await this.fetch(`${this.config.v45BaseUrl}${path}`, options);
      const responseText = await response.text();
      let data = {};
      try { data = responseText ? JSON.parse(responseText) : {}; } catch { data = { message: responseText }; }
      if (!response.ok || data.success === false) {
        throw new V45HttpError(data.message || `V45 HTTP ${response.status}`, response.status, data);
      }
      return data.result ?? data;
    } finally {
      clearTimeout(timeout);
    }
  }

  health() {
    return this.request('GET', '/api/integrations/s3/health', {});
  }

  upsertMasterOrder(payload) {
    return this.request('POST', '/api/integrations/s3/master-orders/upsert', payload);
  }

  claimReturnCommands(limit, leaseSeconds) {
    return this.request('POST', '/api/integrations/s3/return-commands/claim', { limit, leaseSeconds });
  }

  completeReturnCommand(eventId, result) {
    return this.request('POST', `/api/integrations/s3/return-commands/${encodeURIComponent(eventId)}/complete`, result);
  }

  deferReturnCommand(eventId, result) {
    return this.request('POST', `/api/integrations/s3/return-commands/${encodeURIComponent(eventId)}/defer`, result);
  }

  failReturnCommand(eventId, error) {
    return this.request('POST', `/api/integrations/s3/return-commands/${encodeURIComponent(eventId)}/fail`, error);
  }

  renewReturnCommand(eventId, leaseSeconds) {
    return this.request('POST', `/api/integrations/s3/return-commands/${encodeURIComponent(eventId)}/renew`, { leaseSeconds });
  }
}

module.exports = { V45Client, V45HttpError };

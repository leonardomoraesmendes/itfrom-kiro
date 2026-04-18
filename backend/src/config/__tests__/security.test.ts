import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getTLSOptions,
  getEncryptionConfig,
  encryptField,
  decryptField,
  securityHeaders,
} from '../security';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// 1. getTLSOptions
// ---------------------------------------------------------------------------
describe('getTLSOptions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null in non-production environment', () => {
    process.env.NODE_ENV = 'development';
    expect(getTLSOptions()).toBeNull();
  });

  it('returns null when NODE_ENV is not set', () => {
    delete process.env.NODE_ENV;
    expect(getTLSOptions()).toBeNull();
  });

  it('returns TLS options with minVersion TLSv1.2 in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.TLS_CERT = '---CERT---';
    process.env.TLS_KEY = '---KEY---';

    const opts = getTLSOptions();
    expect(opts).not.toBeNull();
    expect(opts!.minVersion).toBe('TLSv1.2');
    expect(opts!.cert).toBe('---CERT---');
    expect(opts!.key).toBe('---KEY---');
  });

  it('throws when production but no cert/key provided', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TLS_CERT;
    delete process.env.TLS_KEY;
    delete process.env.TLS_CERT_PATH;
    delete process.env.TLS_KEY_PATH;

    expect(() => getTLSOptions()).toThrow('TLS_CERT/TLS_KEY');
  });
});

// ---------------------------------------------------------------------------
// 2. getEncryptionConfig
// ---------------------------------------------------------------------------
describe('getEncryptionConfig', () => {
  it('returns AES-256-GCM configuration', () => {
    const config = getEncryptionConfig();
    expect(config.algorithm).toBe('aes-256-gcm');
    expect(config.keyLength).toBe(32);
    expect(config.ivLength).toBe(16);
    expect(config.keyEnvVar).toBe('DB_ENCRYPTION_KEY');
  });
});

// ---------------------------------------------------------------------------
// 3. encryptField / decryptField
// ---------------------------------------------------------------------------
describe('AES-256 field encryption', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DB_ENCRYPTION_KEY = 'test-master-key-for-unit-tests-only';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('encrypts and decrypts a string round-trip', () => {
    const plaintext = '12345678000199'; // sample CNPJ
    const encrypted = encryptField(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptField(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV/salt)', () => {
    const plaintext = 'sensitive-data';
    const a = encryptField(plaintext);
    const b = encryptField(plaintext);
    expect(a).not.toBe(b);
    // both decrypt to the same value
    expect(decryptField(a)).toBe(plaintext);
    expect(decryptField(b)).toBe(plaintext);
  });

  it('handles empty string', () => {
    const encrypted = encryptField('');
    expect(decryptField(encrypted)).toBe('');
  });

  it('handles unicode content', () => {
    const plaintext = 'Nota Fiscal — R$ 1.234,56 — São Paulo';
    const encrypted = encryptField(plaintext);
    expect(decryptField(encrypted)).toBe(plaintext);
  });

  it('throws when DB_ENCRYPTION_KEY is not set', () => {
    delete process.env.DB_ENCRYPTION_KEY;
    expect(() => encryptField('test')).toThrow('DB_ENCRYPTION_KEY');
  });

  it('fails to decrypt with wrong key', () => {
    const encrypted = encryptField('secret');
    process.env.DB_ENCRYPTION_KEY = 'different-key-entirely';
    expect(() => decryptField(encrypted)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 4. Security Headers Plugin
// ---------------------------------------------------------------------------
describe('securityHeaders plugin', () => {
  it('adds security headers to responses', async () => {
    const app = Fastify();
    await app.register(securityHeaders);
    app.get('/test', async () => ({ ok: true }));
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/test' });

    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['permissions-policy']).toContain('camera=()');
  });
});

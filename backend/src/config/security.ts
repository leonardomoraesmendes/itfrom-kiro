import { readFileSync } from 'fs';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

// ---------------------------------------------------------------------------
// 1. TLS Configuration (Req 9.4)
// ---------------------------------------------------------------------------

export interface TLSOptions {
  cert: string | Buffer;
  key: string | Buffer;
  minVersion: 'TLSv1.2';
}

/**
 * Returns TLS options for Fastify's HTTPS server.
 *
 * In development (NODE_ENV !== 'production') returns `null` — TLS is
 * typically terminated by a reverse proxy (ALB, nginx, etc.) in production.
 *
 * Reads cert/key from env vars TLS_CERT / TLS_KEY (PEM strings) or from
 * file paths TLS_CERT_PATH / TLS_KEY_PATH.
 */
export function getTLSOptions(): TLSOptions | null {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  const cert = process.env.TLS_CERT ?? readOptionalFile(process.env.TLS_CERT_PATH);
  const key = process.env.TLS_KEY ?? readOptionalFile(process.env.TLS_KEY_PATH);

  if (!cert || !key) {
    throw new Error(
      'TLS_CERT/TLS_KEY or TLS_CERT_PATH/TLS_KEY_PATH must be set in production',
    );
  }

  return { cert, key, minVersion: 'TLSv1.2' };
}

function readOptionalFile(path: string | undefined): string | undefined {
  if (!path) return undefined;
  return readFileSync(path, 'utf-8');
}

// ---------------------------------------------------------------------------
// 2. Database Encryption Helpers — AES-256-GCM (Req 9.5)
// ---------------------------------------------------------------------------
//
// PostgreSQL at-rest encryption is best handled at the infrastructure level
// (e.g. AWS RDS encryption, PostgreSQL TDE, or pgcrypto extension).
//
// The helpers below provide *application-level* field encryption for
// particularly sensitive columns (e.g. CNPJ, bank details) using
// AES-256-GCM via Node.js crypto. They are complementary to — not a
// replacement for — disk-level encryption.
// ---------------------------------------------------------------------------

const AES_ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits

export interface EncryptionConfig {
  algorithm: typeof AES_ALGORITHM;
  keyLength: number;
  ivLength: number;
  /** Env var that holds the master encryption key (hex-encoded). */
  keyEnvVar: string;
}

export function getEncryptionConfig(): EncryptionConfig {
  return {
    algorithm: AES_ALGORITHM,
    keyLength: KEY_LENGTH,
    ivLength: IV_LENGTH,
    keyEnvVar: 'DB_ENCRYPTION_KEY',
  };
}

/**
 * Derive a 256-bit key from the master secret + a random salt using scrypt.
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

function getMasterKey(): string {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('DB_ENCRYPTION_KEY environment variable is not set');
  }
  return key;
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a base64 string: salt(32) + iv(16) + authTag(16) + ciphertext.
 */
export function encryptField(plaintext: string): string {
  const secret = getMasterKey();
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // salt | iv | authTag | ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a value previously encrypted with `encryptField`.
 */
export function decryptField(encoded: string): string {
  const secret = getMasterKey();
  const data = Buffer.from(encoded, 'base64');

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(secret, salt);
  const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}

// ---------------------------------------------------------------------------
// 3. Security Headers Middleware (Fastify Plugin)
// ---------------------------------------------------------------------------

const securityHeadersPlugin: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '0'); // modern browsers use CSP instead
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'",
    );
    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
  });
  done();
};

export const securityHeaders = fp(securityHeadersPlugin, {
  name: 'security-headers',
  fastify: '4.x',
});

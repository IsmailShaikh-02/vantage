import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes standard for GCM

function getMasterKey() {
  const key = process.env.VAULT_MASTER_KEY;
  if (!key || key.length !== 64) {
    throw new Error('VAULT_MASTER_KEY must be a 64-character hex string (32 bytes).');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypts a plaintext secret string using AES-256-GCM
 * @param {string} plaintext 
 * @returns {{ ciphertext: string, iv: string, authTag: string }}
 */
export function encryptCredential(plaintext) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypts ciphertext back to plaintext using the IV and authentication tag
 * @param {string} ciphertext 
 * @param {string} ivHex 
 * @param {string} authTagHex 
 * @returns {string} plaintext
 */
export function decryptCredential(ciphertext, ivHex, authTagHex) {
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
import { query } from '../config/db.js';
import { encryptCredential, decryptCredential } from './vault.service.js';

/**
 * Persists or updates an encrypted credential for a SaaS provider.
 * 
 * @param {string} provider - Unique provider identifier (e.g., 'slack', 'github')
 * @param {string} plaintextSecret - The raw token to encrypt and store at rest
 * @returns {Promise<object>} The stored row metadata (id, provider, updated_at)
 */
export async function saveProviderCredential(provider, plaintextSecret) {
  // 1. Encrypt the incoming plaintextSecret using encryptCredential
  const {ciphertext, iv, authTag} = encryptCredential(plaintextSecret)
  // Expected output: { ciphertext, iv, authTag }

  // 2. Define the parameterized UPSERT query for credentials_vault
  const sql = `
    INSERT INTO credentials_vault(provider, encrypted_secret, iv, auth_tag, updated_at)
    VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)
    ON CONFLICT(provider)
    DO UPDATE SET
      encrypted_secret = EXCLUDED.encrypted_secret,
      iv = EXCLUDED.iv,
      auth_tag = EXCLUDED.auth_tag,
      updated_at = CURRENT_TIMESTAMP
    RETURNING id, provider;
    `;

  // 3. Execute the query with pool parameters ($1, $2, $3, $4)
  const result = await query(sql, [provider, ciphertext, iv, authTag])
  // 4. Return the resulting row
  return result.rows[0];
}

/**
 * Retrieves and decrypts a SaaS provider secret from the vault in memory.
 * 
 * @param {string} provider - Unique provider identifier (e.g., 'slack', 'github')
 * @returns {Promise<string>} The plaintext secret for outbound HTTP construction
 */
export async function getDecryptedCredential(provider) {
  // 1. Query encrypted_secret, iv, and auth_tag for the given provider
  const sql = `
    SELECT encrypted_secret, iv, auth_tag 
    FROM credentials_vault WHERE provider = $1;
  `;

  // 2. Execute query and guard against non-existent provider records
  const result = await query(sql, [provider]);

  if(result.rows.length === 0){
    throw new Error("Error: provider not found")
  }
  const {encrypted_secret, iv, auth_tag} = result.rows[0];
  // 4. Execute decryptCredential inside a try/catch boundary
  try {
    const decrypted = decryptCredential(encrypted_secret, iv, auth_tag)
    return decrypted;
  } catch (error) {
    throw new Error(`Vault decryption failed for provider '${provider}': Integrity check failed`);
  }
}
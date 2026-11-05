/**
 * AES-256-GCM encryption utilities
 * Used to encrypt sensitive data such as corporate card credentials
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a string with AES-256-GCM
 * @param text plaintext to encrypt
 * @returns IV + AuthTag + EncryptedData (hex-encoded)
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  // Return as IV + AuthTag + EncryptedData
  return iv.toString("hex") + authTag.toString("hex") + encrypted;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 * @param encryptedText encrypted string (IV + AuthTag + EncryptedData)
 * @returns decrypted plaintext
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();

  // Split IV, AuthTag and EncryptedData
  const iv = Buffer.from(encryptedText.slice(0, IV_LENGTH * 2), "hex");
  const authTag = Buffer.from(
    encryptedText.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2),
    "hex"
  );
  const encrypted = encryptedText.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt a JSON object
 * @param data object to encrypt
 * @returns encrypted string
 */
export function encryptJson<T>(data: T): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt an encrypted string into a JSON object
 * @param encryptedText encrypted string
 * @returns decrypted object
 */
export function decryptJson<T>(encryptedText: string): T {
  return JSON.parse(decrypt(encryptedText)) as T;
}

/**
 * Read the encryption key from the environment
 * @returns 32-byte key buffer
 * @throws when ENCRYPTION_KEY is missing or not 32 characters
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 characters, got ${key.length}`
    );
  }
  return Buffer.from(key);
}

/**
 * Mask a card number (show only the first 4 and last 4 digits)
 * @param cardNo card number
 * @returns masked card number (e.g. 1234****5678)
 */
export function maskCardNumber(cardNo: string): string {
  const cleaned = cardNo.replace(/\D/g, "");
  if (cleaned.length < 8) {
    return "*".repeat(cleaned.length);
  }
  const first4 = cleaned.slice(0, 4);
  const last4 = cleaned.slice(-4);
  const masked = "*".repeat(cleaned.length - 8);
  return `${first4}${masked}${last4}`;
}

/**
 * Extract the last 4 digits of a card number
 * @param cardNo card number
 * @returns last 4 digits
 */
export function getCardLast4(cardNo: string): string {
  const cleaned = cardNo.replace(/\D/g, "");
  return cleaned.slice(-4);
}

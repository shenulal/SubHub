// src/lib/services/storage/s3.ts
/**
 * S3-compatible provider (Amazon S3, Cloudflare R2, MinIO…).
 * The AWS SDK is imported lazily so the local provider never loads it.
 *
 * Env: S3_BUCKET, S3_REGION, S3_ENDPOINT (R2: https://<account>.r2.cloudflarestorage.com),
 *      S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE ("true"|"false").
 * Legacy R2_* variables are honoured when the provider is `r2`.
 */
import {
  sanitizeKey,
  type StorageProvider,
  type StorageProviderId,
} from "./types";

const DEFAULT_REGION = "auto";
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function readS3Config(providerId: StorageProviderId): S3Config {
  const isR2 = providerId === "r2";
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket =
    process.env.S3_BUCKET || (isR2 ? process.env.R2_BUCKET_NAME : "");
  const accessKeyId =
    process.env.S3_ACCESS_KEY_ID || (isR2 ? process.env.R2_ACCESS_KEY_ID : "");
  const secretAccessKey =
    process.env.S3_SECRET_ACCESS_KEY ||
    (isR2 ? process.env.R2_SECRET_ACCESS_KEY : "");
  const endpoint =
    process.env.S3_ENDPOINT ||
    (isR2 && accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : undefined);
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      `Storage provider "${providerId}" is missing S3_* credentials`
    );
  }
  return {
    bucket,
    region: process.env.S3_REGION || DEFAULT_REGION,
    endpoint,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

async function loadSdk() {
  const [client, presigner] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner"),
  ]);
  return { ...client, getSignedUrl: presigner.getSignedUrl };
}

export function createS3Provider(
  providerId: StorageProviderId,
  config: S3Config = readS3Config(providerId)
): StorageProvider {
  let clientPromise: ReturnType<typeof buildClient> | null = null;
  async function buildClient() {
    const sdk = await loadSdk();
    const client = new sdk.S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    return { sdk, client };
  }
  const getClient = () => (clientPromise ??= buildClient());

  return {
    id: providerId,
    async putObject(key, body, contentType) {
      const Key = sanitizeKey(key);
      const { sdk, client } = await getClient();
      await client.send(
        new sdk.PutObjectCommand({
          Bucket: config.bucket,
          Key,
          Body: body,
          ContentType: contentType || DEFAULT_CONTENT_TYPE,
        })
      );
      return { key: Key, sizeBytes: body.byteLength };
    },
    async getSignedUrl(key, ttlSeconds) {
      const Key = sanitizeKey(key);
      const { sdk, client } = await getClient();
      return sdk.getSignedUrl(
        client,
        new sdk.GetObjectCommand({ Bucket: config.bucket, Key }),
        { expiresIn: Math.max(1, ttlSeconds) }
      );
    },
    async deleteObject(key) {
      const Key = sanitizeKey(key);
      const { sdk, client } = await getClient();
      await client.send(
        new sdk.DeleteObjectCommand({ Bucket: config.bucket, Key })
      );
    },
    async getObject(key) {
      const Key = sanitizeKey(key);
      const { sdk, client } = await getClient();
      try {
        const out = await client.send(
          new sdk.GetObjectCommand({ Bucket: config.bucket, Key })
        );
        const bytes = await out.Body?.transformToByteArray();
        if (!bytes) return null;
        return {
          body: Buffer.from(bytes),
          contentType: out.ContentType ?? DEFAULT_CONTENT_TYPE,
        };
      } catch (error) {
        if ((error as { name?: string }).name === "NoSuchKey") return null;
        throw error;
      }
    },
  };
}

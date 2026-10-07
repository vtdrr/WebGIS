import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  DB_SSL: z.string().transform(v => v === 'true').default('false'),
  // When DB_SSL=true the server certificate is verified by default.
  // Provide the CA via DB_SSL_CA (PEM contents or a file path); only set
  // DB_SSL_REJECT_UNAUTHORIZED=false as a last resort (insecure).
  DB_SSL_REJECT_UNAUTHORIZED: z.string().transform(v => v !== 'false').default('true'),
  DB_SSL_CA: z.string().min(1).optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),

  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),

  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  SWAGGER_ENABLED: z.string().transform(v => v === 'true').default('true'),

  // Optional: when set, POST/PATCH/DELETE /api/* require this key
  // (header: x-admin-key or Authorization: Bearer <key>)
  // Mandatory in production (see check below).
  ADMIN_API_KEY: z.string().min(1).optional(),

  // Image uploads (admin)
  UPLOAD_DIR: z.string().default('uploads'),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(5),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.flatten().fieldErrors);
  console.error('👉 Tạo file backend/.env từ mẫu: cp .env.example .env');
  process.exit(1);
}

if (_env.data.NODE_ENV === 'production' && !_env.data.ADMIN_API_KEY) {
  console.error('❌ ADMIN_API_KEY is required when NODE_ENV=production (write endpoints would be open to everyone).');
  process.exit(1);
}

export const config = _env.data;

export const isDev = config.NODE_ENV === 'development';
export const isProd = config.NODE_ENV === 'production';
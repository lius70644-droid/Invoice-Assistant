import dotenv from 'dotenv';
dotenv.config();

// 验证必需的環境變量
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET 環境變量未配置，請在 .env 文件中設置');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL 和 SUPABASE_ANON_KEY 環境變量未配置');
}

export const config = {
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  },
  aliyun: {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  jwt: {
    secret: jwtSecret,
    userExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
    adminExpiry: 24 * 60 * 60 * 1000, // 24 hours
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
  school: {
    name: '江南大学',
    taxId: '1210000071780177X1',
  },
};

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
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
    secret: process.env.JWT_SECRET || 'default_secret_change_me',
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

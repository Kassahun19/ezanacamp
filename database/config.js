export const dbConfig = {
  client: 'mysql',
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'ezana_academy_2027',
    user: process.env.DB_USER || 'ezana_academy_2027',
    password: process.env.DB_PASSWORD || 'ezana_academy_2027',
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 5000,
    charset: 'utf8mb4',
  },
};

export const securityConfig = {
  jwtSecret: process.env.JWT_SECRET || 'ezana-academy-2027-jwt-signing-secret-dev',
  encryptionSecret: process.env.ENCRYPTION_SECRET || 'ezana-academy-2027-aes256-key-32',
  jwtExpiresIn: '7d',
};

export const academyDefaults = {
  proPriceEtb: 218,
  freeLessonLimit: 5,
};

import { mysqlSchemaStatements } from './schema.js';

export const mysqlSetupScript = [
  `-- Ezana Academy MySQL 8.0+ Schema`,
  `-- Shared Credentials: Database=ezana_academy_2027 | User=ezana_academy_2027 | Password=ezana_academy_2027 | Host=localhost`,
  `CREATE DATABASE IF NOT EXISTS ezana_academy_2027 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `CREATE USER IF NOT EXISTS 'ezana_academy_2027'@'localhost' IDENTIFIED BY 'ezana_academy_2027';`,
  `GRANT ALL PRIVILEGES ON ezana_academy_2027.* TO 'ezana_academy_2027'@'localhost';`,
  `FLUSH PRIVILEGES;`,
  `USE ezana_academy_2027;`,
  '',
  ...mysqlSchemaStatements.map((s) => `${s};`),
].join('\n\n');

export async function getSchemaSummary() {
  return {
    database: 'ezana_academy_2027',
    user: 'ezana_academy_2027',
    host: 'localhost',
    port: 3306,
    driver: 'mysql2',
    tables: mysqlSchemaStatements.length,
  };
}

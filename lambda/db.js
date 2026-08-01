import pg from "pg";
const { Client } = pg;

let connection;

export async function getDb() {
  if (!connection) {
    connection = new Client({
      host: process.env.RDS_HOST,
      user: process.env.RDS_USER,
      password: process.env.RDS_PASSWORD,
      database: process.env.RDS_DATABASE,
      ssl: { rejectUnauthorized: false },
    });
    await connection.connect();
  }
  return connection;
}

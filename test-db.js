require("dotenv").config();

const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    await client.connect();

    console.log("Database connected successfully!");

    const result = await client.query(`
  SELECT
    state,
    COUNT(*) AS connections
  FROM pg_stat_activity
  GROUP BY state
  ORDER BY connections DESC;
`);



console.table(result.rows);

    console.log("Active connections:", result.rows[0]);

  } catch (error) {
    console.error("Connection failed:", error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

testConnection();
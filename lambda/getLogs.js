import { getDb } from "./db.js";

const CORS = { "Access-Control-Allow-Origin": "*" };

export const handler = async () => {
  const db = await getDb();
  const { rows } = await db.query(
    "SELECT session_id, license_plate, s3_image_url, entry_timestamp, exit_timestamp, calculated_fee, session_status FROM parking_sessions ORDER BY entry_timestamp DESC"
  );

  const sessions = rows.map((r) => ({
    id: r.session_id,
    plateNumber: r.license_plate,
    image: r.s3_image_url,
    entryTime: r.entry_timestamp,
    exitTime: r.exit_timestamp ?? undefined,
    amount: r.calculated_fee ? Number(r.calculated_fee) : undefined,
    status: r.session_status,
  }));

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify(sessions),
  };
};

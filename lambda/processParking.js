import { RekognitionClient, DetectTextCommand } from "@aws-sdk/client-rekognition";
import { getDb } from "./db.js";

const rekognition = new RekognitionClient({ region: "eu-west-1" });

const RATE_PER_HOUR = 10;
const SA_PLATE = /^[A-Z]{2,3}\s?\d{2,3}\s?[A-Z]{2}$/i;

export const handler = async (event) => {
  const record = event.Records[0].s3;
  const bucket = record.bucket.name;
  const imageKey = decodeURIComponent(record.object.key.replace(/\+/g, " "));
  // Derive mode from path: uploads/entry/... or uploads/exit/...
  const mode = imageKey.split("/")[1];

  const { TextDetections } = await rekognition.send(new DetectTextCommand({
    Image: { S3Object: { Bucket: bucket, Name: imageKey } }
  }));
  const plateNumber = TextDetections.find(t => t.Type === "LINE" && SA_PLATE.test(t.DetectedText))?.DetectedText;
  if (!plateNumber) return;

  const imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageKey}`;
  const db = await getDb();

  if (mode === "entry") {
    const { rows: [session] } = await db.query(
      "INSERT INTO parking_sessions (license_plate, s3_image_url) VALUES ($1, $2) RETURNING *",
      [plateNumber, imageUrl]
    );
    return;
  }

  if (mode === "exit") {
    const { rows: [active] } = await db.query(
      "SELECT * FROM parking_sessions WHERE license_plate = $1 AND session_status = 'ACTIVE' LIMIT 1",
      [plateNumber]
    );
    if (!active) return;
    const exitTime = new Date();
    const ms = exitTime - new Date(active.entry_timestamp);
    const fee = Math.ceil(ms / 3600000) * RATE_PER_HOUR;
    const { rows: [updated] } = await db.query(
      "UPDATE parking_sessions SET exit_timestamp = $1, calculated_fee = $2, session_status = 'COMPLETED' WHERE session_id = $3 RETURNING *",
      [exitTime, fee, active.session_id]
    );
    return;
  }
};

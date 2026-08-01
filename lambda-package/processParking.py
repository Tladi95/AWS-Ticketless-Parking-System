import boto3
import urllib.parse
import re
import pg8000
import os

s3 = boto3.client('s3')
rekognition = boto3.client('rekognition', region_name='eu-west-1')

SA_PLATE = re.compile(r'^[A-Z]{2,3}\s?\d{2,3}\s?[A-Z]{2}$', re.IGNORECASE)

def get_db():
    return pg8000.connect(
        host=os.environ['RDS_HOST'],
        user=os.environ['RDS_USER'],
        password=os.environ['RDS_PASSWORD'],
        database=os.environ['RDS_DATABASE'],
        ssl_context=True
    )

def lambda_handler(event, context):
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'])
    mode = key.split('/')[1]  # uploads/entry/... or uploads/exit/...

    image_bytes = s3.get_object(Bucket=bucket, Key=key)['Body'].read()
    response = rekognition.detect_text(Image={'Bytes': image_bytes})

    plate = next(
        (t['DetectedText'] for t in response['TextDetections']
         if t['Type'] == 'LINE' and SA_PLATE.match(t['DetectedText'])),
        None
    )

    if not plate:
        print("No valid SA plate detected")
        return

    print(f"Detected plate: {plate}, mode: {mode}")

    image_url = f"https://{bucket}.s3.af-south-1.amazonaws.com/{key}"
    conn = get_db()
    cur = conn.cursor()

    if mode == 'entry':
        cur.execute(
            "INSERT INTO parking_sessions (license_plate, s3_image_url) VALUES (%s, %s)",
            (plate, image_url)
        )

    elif mode == 'exit':
        cur.execute(
            "SELECT session_id, entry_timestamp FROM parking_sessions WHERE license_plate = %s AND session_status = 'ACTIVE' LIMIT 1",
            (plate,)
        )
        row = cur.fetchone()
        if not row:
            print(f"No active session for: {plate}")
            conn.close()
            return
        session_id, entry_time = row
        from datetime import datetime, timezone
        exit_time = datetime.now(timezone.utc)
        ms = (exit_time - entry_time).total_seconds()
        fee = max(1, int(ms / 3600)) * 10
        cur.execute(
            "UPDATE parking_sessions SET exit_timestamp = %s, calculated_fee = %s, session_status = 'COMPLETED' WHERE session_id = %s",
            (exit_time, fee, session_id)
        )

    conn.commit()
    cur.close()
    conn.close()
    print("DB updated successfully")

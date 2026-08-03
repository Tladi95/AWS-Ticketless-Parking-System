import boto3
import urllib.parse
import re
import pg8000
import os

s3 = boto3.client('s3')
rekognition = boto3.client('rekognition', region_name='eu-west-1')

# --------------------------------------------------
# South African Province Codes
# --------------------------------------------------

PROVINCES = ("GP", "ZN", "EC", "MP", "L", "NC", "NW", "FS", "WP")
PROVINCE_REGEX = "(" + "|".join(PROVINCES) + ")"

# --------------------------------------------------
# South African Licence Plate Patterns
# --------------------------------------------------

SA_PLATE_PATTERNS = {
    "Gauteng / KwaZulu-Natal": rf"^[A-Z]{{2}}\d{{2}}[A-Z]{{2}}{PROVINCE_REGEX}$",
    "Standard Provincial":     rf"^[A-Z]{{3}}\d{{3}}{PROVINCE_REGEX}$",
    "Western Cape":            r"^C[A-Z]{1,2}\d{3,6}$",
    "Personalised":            rf"^[A-Z0-9]{{1,7}}{PROVINCE_REGEX}$",
}

# --------------------------------------------------
# Pattern Matching
# --------------------------------------------------

def match_plate(text):
    for pattern_name, pattern in SA_PLATE_PATTERNS.items():
        if re.match(pattern, text, re.IGNORECASE):
            return pattern_name
    return None

# --------------------------------------------------
# Detect Licence Plate
# --------------------------------------------------

def detect_license_plate(image_bytes):
    response = rekognition.detect_text(Image={'Bytes': image_bytes})

    detected_lines = []

    for detection in response["TextDetections"]:
        if detection["Type"] != "LINE":
            continue
        confidence = detection["Confidence"]
        if confidence < 80:
            continue
        text = detection["DetectedText"]
        cleaned = re.sub(r"[^A-Z0-9]", "", text.upper())
        if cleaned:
            detected_lines.append({"text": cleaned, "confidence": confidence})

    if not detected_lines:
        return None

    # 1. Single line
    for line in detected_lines:
        pattern = match_plate(line["text"])
        if pattern:
            return {"plate": line["text"], "confidence": round(line["confidence"], 2), "pattern": pattern}

    # 2. Two-line combined
    for i in range(len(detected_lines) - 1):
        combined = detected_lines[i]["text"] + detected_lines[i + 1]["text"]
        pattern = match_plate(combined)
        if pattern:
            confidence = min(detected_lines[i]["confidence"], detected_lines[i + 1]["confidence"])
            return {"plate": combined, "confidence": round(confidence, 2), "pattern": pattern}

    # 3. Three-line combined
    for i in range(len(detected_lines) - 2):
        combined = detected_lines[i]["text"] + detected_lines[i + 1]["text"] + detected_lines[i + 2]["text"]
        pattern = match_plate(combined)
        if pattern:
            confidence = min(detected_lines[i]["confidence"], detected_lines[i + 1]["confidence"], detected_lines[i + 2]["confidence"])
            return {"plate": combined, "confidence": round(confidence, 2), "pattern": pattern}

    # 4. Smart fallback
    detected_lines.sort(
        key=lambda item: (any(c.isdigit() for c in item["text"]), len(item["text"]), item["confidence"]),
        reverse=True
    )
    best = detected_lines[0]
    if len(best["text"]) >= 4:
        return {"plate": best["text"], "confidence": round(best["confidence"], 2), "pattern": "Fallback"}

    return None

# --------------------------------------------------
# DB
# --------------------------------------------------

def get_db():
    return pg8000.connect(
        host=os.environ['RDS_HOST'],
        user=os.environ['RDS_USER'],
        password=os.environ['RDS_PASSWORD'],
        database=os.environ['RDS_DATABASE'],
        ssl_context=True
    )

# --------------------------------------------------
# Handler
# --------------------------------------------------

def lambda_handler(event, context):
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'])
    mode = key.split('/')[1]  # uploads/entry/... or uploads/exit/...

    image_bytes = s3.get_object(Bucket=bucket, Key=key)['Body'].read()

    result = detect_license_plate(image_bytes)

    if not result:
        print("No valid SA plate detected")
        return

    plate = result["plate"]
    print(f"Detected plate: {plate} | pattern: {result['pattern']} | confidence: {result['confidence']}% | mode: {mode}")

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
        seconds = (exit_time - entry_time).total_seconds()
        fee = max(1, int(seconds / 3600)) * 10
        cur.execute(
            "UPDATE parking_sessions SET exit_timestamp = %s, calculated_fee = %s, session_status = 'COMPLETED' WHERE session_id = %s",
            (exit_time, fee, session_id)
        )

    conn.commit()
    cur.close()
    conn.close()
    print("DB updated successfully")

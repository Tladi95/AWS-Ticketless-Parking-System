import boto3
import json
import os

s3 = boto3.client('s3', region_name='af-south-1')
BUCKET = os.environ['BUCKET_NAME']

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
}

def lambda_handler(event, context):
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event['body'])
    folder = body['folder']
    file_name = body['fileName']
    content_type = body['contentType']

    key = f"uploads/{folder}/{int(__import__('time').time() * 1000)}-{file_name}"

    url = s3.generate_presigned_url(
        'put_object',
        Params={'Bucket': BUCKET, 'Key': key, 'ContentType': content_type},
        ExpiresIn=300
    )

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'url': url, 'key': key})
    }

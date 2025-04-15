import base64
import gzip
import json
import os
import boto3
import logging
import base64
import gzip

# ロギングの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    try:
        logger.info('Received event: %s', json.dumps(event))
        
        records = event["Records"][0]["kinesis"]
        partitionKey = records["partitionKey"]
        sequenceNumber = records["sequenceNumber"]
        # CloudWatch Logsからのデータはbase64圧縮形式で送られてくる
        cw_data = records.get('data')
        if not cw_data:
            logger.error('No CloudWatch Logs data found in event')
            return {
                'statusCode': 400,
                'body': json.dumps('No CloudWatch Logs data found in event')
            }
        # データをデコードおよび解凍
        compressed_payload = base64.b64decode(cw_data)
        uncompressed_payload = gzip.decompress(compressed_payload)
        payload = json.loads(uncompressed_payload)
        
        logger.info('Decoded payload: %s', json.dumps(payload))
        # ログイベントを処理
        log_group = payload.get('logGroup', 'Unknown LogGroup')
        log_stream = payload.get('logStream', 'Unknown LogStream')
        log_events = payload.get('logEvents', [])
        
        if not log_events:
            logger.info('No log events found in payload')
            return {
                'statusCode': 200,
                'body': json.dumps('No log events found in payload')
            }
        
        for event in log_events:
            message_id = event.get('id', 'Unknown ID')
            timestamp = event.get('timestamp', 0)
            message = event.get('message', '')
            # level: メッセージにERRORが含まれていればERROR, FATALが含まれていればFATAL、それ以外はINFO
            level = 'ERROR' if 'ERROR' in message else 'FATAL' if 'FATAL' in message else 'INFO'
            # severity: ERRORならば HIGH, FATAL ならば、CRITICAL、それ以外はMEDIUM
            severity = 'HIGH' if 'ERROR' in message else 'CRITICAL' if 'FATAL' in message else 'MEDIUM'

            # ERRORまたはFATALを含むメッセージだけを処理（フィルターで既に絞られているはずだが念のため）
            if 'ERROR' in message or 'FATAL' in message:
                logger.info('message: %s', message)

        return {
            'statusCode': 200,
            'body': json.dumps('Log events processed successfully')
        }

    except Exception as e:
        logger.exception(str(e))
        return {
            'statusCode': 500,
            'body': json.dumps(str(e))
        }
    finally:
        logger.info('complete')

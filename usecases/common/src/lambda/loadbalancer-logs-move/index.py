import os
import json
import urllib.parse
import boto3
import re
from logging import getLogger, INFO, DEBUG

logger = getLogger()
logger.setLevel(INFO)

s3 = boto3.client('s3')

filepattern = re.compile(r'[0-9]{12}_[a-z]*_.*_app\.([a-zA-Z0-9\-]+)\..*_([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})Z_.*\.log\.gz')
prefixpattern = re.compile(r'AWSLogs\/[0-9]{12}\/.*\/.*\/([0-9]{4})\/([0-9]{2})\/([0-9]{2})')

# AWSLogs/<アカウントID>/elasticloadbalancing/<リージョン>/<year>/<month>/<day>/<アカウント ID>_elasticloadbalancing_<リージョン>_app.<ロードバランサー名>.XXXX.YYYYMMDDTHHMI_<IP>_unique-ID.log.gz

def lambda_handler(event, context):

    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)
        # 
        destination_bucket_name = os.getenv('DESTINATION_BUCKET_NAME')
        destination_bucket_prefix = os.getenv('DESTINATION_BUCKET_PREFIX')
        if destination_bucket_name:
            # Get the object from the event and show its content type
            bucket = event['Records'][0]['s3']['bucket']['name']
            key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')
            keys = key.split('/')
            prefix = keys[0:len(keys)-1]
            filename = keys[-1]
            logger.debug('bucket: {}'.format(bucket))
            logger.debug('key: {}'.format(key))
            logger.debug('prefix: {}'.format('/'.join(prefix)))
            logger.debug('filename: {}'.format(filename))
            m = filepattern.match(filename)
            if m:
                logger.debug('match: {}'.format(m.groups()))
                [name, year, month, day, hour, minute] = m.groups()
                logger.debug('year: {}'.format(year))
                logger.debug('month: {}'.format(month))
                logger.debug('day: {}'.format(day))
                logger.debug('hour: {}'.format(hour))
                
                newkey = '{}/year={}/month={}/day={}/hour={}/{}'.format(name, year, month, day, hour, filename)
                logger.debug('newkey: {}'.format(newkey))
                dst = '{}/{}'.format(destination_bucket_prefix, newkey)
                logger.debug('dst: {}'.format(dst))
                s3.copy_object(Bucket=destination_bucket_name, Key=dst, CopySource={'Bucket': bucket, 'Key': key})
                s3.delete_object(Bucket=bucket, Key=key)
                
            else:
                logger.debug('no matched.')
        else:
            logger.info('DESTINATION_BUCKET_NAME is None.')

        return {
            'statusCode': 200,
            'body': json.dumps('complete!')
        }
    except Exception as e:
      logger.exception(str(e))
      return {
            'statusCode': 500,
            'body': json.dumps(str(e))
      }
    finally:
      logger.info('complete.')


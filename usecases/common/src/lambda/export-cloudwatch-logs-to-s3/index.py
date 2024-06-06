import json
import datetime
import time
import boto3
from logging import getLogger, INFO

logger = getLogger()
logger.setLevel(INFO)

#[
#  {"s3_bucket_name": "logs-xxxx", "log_group_name": "/aws/xxx"},
#]

client = boto3.client('logs')
s3client = boto3.client('s3')
def get_from_timestamp():
    today = datetime.date.today()
    yesterday = datetime.datetime.combine(today - datetime.timedelta(days = 1), datetime.time(0, 0, 0))
    timestamp = time.mktime(yesterday.timetuple())
    return int(timestamp)

def get_to_timestamp(from_ts):
    return from_ts + (60 * 60 * 24) - 1

def lambda_handler(event, context):
    try:
      logger.info('start')
      from_ts = get_from_timestamp()
      to_ts = get_to_timestamp(from_ts)
      logger.debug('Timestamp: from_ts %s, to_ts %s' % (from_ts, to_ts))

      for e in event:
        s3_bucket_name = e.get("s3_bucket_name")    #保存先S３バケット名
        log_group_name = e.get("log_group_name")    #保存先S３バケット名
        s3_prefix = 'CWLogsBackup' + log_group_name + '/%s' % (datetime.date.today() - datetime.timedelta(days = 1)).strftime("%Y/%m/%d")
        logger.debug('s3_bucket_name:%s' % s3_bucket_name)
        logger.debug('log_group_name:%s' % log_group_name)
        logger.debug('s3_prefix:%s' % s3_prefix)
        response = client.create_export_task(
            logGroupName      = log_group_name,     #取得するCloudWatchロググループ名
            fromTime          = from_ts * 1000,
            to                = to_ts * 1000,
            destination       = s3_bucket_name,     #保存先S３バケット名
            destinationPrefix = s3_prefix           #保存先S３バケット名配下の任意のサブフォルダ名（プリフィックス名）
        )
        logger.debug('response: %s' % response)
        
        # テストファイルは消す
        s3client.delete_object(Bucket=s3_bucket_name, Key=s3_prefix+'aws-logs-write-test')
        
      return {
          'statusCode': 200,
          'body': json.dumps('complete!')
      }
    except Exception as e:
      logger.exception(str(e))
      print(str(e))
      return {
            'statusCode': 500,
            'body': json.dumps('failed![%s]' % (str(e)))
      }
    finally:
      logger.info('complete.')

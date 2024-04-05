#
#
"""
for test
{
    "detail": {
        "requestParameters": {
            "logGroupName": "test"
        }
    }
}
"""
import boto3
import os
from logging import getLogger, INFO, DEBUG

logs = boto3.client('logs')
logger = getLogger()
logger.setLevel(INFO)

def lambda_handler(event, context):

  try:
    logger.info("start")
    logger.info("event: {}".format(event))
    loggroupname = event['detail']['requestParameters']['logGroupName']

    retention_in_days = int(os.environ.get('RETENTION_IN_DAYS', 30))
    logLevel = os.environ.get('LOG_LEVEL', 'INFO')
    logger.setLevel(logLevel)
    descrive_response = logs.describe_log_groups(
      logGroupNamePrefix = loggroupname,
    )
    logGroups = descrive_response['logGroups']
    logger.debug(logGroups)

    for logGroup in logGroups:
      logger.debug(logGroup)
      if logGroup['logGroupName'] == loggroupname:
        if 'retentionInDays' not in logGroup:
          logger.debug('RetentionInDays of "{}" does not set.'.format(loggroupname))
          update_response = logs.put_retention_policy(
            logGroupName = loggroupname,
            retentionInDays = retention_in_days
          )
          break
        else:
          logger.debug('RetentionInDays of "{}" already set. RetentionInDays is "{}".'.format(loggroupname, logGroup['retentionInDays']))

  except Exception as e:
    logger.exception(str(e))
    print(e)
  finally:
    logger.info('complete.')

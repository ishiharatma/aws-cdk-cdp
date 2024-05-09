import json
import os
import boto3
from datetime import datetime
from zoneinfo import ZoneInfo

from logging import getLogger, INFO, DEBUG

logger = getLogger()
logger.setLevel(INFO)

# Returns the current date and time
# return : iso formated date
#           e.g.) 2024-01-01T10:10:10.405890+09:00
def get_today() -> str:
    return datetime.now(ZoneInfo("Asia/Tokyo")).isoformat()

# return : True / False
def is_execute(action, ec2_status) -> bool:
    # see: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ec2/client/describe_instances.html
    # 'pending'|'running'|'shutting-down'|'terminated'|'stopping'|'stopped'

    if action == "Start" and ec2_status == "stopped":
        return True
    
    if action == "Stop" and ec2_status == "running":
        return True
    
    return False

def lambda_handler(event, context):
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)
        region = os.environ.get('REGION', os.getenv("AWS_DEFAULT_REGION"))
        target_date = os.environ.get('TARGET_DATE', get_today())
        logger.debug('target_date: {}'.format(target_date))
        
        # get Event Parameters
        action = event.get('Action','N/A')
        instance_id = event.get('InstanceId','')
        ssm_calendar_arn = event.get('SSMCalendarArn', '')

        if not instance_id:
            raise Exception('{} is unspecified'.format(instance_id))

        logger.info('Action:{action}, EC2:{instance_id}'.format(action=action, instance_id=instance_id))
        
        ec2 = boto3.client('ec2', region_name=region)

        if not ssm_calendar_arn:
            #raise Exception('{} is unspecified'.format('SSMCalendarArn'))
            logger.debug('Run with OEPN because no SSMCalendarArn is specified'.format())
            calendar_state = 'OPEN'
        else:
            ssm = boto3.client('ssm')
            # see: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ssm/client/get_calendar_state.html
            calendar_response = ssm.get_calendar_state(
                CalendarNames=[
                    ssm_calendar_arn,
                ],
                 AtTime=target_date #  ISO 8601 e.g.) 2023-09-18T00:00:00+09:00
            )

            logger.debug('get_calendar_state response: {}'.format(calendar_response))
            calendar_state = calendar_response.get('State')

        if calendar_state == 'OPEN':
            # OPEN の場合のみ実行する
            logger.debug('calendar_state: {}'.format(calendar_state))
            # see: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ec2/client/describe_instances.html
            ec2_response = ec2.describe_instances(InstanceIds=[instance_id])
            logger.debug('describe_instances response: {}'.format(ec2_response))
            ec2_status = ec2_response['Reservations'][0]['Instances'][0]['State']['Name']
            logger.debug('ec2_status: {}'.format(ec2_status))
            ret = is_execute(action, ec2_status)

            if action == "Start" and ret:
                logger.info('Execute "{action}" action to EC2[{instance_id}]'.format(action=action, instance_id=instance_id))
                ec2_action_response = ec2.start_instances(InstanceIds=[instance_id])
                logger.debug('ec2_action_response: {}'.format(ec2_action_response))
            elif action == "Stop" and ret:
                logger.info('Execute "{action}" action to EC2[{instance_id}]'.format(action=action, instance_id=instance_id))
                ec2_action_response = ec2.stop_instances(InstanceIds=[instance_id])
                logger.debug('ec2_action_response: {}'.format(ec2_action_response))
            else:
                logger.info('The specified action is "{action}", but EC2[{instance_id}] is "{ec2_status}" so it will not be executed'.format(action=action, instance_id=instance_id,ec2_status=ec2_status))

        return {
            'statusCode': 200,
            'body': json.dumps('done!')
        }
    except Exception as e:
      logger.exception(str(e))
      return {
            'statusCode': 500,
            'body': json.dumps(str(e))
      }
    finally:
      logger.info('complete.')

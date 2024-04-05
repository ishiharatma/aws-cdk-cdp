
from datetime import datetime
from logging import getLogger, INFO
import json
import os
from botocore.exceptions import ClientError
import boto3

logger = getLogger()
logger.setLevel(INFO)

def publishSns(topicArn, subject, messageBody):
    try:
        sns = boto3.client('sns')
        if topicArn:
            response = sns.publish(
                TopicArn = topicArn,
                Message = messageBody,
                Subject = subject
            )
        logger.debug('response : {}'.format(response))
    except Exception as e:
        logger.exception(str(e))

def lambda_handler(event, context):
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)

        PJName=os.getenv('PROJECT_NAME')
        EnvName=os.getenv('ENV_NAME')
        clusterName = os.getenv('CLUSTER_NAME')
        serviceName = os.getenv('SERVICE_NAME')
        servicePrefix = os.getenv('SERVICE_PREFIX')
        topicArn = os.getenv('TOPIC_ARN')
        client = boto3.client('ecs')
        action = event.get('action')
        desiredCount = event.get('desiredCount')
        
        logger.info('Service[{}] : [{}]'.format(serviceName,action))

        # see: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ecs.html#ECS.Client.describe_services
        response = client.describe_services(
                cluster = clusterName,
                services = [serviceName],
        )
        # { 'services': [ {....}] }
        logger.info('response : {}'.format(response))
        services = response['services']
        if len(services) == 0:
            logger.warn('Service[{}] not found.'.format(serviceName))
        else:
            service = services[0]
            service_status = service['status']
            # ACTIVE , DRAINING , or INACTIVE 
            if service_status == 'ACTIVE':
                logger.info('Service[{}] Status is [{}]'.format(serviceName,service_status))
                service_desiredCount  = service['desiredCount']
                logger.info('Service[{}] desiredCount is [{}]'.format(serviceName,service_desiredCount))

                if action == 'start':
                    if service_desiredCount == 0:
                        logger.debug('Execute start action.')
                        # see: https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ecs.html#ECS.Client.update_service
                        result = client.update_service(
                            cluster = clusterName,
                            service = serviceName,
                            desiredCount = desiredCount,
                        )
                        logger.info('result: {}'.format(result))
                        publishSns(topicArn, 'Service[{}] : [{}]'.format(servicePrefix,action), 'complete.')
                    else:
                        logger.warn('Service[{}] already running. desiredCount: {}'.format(serviceName, service_desiredCount))
                        publishSns(topicArn, 'Service[{}] : [{}]'.format(servicePrefix,action), 'already running.')

                elif action == 'stop':
                    if service_desiredCount > 0:
                        logger.debug('Execute stop action.')
                        result = client.update_service(
                            cluster = clusterName,
                            service = serviceName,
                            desiredCount = 0,
                        )
                        logger.info('result: {}'.format(result))
                        publishSns(topicArn, 'Service[{}] : [{}]'.format(servicePrefix,action), 'complete.')
                    else:
                        logger.warn('Service[{}] already stopped.'.format(serviceName))
                        publishSns(topicArn, 'Service[{}] : [{}]'.format(servicePrefix,action), 'already stopped.')
                else:
                    logger.exception('Invalid action[{}].'.format(action))
            else:
                logger.exception('Service Status is no ACTIVE. status[{}]'.format(service_status))
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
        logger.info('Complete.')


if __name__ == "__main__":
    event = {}
    context = {}
    lambda_handler(event, context)
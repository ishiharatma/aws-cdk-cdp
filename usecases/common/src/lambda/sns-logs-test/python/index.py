import urllib3
import json
import logging
import os

# ロギングの設定
logger = logging.getLogger()
#logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    #logLevel = os.environ.get('LOG_LEVEL', 'INFO')
    #logger.setLevel(logLevel)
    try:
        logger.info('Received event: {}'.format(json.dumps(event)))
        # SNSメッセージを取得
        sns_message = event["Records"][0]["Sns"]
        topic_arn = sns_message["TopicArn"]
        MessageId = sns_message["MessageId"]
        subject = sns_message["Subject"]
        type = sns_message["Type"]
        message = sns_message["Message"]
        messageAttributes = sns_message["MessageAttributes"]
        
        logger.debug('SNS message: {}'.format(json.dumps(sns_message)))
        logger.debug('topic_arn: {}'.format(topic_arn))
        logger.debug('MessageId: {}'.format(MessageId))
        logger.debug('subject: {}'.format(subject))
        logger.debug('type: {}'.format(type))
        logger.debug('message: {}'.format(json.dumps(message)))

        # messageAttributesに、severity/logGroup/logStream/eventSourceId/eventTimeが存在したらログ出力
        atts = ["severity", "logGroup", "logStream", "eventSourceId", "eventTime"]
        for att in atts:
            if att in messageAttributes:
                logger.debug('{}: {}'.format(att, messageAttributes[att]["Value"]))

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
        logger.info('Function complete')

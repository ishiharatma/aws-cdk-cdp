import urllib3
import json
import logging

# ロギングの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
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
        
        logger.info('SNS message: {}'.format(json.dumps(sns_message)))
        logger.info('topic_arn: {}'.format(topic_arn))
        logger.info('MessageId: {}'.format(MessageId))
        logger.info('subject: {}'.format(subject))
        logger.info('type: {}'.format(type))
        logger.info('message: {}'.format(json.dumps(message)))

        # messageAttributesに、severity/logGroup/logStream/eventSourceId/eventTimeが存在したらログ出力
        atts = ["severity", "logGroup", "logStream", "eventSourceId", "eventTime"]
        for att in atts:
            if att in messageAttributes:
                logger.info('{}: {}'.format(att, messageAttributes[att]["Value"]))

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

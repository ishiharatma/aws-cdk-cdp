import urllib3
import json
import os
import logging

http = urllib3.PoolManager()

# ロギングの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    try:
        logger.info('Received event: %s', json.dumps(event))
        # 環境変数から取得
        webhook_url = os.environ['SLACK_WEBHOOK_URL']

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

        # Slack用のメッセージを作成
        slack_message = {
            "text": f"{message}"
        }
        
        encoded_msg = json.dumps(slack_message).encode("utf-8")
        
        # Slackに送信
        resp = http.request(
            "POST",
            webhook_url,
            body=encoded_msg,
            headers={"Content-Type": "application/json"}
        )

        # 結果をログに出力
        logger.debug({
            "topic_arn": topic_arn,
            "message": message,
            "webhook_url": webhook_url,
            "status_code": resp.status,
            "response": resp.data
        })

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Successfully processed SNS message",
                "status": resp.status
            })
        }
    except Exception as e:
        logger.exception(str(e))
        return {
            'statusCode': 500,
            'body': json.dumps(str(e))
        }
    finally:
        logger.info('complete')
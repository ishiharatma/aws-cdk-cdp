import urllib3
import json
import os
import logging
from urllib.request import Request, urlopen

# ロギングの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    try:
        logger.info('Received event: %s', json.dumps(event))
        # 環境変数から取得
        slack_webhook_url = os.environ['SLACK_WEBHOOK_URL']

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
        logger.debug('messageAttributes: {}'.format(json.dumps(messageAttributes)))

        # Slack用のメッセージを作成
        send_message += message + "\n" + "\n" 
        send_message += messageAttributes["logGroup"]["Value"] + "\n"
        send_message += messageAttributes["logStream"]["Value"] + "\n"
        slack_message = {
            'attachments': [
                {
                    'color': '#36464f',
                    'text': send_message,
                    'footer': 'Amazon Lambda'
                }
            ]
        }
        
        encoded_msg = json.dumps(slack_message).encode("utf-8")
        
        # Slackに送信
        req = Request(slack_webhook_url, json.dumps(slack_message).encode('utf-8'))
        
        response_body = urlopen(req).read().decode('utf-8')
        logger.debug("response_body: {}".format(response_body)

        # 結果をログに出力
        logger.debug({
            "topic_arn": topic_arn,
            "message": message,
            "webhook_url": slack_webhook_url,
            "status_code": req.status_code,
            "response": response_body
        })

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Successfully processed SNS message",
                "status": req.status_code
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
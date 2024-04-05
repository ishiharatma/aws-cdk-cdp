import base64
import json
import zlib
import datetime
import os
import boto3
from botocore.exceptions import ClientError
from logging import getLogger, INFO, DEBUG

logger = getLogger()
logger.setLevel(INFO)
sns = boto3.client('sns')

def lambda_handler(event, context):
    """
    main
    """
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)
        PJName=os.getenv('PROJECT_NAME')
        EnvName=os.getenv('ENV_NAME')
        topicarns=os.environ.get('TOPIC_ARNS', "")
        logger.debug("TOPIC_ARNS: {}".format(topicarns))

#        if not topicarns:
#            raise Exception('topicarn does not specified.')

        data = zlib.decompress(base64.b64decode(event['awslogs']['data']), 16+zlib.MAX_WBITS)
        data_json = json.loads(data)
        logger.debug("data_json: {}".format(data_json))
        awsaccountId = data_json['owner']
        logGroup = data_json['logGroup']
        appname = logGroup.split('/')[-1]
        subject = "{} でエラーが発生しました。".format(appname[:30]) # subject が最大 100 文字なため一定文字数で切る。
        logStream = data_json['logStream']
        logger.debug("awsaccountId: {}".format(awsaccountId))
        logger.debug("logGroup: {}".format(logGroup))
        logger.debug("logStream: {}".format(logStream))
        
        log_entire_json = json.loads(json.dumps(data_json["logEvents"], ensure_ascii=False))
        log_entire_len = len(log_entire_json)
        logger.debug("log_entire_json: {}".format(log_entire_json))
        log_json = []

        for i in range(log_entire_len): 
            log_event = json.loads(json.dumps(data_json["logEvents"][i], ensure_ascii=False))
            log_json.append(log_event['message'].rstrip('\n'))

        logger.debug("error message: {}".format("\n".join(log_json)))
        
        messageBody = '※ 本メールはシステムにより自動的に送信されています。' + '\n\n'
        messageBody += "{} でエラーが発生しました。".format(appname) + '\n\n'
        messageBody += "[AWSアカウント/ログ情報]" + '\n'
        messageBody += "AWS Account ID: {}".format(awsaccountId) + '\n'
        messageBody += "Environment: {}".format(EnvName) + '\n'
        messageBody += "logGroup: {}".format(logGroup) + '\n'
        messageBody += "logStream: {}".format(logStream) + '\n\n'
        messageBody += "[エラーメッセージ]" + '\n'
        messageBody += "\n".join(log_json)
        #messageBody += "\n\n" + "このメールは自動送信メールです。返信はしないでください。"

        logger.debug("messageBody: {}".format(messageBody))

        #SNS Publish
        if topicarns:
            for topicarn in topicarns.split(','):
                publishResponse = sns.publish(
                    TopicArn = topicarn,
                    Message = messageBody,
                    Subject = subject
                )
        else:
            logger.debug("Alert SNS Topic does not specified")

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
        logger.info('complete')
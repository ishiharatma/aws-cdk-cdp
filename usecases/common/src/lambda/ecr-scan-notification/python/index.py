"""
This is a sample function to send ECR Image ScanFindings to SNS.
"""

from datetime import datetime
from logging import getLogger, INFO
import json
import os
from botocore.exceptions import ClientError
import boto3

logger = getLogger()
logger.setLevel(INFO)
sns = boto3.client('sns')

def get_params(PJName, EnvName, account, region, scan_result):
    #region = os.environ['AWS_DEFAULT_REGION']
    severity_list = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMAL', 'UNDEFINED']
    finding_counts = scan_result['imageScanFindingsSummary']['findingSeverityCounts']

    for severity in severity_list:
        finding_counts.setdefault(severity, 0)

    title = f"[{PJName}-{EnvName}]ECR Image Scan findings | {region} | Account:{scan_result['registryId']}"
    description = scan_result['imageScanStatus']['description']

    complete_at = datetime.strftime(
        scan_result['imageScanFindingsSummary']['imageScanCompletedAt'],
        '%Y-%m-%d %H:%M:%S %Z'
    )
    source_update_at = datetime.strftime(
        scan_result['imageScanFindingsSummary']['vulnerabilitySourceUpdatedAt'],
        '%Y-%m-%d %H:%M:%S %Z'
    )

    message = '※ 本メールはシステムにより自動的に送信されています。'
    message += '\n\n'
    if finding_counts['CRITICAL'] > 0 or finding_counts['HIGH'] > 0:
        message += '\n' + '重要度 CRITICAL または、HIGH の脆弱性が検出されています。対処をしてください。'
    message += '\n' + 'fallback:' + 'AmazonECR Image Scan Findings Description.'
    message += '\n' + 'scan target:' + f'''{scan_result['repositoryName']}:{scan_result['imageTags'][0]}'''
    message += '\n' + 'link:' + f'''https://console.aws.amazon.com/ecr/repositories/private/
                    ${account}/
                    {scan_result['repositoryName']}/image/
                    {scan_result['imageDigest']}/scan-results/?region={region}'''
    message += '\n' + 'text:' + f'''{description}\nImage Scan Completed at {
                    complete_at}\nVulnerability Source Updated at {source_update_at}'''
    message += '\n\n'
    message += '\n' + '<finding-severity-counts>'
    message += '\n\t' + 'Critical: %d' % (finding_counts['CRITICAL'])
    message += '\n\t' + 'High: %d' % (finding_counts['HIGH'])
    message += '\n\t' + 'Medium: %d' % (finding_counts['MEDIUM'])
    message += '\n\t' + 'Low: %d' % (finding_counts['LOW'])
    message += '\n\t' + 'Informational: %d' % (finding_counts['INFORMAL'])
    message += '\n\t' + 'Undefined: %d' % (finding_counts['UNDEFINED'])
    sns_message = {
        'title': title,
        'message': message
    }
    return sns_message

def get_findings(detail):
    """Returns the image scan findings summary"""
    ecr = boto3.client('ecr')
    try:
        response = ecr.describe_images(
            repositoryName=detail['repository-name'],
            imageIds=[
                {'imageDigest': detail['image-digest']}
            ]
        )
    except ClientError as err:
        logger.error("Request failed: %s", err.response['Error']['Message'])
    else:
        return response['imageDetails'][0]

def putSns(topicArn, title, message):
    try:
        logger.debug('### putSns start.')
        if topicArn:
            response = sns.publish(
                TopicArn = topicArn,
                Message = message,
                Subject = title
            )
        else:
            logger.warn('topicArn does not specified')
    except Exception as e:
        logger.exception(str(e))

def lambda_handler(event, context):
    """AWS Lambda Function to send ECR Image Scan Findings to SNS"""
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)
        topicArn=os.environ.get('TOPIC_ARN')

        PJName=os.getenv('PROJECT_NAME')
        EnvName=os.getenv('ENV_NAME')
        account = event['account']
        region = event['region']
        scan_result = get_findings(event['detail'])
        sns_message = get_params(PJName, EnvName, account, region, scan_result)
        putSns(topicArn, sns_message['title'],sns_message['message'])
    
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
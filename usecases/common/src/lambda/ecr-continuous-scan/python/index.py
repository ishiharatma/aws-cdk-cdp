from datetime import datetime
from logging import getLogger, INFO
#from urllib.request import Request, urlopen
#from urllib.error import URLError, HTTPError
import json
import os
from botocore.exceptions import ClientError
import boto3

logger = getLogger()
logger.setLevel(INFO)

ecr = boto3.client('ecr')

class EcrImageScanner:
    def __init__(self, registry_id: str, repository_name: str, image_tag: str) -> None:
        self.ecr_client = boto3.client('ecr')
        self.waiter = self.ecr_client.get_waiter('image_scan_complete')
        self.registry_id = registry_id
        self.repository_name = repository_name
        self.image_tag = image_tag
        return
    
    def start_image_scan(self) -> None:
        # イメージスキャンを開始する.
        response = self.ecr_client.start_image_scan(
            registryId=self.registry_id,
            repositoryName=self.repository_name,
            imageId={
                'imageTag': self.image_tag,
            },
        )
        print(response)
        # イメージスキャンが完了するまで待つ.
        self.waiter.wait(
            registryId=self.registry_id,
            repositoryName=self.repository_name,
            imageId={
                'imageTag': self.image_tag,
            },
            WaiterConfig={
                'Delay': 5,
                'MaxAttempts': 60,
            },
        )
        return

def start_scan(scan_spec):
    logger.debug('### start_scan start.')
    try:
        for scan_item in scan_spec:
            if len(scan_item['tags']) == 0:
                # ALL TAG
                scan_image_lists(scan_item, "TAGGED")
            else:
                for tag in scan_item['tags']:
                    logger.debug('### tag :{}'.format(tag))
                    scan_images(scan_item, tag)

    except ClientError as err:
        logger.error("Request failed: %s", err.response['Error']['Message'])
    else:
        return 

def scan_image_lists(scan_item, tagStatus):
    next_token = ''
    while True:
        if next_token == '':
            response = ecr.list_images(
                             registryId=scan_item['registry'],
                             repositoryName=scan_item['repository'],
                             #maxResults=100,
                             filter={
                                 'tagStatus': tagStatus
                             }
                         )
        else:
            response = ecr.list_images(
                             registryId=scan_item['registry'],
                             repositoryName=scan_item['repository'],
                             nextToken=next_token,
                             #maxResults=100,
                             filter={
                                 'tagStatus': tagStatus
                             }
                         )
        logger.info('response: {}'.format(response))
        if ('imageIds' in response):
            for imageId in response['imageIds']:
                logger.info('imageId: {}'.format(imageId))
                logger.debug('registry_id: {}'.format(scan_item['registry']))
                logger.debug('repository_name: {}'.format(scan_item['repository']))
                logger.debug('image_tag: {}'.format(imageId['imageTag']))
                ecr_image_scanner = EcrImageScanner(
                                               registry_id=scan_item['registry'],
                                               repository_name=scan_item['repository'],
                                               image_tag=imageId['imageTag'])
                try:
                    ecr_image_scanner.start_image_scan()
                except Exception as e:
                    logger.exception(str(e))

        if 'NextToken' in response:
            next_token = response['NextToken']
        else:
            break

def scan_images(scan_item, imageTag):
    next_token = ''
    while True:
        if next_token == '':
            response = ecr.describe_images(
                             registryId=scan_item['registry'],
                             repositoryName=scan_item['repository'],
                             imageIds=[
                                 {
                                     'imageTag': imageTag
                                 },
                             ],
                             filter={
                                 'tagStatus': 'TAGGED'
                             }
                         )
        else:
            response = ecr.describe_images(
                             registryId=scan_item['registry'],
                             repositoryName=scan_item['repository'],
                             nextToken=next_token,
                             imageIds=[
                                 {
                                     'imageTag': imageTag
                                 },
                             ],
                             filter={
                                 'tagStatus': 'TAGGED'
                             }
                         )
        logger.info('response: {}'.format(response))
        if ('imageDetails' in response):
            logger.info('response: {}'.format(response))
            logger.info('imageDetails: {}'.format(response['imageDetails']))
            for imageId in response['imageDetails']:
                logger.debug('registry_id: {}'.format(scan_item['registry']))
                logger.debug('repository_name: {}'.format(scan_item['repository']))
                logger.debug('image_tag: {}'.format(imageId['imageTags'][0]))
                ecr_image_scanner = EcrImageScanner(
                                               registry_id=scan_item['registry'],
                                               repository_name=scan_item['repository'],
                                               image_tag=imageId['imageTags'][0])
                try:
                    ecr_image_scanner.start_image_scan()
                except Exception as e:
                    logger.exception(str(e))

        if 'nextToken' in response:
            next_token = response['nextToken']
        else:
            break

def get_scan_spec(configBucket, scanID):
    logger.debug('### get_scan_spec start.')
    s3 = boto3.resource('s3')
    bucket = s3.Bucket(configBucket)
    obj = bucket.Object(scanID)
    response = obj.get()
    body = response['Body'].read()

    return json.loads(body.decode('utf-8'))

def lambda_handler(event, context):
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)

        bucketName=os.environ.get('BUCKET_NAME')
        objectKey=os.environ.get('OBJECT_KEY_NAME')

        scan_spec = get_scan_spec(bucketName, objectKey)
        logger.info('scan_spec: {}'.format(scan_spec))

        start_scan(scan_spec)
    
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
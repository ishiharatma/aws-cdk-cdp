# -*- coding: utf-8 -*-
import os
import boto3
import json
import uuid
from logging import getLogger, INFO
import urllib.parse
s3 = boto3.resource('s3')
glue = boto3.client('glue')
logger = getLogger()
logger.setLevel(INFO)

def lambda_handler(event, context):

    try:
        logger.info(event)
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8') 
        fname = key.split('/')[-1]
        logger.info('%s バケットに %s が作成されました！' % (bucket, key))
        logger.info('ファイル名は %s です' % fname)

        # ファイルをロード
        src_obj = s3.Object(bucket, key)
        jsondata = json.loads(src_obj.get()['Body'].read().decode('utf-8'))
        logger.info('jsondata: %s' % jsondata)
        Arguments = {
                '--SRC_BUCKET_NAME': jsondata['BUCKET_NAME'],
                '--SRC_OBJECT_KEY_NAME': jsondata['OBJECT_KEY_NAME'],
                '--RS_HOST': os.environ.get('RS_HOST'),
                '--RS_PORT': os.environ.get('RS_PORT'),
                '--RS_DATABASE': os.environ.get('RS_DATABASE'),
                '--RS_USER': os.environ.get('RS_USER'),
                '--RS_PASSWORD': os.environ.get('RS_PASSWORD'),
                '--RS_SCHEMA': os.environ.get('RS_SCHEMA'),
                '--RS_TABLE': '%s' % (os.environ.get('RS_TABLE')),
                '--RS_COLUMNS': os.environ.get('RS_COLUMNS'),
                '--IAM_ROLE_ARN': os.environ.get('IAM_ROLE_ARN'),
                '--TOPIC_ARN': os.environ.get('topicArn')
        }
        logger.info('Arguments: %s' % Arguments)
        response = glue.start_job_run(
            JobName = 'copy2redshift',
            Arguments = Arguments)
        logger.info(response)
        return response

    except Exception as e:
        logger.exception(str(e))
        return {
            'statusCode': 500,
            'body': json.dumps(str(e))
        }
    finally:
        logger.info('complete')

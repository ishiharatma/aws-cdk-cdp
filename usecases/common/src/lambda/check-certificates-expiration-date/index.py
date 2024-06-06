import os
import boto3
import json
from logging import getLogger, INFO
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
import urllib3

acmClient = boto3.client('acm')
snsClient = boto3.client('sns')

logger = getLogger()
logger.setLevel(INFO)

def check_expiration_date(thresholdType, thresholdValue , snsArn):
    now = datetime.now()
    logger.debug('now:%s' % now)
#    checkdate = now.date() + timedelta(days=-1)
    logger.debug('thresholdType:%s' % thresholdType)
    logger.debug('thresholdValue:%s' % thresholdValue)
    if thresholdType == 'year':
        checkdate = now.date() + relativedelta(years=thresholdValue)
    elif thresholdType == 'month':
        checkdate = now.date() + relativedelta(months=thresholdValue)
    elif thresholdType == 'week':
        checkdate = now.date() + relativedelta(weeks=thresholdValue)
    else:
        checkdate = now.date() + relativedelta(days=thresholdValue)

    logger.debug('checkdate:%s' % checkdate)
    cer = get_Certificates()

    if not cer['CertificateSummaryList']:
        logger.info('Certificates not found.')
    expireList = []
    for c in cer['CertificateSummaryList']:
        cerArn = c['CertificateArn']
        logger.debug('CertificateArn:%s' % cerArn)
        response = acmClient.describe_certificate(
            CertificateArn=cerArn
        )
        logger.info('response:%s' % response)
        # 'Status': 'PENDING_VALIDATION'|'ISSUED'|'INACTIVE'|'EXPIRED'|'VALIDATION_TIMED_OUT'|'REVOKED'|'FAILED'

        logger.debug('Certificate DomainName:%s' % response['Certificate']['DomainName'])
        logger.debug('Certificate Status:%s' % response['Certificate']['Status'])
        logger.debug('Certificate NotAfter:%s' % response['Certificate']['NotAfter'])
        if checkdate > response['Certificate']['NotAfter'].date():
            expireList.append('DomainName=%s\nArn=%s\nExpire:%s' \
                            % (response['Certificate']['DomainName'],cerArn,response['Certificate']['NotAfter']))
        else:
            logger.debug('OK')
    
    if expireList:
        expireList.insert(0, 'Your certificate (or certificates) for the names listed below will expire in %s %ss.\nPlease make sure to renew your certificate before then.' % (thresholdValue, thresholdType))
        if snsArn:
            request = {
                'TopicArn': snsArn,
                'Message': '\n'.join(expireList),
                'Subject': 'Certificate expiration notice'
            }
            response = snsClient.publish(**request)
            logger.debug('publish response:%s' % response)
        else:
            logger.exception('\n'.join(expireList))
       
        
def get_Certificates():
  return acmClient.list_certificates()

def lambda_handler(event, context):
    """
    main
    """
    try:
        logger.info('start')
        logger.debug('event:%s' % event)
        thresholdValue = event.get('thresholdValue')
        thresholdType = event.get('thresholdType')
        snsArn = event.get('topicArn')
        if not thresholdValue:
            raise Exception('Parameter[thresholdValue] does not specified.')
        if not thresholdType:
            thresholdType = 'day'

        check_expiration_date(thresholdType, thresholdValue,snsArn)
        
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
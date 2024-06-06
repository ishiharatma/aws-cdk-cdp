import boto3
import json
from logging import getLogger, INFO

logger = getLogger()
logger.setLevel(INFO)

ec2_client = boto3.client('ec2')
snsClient = boto3.client('sns')

def lambda_handler(event, context):
    try:
      logger.info('start')
      snsArn = event.get('topicArn')
      excludeIps = []
      if event.get('excludeIps'):
        excludeIps = event.get('excludeIps')

      response = unassignedEipExisting(get_eips(), excludeIps)
      eips = []
      if response['ret']:
        logger.warn("unassignedEip exist. [%s]" % ','.join(response['eips']))
        eips = response['eips']
        if snsArn:
          request = {
              'TopicArn': snsArn,
              'Message': 'UnassignedEip exist.\n' + '\n'.join(response['eips']),
              'Subject': 'UnassignedEip exist'
          }
          response = snsClient.publish(**request)
          logger.debug('publish response:%s' % response)
      else:
        logger.info("unassignedEip does not exist.")
      return {
          'statusCode': 200,
          'body': json.dumps(eips)
      }
    except Exception as e:
      logger.exception(str(e))
      print(str(e))
      return {
            'statusCode': 500,
            'body': json.dumps('failed![%s]' % (str(e)))
      }
    finally:
      logger.info('complete.')

def get_eips():
  logger.debug('get_eips start')
  response = ec2_client.describe_addresses(
        Filters=[
            {'Name': 'domain','Values': ['vpc'] }
        ]
  )
  logger.debug('response: %s' % response)
  logger.debug('get_eips end')
  return response

def unassignedEipExisting(describe_addresses, excludeIps):
  value = dict.fromkeys(['eips','ret'])
  value['eips'] = []
  logger.debug('describe_addresses: %s' % describe_addresses)
  if describe_addresses['Addresses']:
    for eip in describe_addresses['Addresses']:
      logger.debug('Addresses: %s' % eip)
      if "NetworkInterfaceId" not in eip:
        if eip["PublicIp"] not in excludeIps:
          value['ret'] = True
          value['eips'].append(eip["PublicIp"])
  return value
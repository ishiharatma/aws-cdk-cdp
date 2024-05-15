import os
import json
import urllib.parse
import boto3
from logging import getLogger, INFO, DEBUG
logger = getLogger()
logger.setLevel(INFO)

def setup_logging(log_level):
    logger.setLevel(log_level)

def update_waf_ipset(ipset_name,ipset_id,address_list,scope='CLOUDFRONT'):
    """Updates the AWS WAF IP set"""
    waf_client = boto3.client('wafv2', region_name='us-east-1')

    ip_set_info = get_ipset_lock_token(waf_client,ipset_name,ipset_id,scope)
    
    lock_token = ip_set_info['LockToken']
    current_ip_addresses = ip_set_info['IPSet']['Addresses']

    logger.info(f'Got LockToken for AWS WAF IP Set "{ipset_name}": {lock_token}')
    # 新しいIPアドレスと現在のIPアドレスの差分を取得
    ip_addresses_to_insert = [ip_address for ip_address in address_list if ip_address not in current_ip_addresses]
    ip_addresses_to_delete = [ip_address for ip_address in current_ip_addresses if ip_address not in address_list]
    
    if ip_addresses_to_insert:
        logger.info('new ip address: {}'.format(ip_addresses_to_insert))
    if ip_addresses_to_delete:
        logger.info('remove ip address: {}'.format(ip_addresses_to_delete))

    if ip_addresses_to_insert or ip_addresses_to_delete:
        waf_client.update_ip_set(
            Name=ipset_name,
            Scope=scope,
            Id=ipset_id,
            Addresses=address_list,
            LockToken=lock_token
        )
        print(f'Updated IPSet "{ipset_name}" with {len(address_list)} CIDRs')
    else:
        logger.info('No update to the IPSet is required.')

def get_ipset_lock_token(client,ipset_name,ipset_id,scope):
    """Returns the AWS WAF IP set lock token"""
    ip_set = client.get_ip_set(
        Name=ipset_name,
        Scope=scope,
        Id=ipset_id)
    
    return ip_set

def lambda_handler(event, context):
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        bucket_name = event['Records'][0]['s3']['bucket']['name']
        file_key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')

        IP_SET_NAME = os.environ.get('IP_SET_NAME')
        IP_SET_ID = os.environ.get('IP_SET_ID')

        # S3 オブジェクトからファイルの内容を読み取る
        s3 = boto3.client('s3')
        file_obj = s3.get_object(Bucket=bucket_name, Key=file_key)
        file_content = file_obj['Body'].read().decode('utf-8')
        # ファイルの内容から IP アドレスのリストを作成
        # 空白行および、先頭が'#'で始まるコメント行を除外
        ip_addresses = [line.strip() for line in file_content.split('\n') if line.strip() and not line.startswith('#')]
        logger.debug(ip_addresses) 
        
        update_waf_ipset(IP_SET_NAME,IP_SET_ID,ip_addresses)
    
        return ip_addresses
    except Exception as e:
        logger.exception(str(e))
        logger.exception('Error getting object {} from bucket {}. Make sure they exist and your bucket is in the same region as this function.'.format(file_key, bucket_name))
        raise e


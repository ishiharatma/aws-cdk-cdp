import json
import os
import urllib.request
import time
import re
import boto3
from logging import getLogger, INFO, DEBUG
logger = getLogger()
logger.setLevel(INFO)
INDENT_L1 = '　'
INDENT_L2 = '　　'

git_pattern = re.compile(r'(\d+)\.(\d+)(\.\d+)?') # 1.2 or 1.2.1

def setup_logging(log_level):
    logger.setLevel(log_level)

def check_version(current_version, git_tags):
    # [{"name":"19.0", "last_modified":""},{"name":"19.0.3", "last_modified":""},...]
    # "22.0.3-0" というバージョンもあるが "-"以降は無視
    #current_version_array = [int(part) for part in current_version.split('.')]
    #current_version_major, current_version_minor, current_version_patch = current_version_array + [0] * (3 - len(current_version_array))
    current_version_array = current_version.split('.')
    current_version_major = int(current_version_array[0])
    current_version_minor = int(current_version_array[1])
    current_version_patch = int(current_version_array[2] if current_version_array[2]!=None else 0)
    logger.debug('Git Tag Version> Major :{}, Minor :{}, Patch :{}'.format(current_version_major,current_version_minor,current_version_patch))
    #is_major_update = False
    #is_current_major_update = False
    newer_major_version = []
    newer_current_version = []
    for git_tag in  git_tags:
        version = git_tag['name']
        logger.debug('Git Tag Version :{}'.format(version))
        m = git_pattern.match(version)
        if m:
            #major, minor, patch = [int(part) for part in m.group(1).split('.')]
            major = int(m.group(1))
            minor = int(m.group(2))
            patch = int(m.group(3).replace('.','') if m.group(3) !=None else 0)

            logger.debug('Major :{}, Minor :{}, Patch :{}'.format(major,minor,patch))

            if major > current_version_major:
                # メジャーバージョンが新しい
                #is_major_update = True
                newer_major_version.append(version)
                #break
            elif major == current_version_major:
                # メジャーバージョンが同一
                if minor > current_version_minor:
                    # マイナーバージョンが新しい
                    #is_major_update = True
                    #is_current_major_update = True
                    newer_current_version.append(version)
                    #break
                if minor == current_version_minor and patch > current_version_patch:
                    # パッチが新しい
                    #is_major_update = True
                    #is_current_major_update = True
                    newer_current_version.append(version)
                    #break
    is_major_update = bool(newer_major_version)
    is_current_major_update = bool(newer_current_version)

    logger.info('is_major_update: {}, is_current_major_update: {}'.format(is_major_update,is_current_major_update))
    logger.info('current version: {}, latest current version: {}, latest major version: {}'.format(current_version, max(newer_current_version, default='None'), max(newer_major_version, default='None')))
    return {'is_major_update':is_major_update,
            'is_current_major_update':is_current_major_update,
            'newer_current_version': max(newer_current_version, default=None),
            'newer_major_version': max(newer_major_version, default=None)
            }

def get_ecr_describe_images(repository_name):
    try:
        ecrclient = boto3.client("ecr", region_name="ap-northeast-1")
        response_image_latest_tag = ecrclient.describe_images(
            repositoryName= repository_name,
            imageIds=[
                {
                    'imageTag': 'latest',
                }
            ]
        )
        return response_image_latest_tag
    except Exception as e:
      raise

def fetch_quay_tags(repository_name, page_limit):
    tags = []
    count = 0
    has_additional = True
    
    while has_additional:
        count += 1
        url = 'https://quay.io/api/v1/repository/{0}/{0}/tag/?page={1}&limit={2}'.format(repository_name, count, page_limit)
        req = urllib.request.Request(url)
        
        with urllib.request.urlopen(req) as res:
            response = res.read()
        
        response_json = json.loads(response)
        tags += response_json['tags']
        has_additional = response_json['has_additional']
    
    logger.debug('pages: {}, tags: {}'.format(count, tags))
    return tags

def lambda_handler(event, context):
    try:
        setup_logging(INFO)
        # ex: arn:aws:lambda:ap-northeast-1:xxxxxxxxxxxxxxxx:function:test
        accountId = context.invoked_function_arn.split(':')[4]
        PROJECT_NAME = os.environ.get('PROJECT_NAME', 'N/A')
        ENV_NAME = os.environ.get('ENV_NAME', 'N/A')
        REPOSITORY_NAME = os.environ.get('REPOSITORY_NAME')
        ECR_NAME = os.environ.get('ECR_NAME')
        TOPIC_ARN = os.environ.get('TOPIC_ARN')
        PAGE_LIMIT = int(os.environ.get('PAGE_LIMIT', 100))
        LOG_LEVEL = os.environ.get('LOG_LEVEL')
        if LOG_LEVEL:
            setup_logging(LOG_LEVEL)
        tags = []
        now_unixtime = int(time.time())
        now_ver = '<バージョンタグ未設定>'
        if REPOSITORY_NAME:
            tags = fetch_quay_tags(repository_name=REPOSITORY_NAME, page_limit=PAGE_LIMIT)
    
            target_tags = list(filter(lambda item : item.get("end_ts",now_unixtime) >= now_unixtime and item["name"] not in ['nightly','latest'] and not item["name"].endswith("legacy"), tags))
            target_tags_sorted = sorted(target_tags,key=lambda x: x['name'],reverse=True)
            logger.debug('target_tags_sorted: {}'.format(target_tags_sorted))
            
            # ECR イメージ取得
            response_image_latest_tag = get_ecr_describe_images(repository_name= ECR_NAME)
            logger.debug(response_image_latest_tag)
            
            is_latest = True
            latest_version = []
            current_version_up = ''
            major_version_up = ''
            
            if 'imageDetails' in response_image_latest_tag:
                image_tags = response_image_latest_tag['imageDetails'][0]['imageTags']
                logger.debug(image_tags)
                image_digest = response_image_latest_tag['imageDetails'][0]['imageDigest']
                image_pushed_at = response_image_latest_tag['imageDetails'][0]['imagePushedAt']
                image_tags.remove('latest')
                now_ver = '<バージョンタグ未設定>'
                p = re.compile(r'{}-([0-9.]+)-.+'.format(ENV_NAME)) # イメージタグは、「環境識別子-0.0.0-コミット番号」という形式
                if len(image_tags) > 0:
                    logger.debug(image_tags)
                    for image_tag in image_tags: # latestが付いているのは、1つのタグだけなので、1回のみの処理
                        logger.debug(image_tag)
                        m = p.match(image_tag)
                        if m!=None:
                            for ver in m.groups():
                                logger.debug('check ecr tag version:{}'.format(ver))
                                now_ver = ver
                                ret = check_version(ver, target_tags_sorted)
                                logger.debug('ret:{}'.format(ret))
                                if ret['is_major_update'] or ret['is_current_major_update']:
                                    # 同一メジャーか、最新メジャーバージョンが存在
                                    is_latest = False
                                    if ret['newer_current_version']:
                                        latest_version.append(ret['newer_current_version'])
                                        current_version_up = ret['newer_current_version']
                                    if ret['newer_major_version']:
                                        latest_version.append(ret['newer_major_version'])
                                        major_version_up = ret['newer_major_version']
                                    logger.info('version ng!')
                                    break
                                else:
                                     logger.info('version ok!')
                            else:
                                continue
                            break
                    
                    if not is_latest:
                        # 最新バージョンが存在した場合、SNSに通知
                        messageSubject = '[{}-{}][AWS アカウント ID: {}] '.format(PROJECT_NAME,ENV_NAME,accountId) + 'Keycloak の最新バージョン({})があります。'.format('/'.join(latest_version))
                        messageBoy = "※ 本メールはシステムにより自動的に送信されています。" + '\n' + \
                                    '\n' + \
                                    '{0} の最新バージョン があります。'.format(REPOSITORY_NAME) + '\n' + \
                                    '{}メジャーバージョンアップ：{}'.format(INDENT_L1,major_version_up) + '\n' + \
                                    '{}マイナーバージョンアップ：{}'.format(INDENT_L1,current_version_up) + '\n' + \
                                    '現在リポジトリに登録されているバージョンは、{} のため、アップデートを検討してください。'.format(now_ver) + '\n\n' + \
                                    "{}・AWS アカウント ID: {}".format(INDENT_L1, accountId) + '\n' + \
                                    "{}・プロジェクト名: {}".format(INDENT_L1, PROJECT_NAME) + '\n' + \
                                    "{}・環境名: {}".format(INDENT_L1, ENV_NAME) + '\n' + \
                                    "{}・リポジトリ名: {}".format(INDENT_L1, ECR_NAME) + '\n' + \
                                    "{}・登録バージョン: {}".format(INDENT_L1, now_ver) + '\n' + \
                                    "{}・プッシュされた日時: {}".format(INDENT_L1, image_pushed_at) + '\n' + \
                                    "{}・ダイジェスト: {}".format(INDENT_L1, image_digest) + '\n' + \
                                    '\n' + \
                                    '{0} の最新バージョンは以下を確認してください。'.format(REPOSITORY_NAME) + '\n' + \
                                    'https://quay.io/repository/{0}/{0}?tab=tags'.format(REPOSITORY_NAME)

                        logger.debug('subject: {}'.format(messageSubject))
                        logger.debug('body: {}'.format(messageBoy))

                        if TOPIC_ARN:
                            # SNS に Publish
                            sns = boto3.client('sns')
                            response = sns.publish(
                                TopicArn = TOPIC_ARN,
                                Message = messageBoy,
                                Subject = messageSubject
                            )
                            logger.info("response:{}".format(response))
                    else:
                        logger.info('version is up to date.')
    
                else:
                    # latest タグ以外存在しない場合、チェックしない
                    logger.info('Does not exist other than the latest.')
    
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
      logger.info('complete.')

if __name__ == "__main__":
    event = {}
    context = {}
    lambda_handler(event, context)
import os
import json
from typing import List
import boto3
import time
from datetime import datetime, timedelta, date
import re
from logging import getLogger, INFO, DEBUG
logger = getLogger()
logger.setLevel(INFO)

def getUserlist() -> List:
    iam = boto3.client('iam')

    marker = None
    userlist = []
    while True:
        if marker:
            response = iam.list_users(
                       MaxItems=10,
                       Marker=marker)
        else:
            response = iam.list_users(
                       MaxItems=10)
        logger.debug("Next Page : {} ".format(response['IsTruncated']))
        for user in response['Users']:
            userlist.append(user)

        if 'Marker' in response:
            marker = response['Marker']
            logger.debug("Next Page : {} ".format(marker))
        else:
            break

    return userlist

def getAccessKeys(username) -> List:
    iam = boto3.client('iam')

    marker = None
    accessKeys = []
    while True:
        if marker:
            response = iam.list_access_keys(UserName=username, Marker=marker, MaxItems=10)
        else:
            response = iam.list_access_keys(UserName=username, MaxItems=10)

        logger.debug("Next Page : {} ".format(response['IsTruncated']))
        for key in response['AccessKeyMetadata']:
            accessKeys.append(key)
        if 'Marker' in response:
            marker = response['Marker']
            logger.debug("Next Page : {} ".format(marker))
        else:
            break

    return accessKeys

def getUserJoinedGroups(username) -> List:
    iam = boto3.client('iam')

    marker = None
    groups = []
    while True:
        if marker:
            response = iam.list_groups_for_user(UserName=username, Marker=marker, MaxItems=10)
        else:
            response = iam.list_groups_for_user(UserName=username, MaxItems=10)

        logger.debug("Next Page : {} ".format(response['IsTruncated']))
        for group in response['Groups']:
            groups.append(group['GroupName'])
        if 'Marker' in response:
            marker = response['Marker']
            logger.debug("Next Page : {} ".format(marker))
        else:
            break
    
    return groups

def isExcludeUser(username, checkTagName) -> bool:
    iam = boto3.client('iam')
    
    marker = None
    ret = False
    while True:
        if marker:
            response = iam.list_user_tags(UserName=username, Marker=marker, MaxItems=10)
        else:
            response = iam.list_user_tags(UserName=username, MaxItems=10)
    
        logger.debug("Next Page : {} ".format(response['IsTruncated']))
        for tag in response['Tags']:
            logger.debug('username: {} ,tag: {}'.format(username, tag))
            # タグが存在したら、対象外ユーザー
            if checkTagName == tag['Key']:
                ret = True
                break

        if 'Marker' in response:
            marker = response['Marker']
            logger.debug("Next Page : {} ".format(marker))
        else:
            break

    return ret

def lambda_handler(event, context) -> None:
    """
    main
    """
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)
        accountId = context.invoked_function_arn.split(':')[4]

        PROJECT_NAME = os.environ.get('PROJECT_NAME')
        ENV_NAME = os.environ.get('ENV_NAME')
        topicarn=os.environ.get('TOPICARN')
        periodInDays=os.environ.get('DAYS', 60)
        invalidGroupName=os.environ.get('INVALID_GROUP_NAME')
        expireUserDays = int(periodInDays) * 1.5  # 無効化する日数

        excludeUserTagName=os.environ.get('EXCLUDE_USER_TAG_NAME') # 無効化対象外ユーザーに付与するタグ。タグの存在有無だけで判定される

#        if not topicarn:
#           raise Exception('topicarn does not specified.')

        period = date.today() + timedelta(days=int(periodInDays)*(-1))
        expireUserPeriod = date.today() + timedelta(days=int(expireUserDays)*(-1))  # 無効化する判定日

        iam = boto3.client('iam')

        check_result = {}
        
        user_response = getUserlist()

        for user in user_response:
            logger.debug('username: {}, lastLogin: {}'.format(user['UserName'], user.get('PasswordLastUsed')))
            isInvalid = False
            reson = None
            # ユーザーのグループ取得
            usergroup_response = getUserJoinedGroups(user['UserName'])

            # ユーザータグのチェック: False の場合、チェック対象外
            isExcludeUser_response = False
            if excludeUserTagName:
                isExcludeUser_response = isExcludeUser(user['UserName'],excludeUserTagName)

            if not isExcludeUser_response:
                if not invalidGroupName in usergroup_response: # 無効化グループに存在しない場合
                    if isPasswordEnabled(user['UserName'], iam):
                        if user.get('PasswordLastUsed'):
                            if expireUserPeriod >= user.get('PasswordLastUsed').date():
                                isInvalid = True
                                reson = '過去 {:.0f} 日間コンソールにログインしていません。最終ログイン日: {}'.format(expireUserDays, user.get('PasswordLastUsed').date())
                                check_result = appendList(check_result,user['UserName'],'[High] {}'.format(reson))
                            elif period >= user.get('PasswordLastUsed').date():
                                check_result = appendList(check_result,user['UserName'],'[High] 過去 {} 日間コンソールにログインしていません。最終ログイン日: {}'.format(periodInDays, user.get('PasswordLastUsed').date()))
                            else:
                                check_result = appendList(check_result,user['UserName'],'[Info] 最終ログイン日: {}'.format(user.get('PasswordLastUsed').date()))

                        else:
                            if expireUserPeriod >= user.get('CreateDate').date():
                                reson = 'ユーザー作成後、{:.0f} 日間一度もコンソールにログインしていません。ユーザー作成日: {}'.format(expireUserDays, user.get('CreateDate').date())
                                check_result = appendList(check_result,user['UserName'],'[High] {}'.format(reson))
                                isInvalid = True
                            else:
                                check_result = appendList(check_result,user['UserName'],'[High] ユーザー作成後、一度もコンソールにログインしていません。ユーザー作成日: {}'.format(user.get('CreateDate').date()))
                    else:
                        check_result = appendList(check_result,user['UserName'],'[Info] コンソールパスワード無効ユーザです。')

                    # MFA の設定チェック
                    list_mfa_devices = iam.list_mfa_devices(UserName=user['UserName'])
                    if not list_mfa_devices['MFADevices']:
                        check_result = appendList(check_result,user['UserName'],'[High] MFAデバイスが設定されていません。')

                    # アクセスキーのチェック
                    access_keys = getAccessKeys(user['UserName'])
                    logger.debug('access_kyes: {}'.format(access_keys))
                    if access_keys:
                        logger.debug('access_keys: {}'.format(len(access_keys)))
                        active_access_keys = 0
                        for access_key in access_keys:
                            if access_key['Status'] == 'Active': # アクセスキーが有効な場合
                                access_key_last_used = iam.get_access_key_last_used(AccessKeyId=access_key['AccessKeyId']) # アクセスキーの最終利用を取得
                                logger.debug('access_key_last_used: {}'.format(access_key_last_used))

                                if access_key_last_used['AccessKeyLastUsed'].get('LastUsedDate'):
                                    if period >= access_key_last_used['AccessKeyLastUsed']['LastUsedDate'].date():
                                        check_result = appendList(check_result,user['UserName'],'[High] 過去 {} 日間利用していないアクセスキーが存在します。アクセスキー最終利用日: {}'.format(periodInDays, access_key_last_used['AccessKeyLastUsed']['LastUsedDate'].date()))
                                        logger.debug('AccessKeyId: {}, Status: {}, LastUsedDate:{}'.format(access_key['AccessKeyId'],access_key['Status'],access_key_last_used['AccessKeyLastUsed']['LastUsedDate']))
                                    else:
                                        # 利用している場合
                                        active_access_keys += 1
                                else:
                                    if period >= access_key['CreateDate'].date():
                                        check_result = appendList(check_result,user['UserName'],'[High] 一度も利用していないアクセスキーが存在します。過去 {} 日間利用していないため、無効化しました。アクセスキー作成日: {}'.format(periodInDays, access_key['CreateDate'].date()))
                                        response = iam.update_access_key(
                                            UserName=user['UserName'],
                                            AccessKeyId=access_key['AccessKeyId'],
                                            Status='Inactive'
                                        )
                                    else:
                                        check_result = appendList(check_result,user['UserName'],'[High] 一度も利用していないアクセスキーが存在します。アクセスキー作成日: {}'.format(access_key['CreateDate'].date()))
                            else: # Inactive
                                check_result = appendList(check_result,user['UserName'],'[Warn] 無効化済みのアクセスキーが１つ存在します。不要な場合は削除してください。アクセスキー作成日: {}'.format(access_key['CreateDate'].date()))

                        if active_access_keys > 0:
                            check_result = appendList(check_result,user['UserName'],'[Info] 利用している有効なアクセスキーを {} つ保持しています。'.format(active_access_keys))
                            # アクセスキーを使用していたら無効化しない
                            if isInvalid:
                                check_result = appendList(check_result,user['UserName'],'[Info] アクセスキー利用中のため権限無効化のグループに追加しません。無効化理由: {}'.format(reson))
                            isInvalid = False

                    if isInvalid:
                        # 無効化対象は最後にサービスのアクセスを確認する
                        service_response= iam.generate_service_last_accessed_details(Arn=user['Arn'],Granularity='SERVICE_LEVEL')
                        last_service_response = None
                        while True:
                            last_service_response = iam.get_service_last_accessed_details(JobId=service_response['JobId'])
                            if last_service_response.get('JobStatus') == 'COMPLETED':
                                break
                            time.sleep(1)
                        last_access_date = None
                        last_access_servicename = None
                        for s in last_service_response['ServicesLastAccessed']:
                            logger.debug('ServiceName: {}, LastAccessedTime: {}'.format(s['ServiceName'],s.get('LastAuthenticated')))
                            if 'LastAuthenticated' in s:
                                if not last_access_date or last_access_date < s['LastAuthenticated'].date():
                                    last_access_date = s['LastAuthenticated'].date()
                                    last_access_servicename = s['ServiceName']

                        if last_access_date and expireUserPeriod <= last_access_date:
                            # 期間内のサービス利用があった場合は、無効化しない
                            isInvalid = False
                            check_result = appendList(check_result,user['UserName'],'[Info] 最終利用サービス名: {} 最終利用日時: {}'.format(last_access_servicename, last_access_date))

                    if isInvalid and invalidGroupName:
                        logger.debug('Add Invalid Group: {}'.format(user['UserName']))
                        check_result = appendList(check_result,user['UserName'],'[Info] 権限無効のグループに追加しました。理由: {}'.format(reson))
                        # 無効化グループ追加
                        add_user_to_group_response = iam.add_user_to_group(GroupName=invalidGroupName, UserName=user['UserName'])
                        logger.debug('response: {}'.format(add_user_to_group_response))
                else:
                    check_result = appendList(check_result,user['UserName'],'[Info] すでに権限無効のグループに追加されています。')
            else:
                # 対象外ユーザー
                logger.debug('skip username: {}'.format(user['UserName']))
                check_result = appendList(check_result,user['UserName'],'[Info] チェック対象外ユーザーです。')

        logger.debug('result: {}'.format(check_result))
        message = "※ 本メールはシステムにより自動的に送信されています。" + \
                '\n' + '----------' + \
                '\n' + '一度もログインしていないユーザーや一定期間ログインしていないユーザーを確認してください。' + \
                '\n' + 'アクセスキーを発行しているユーザーについては、IAM ロールと一時的なセキュリティ認証情報を使用するなど、アクセスキーを利用しない方法を検討してください。' + \
                '\n' + 'アクセスキーが漏洩した場合、AWS 環境の不正利用に繋がりますので、必要かどうか確認してください。' + \
                '\n' + '----------' + \
                '\n' + 'AWS アカウント ID: {}'.format(accountId) + \
                '\n' + 'プロジェクト名: {}'.format(PROJECT_NAME) +\
                '\n' + '環境名: {}'.format(ENV_NAME) + \
                '\n'

        if not check_result:
            message += '\n' + 'チェック対象となるユーザーは存在しませんでした。'

        for user in check_result:
            message += '\n' + user
            for error in check_result[user]:
                message += '\n\t' + error
        subject = '[{}-{}][AWS アカウント ID: {}] IAM ユーザーレポート'.format(PROJECT_NAME,ENV_NAME,accountId)
        logger.info('subject: {}'.format(subject))
        logger.info('message: {}'.format(message))
        client = boto3.client('sns')
        if topicarn:
            client.publish(
                TopicArn = topicarn, # 転送先SNSトピック
                Message = message,
                Subject = subject
            )

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

def get_today() -> str:
    return date.today().isoformat()

def isPasswordEnabled(user, iam) -> bool:
    try:
        login_profile = iam.get_login_profile(UserName=user)
        return True
    except:
        return False


def appendList(dict, key, value) -> dict:
    if not dict.get(key): 
        dict[key] = []

    dict[key].append(value)

    return dict
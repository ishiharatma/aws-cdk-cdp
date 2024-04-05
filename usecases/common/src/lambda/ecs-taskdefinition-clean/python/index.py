from datetime import datetime
from logging import getLogger, INFO, DEBUG
import json
import os
import boto3
from itertools import groupby

logger = getLogger()
logger.setLevel(INFO)
sns = boto3.client('sns')

def get_task_definitions(familyPrefix) -> list:
    list_task_definitions = []
    try:
        client = boto3.client('ecs')
        next_token = ''
        while True:
            if next_token == '':
                response = client.list_task_definitions(
                            familyPrefix=familyPrefix,
                            status='ACTIVE',
                            sort='DESC')
            else:
                response = client.list_task_definitions(
                            familyPrefix=familyPrefix,
                            status='ACTIVE',
                            sort='DESC',
                            nextToken=next_token)
            logger.debug('list_task_definitions: {}'.format(response))
            list_task_definitions.extend(response['taskDefinitionArns'])
            if 'nextToken' in response:
                next_token = response['nextToken']
            else:
                break

    except Exception as e:
        logger.exception(str(e))

    return list_task_definitions

def groupby_task_definitions(list_task_definitions) -> dict:

    result_dict = {}
    try:
        group_list = []
        for task_definition in list_task_definitions:
            logger.debug('task_definition: {}'.format(task_definition))
 
            # タスク名とrevisionを分解する
            # arn:aws:ecs:ap-northeast-1:<account Id>:task-definition/<task-name>:<revision>
            task_definitionArn = task_definition
            logger.debug('task_definitionArn: {}'.format(task_definitionArn))
            task_definition = task_definition.rsplit('/', 1)[1]
            task_name, revision = task_definition.split(':')

            # タプルとしてリストに追加する
            group_list.append((task_name, revision))

        logger.debug('group_list: {}'.format(group_list))
        result_dict = {}
        for key, group in groupby(group_list, lambda x: x[0]):
            revision_list = []
            for _, v in group:
                revision_list.append(v)
            result_dict[key] = revision_list
    except Exception as e:
        logger.exception(str(e))

    return result_dict

def existing_imageurl(task_definition, containerName) -> bool:
    client = boto3.client('ecs')
    response = client.describe_task_definition(
                   taskDefinition=task_definition
               )
    logger.debug('client.describe_task_definition response: {}'.format(response))
    taskDefinition = response['taskDefinition']
    image = ''
    for container in taskDefinition['containerDefinitions']:
        if container['name'] == containerName:
            # <account Id>.dkr.ecr.ap-northeast-1.amazonaws.com/<reposigoryName>:<tag>
            image = container['image']
            logger.debug('image: {}'.format(image))
            break

    existing = False

    if image:
        ecrclient = boto3.client('ecr')
        # リポジトリ名とタグを分解する。リポジトリ名に"/"が入っているので、分割回数を1に指定
        # 最終的に、":"で分解する
        repositoryName, tag = image.split('/', 1)[-1].split(':')
        logger.debug('repositoryName:{}'.format(repositoryName))
        logger.debug('tag:{}'.format(tag))
        try:
            response_images = ecrclient.describe_images(
                repositoryName= repositoryName,
                imageIds=[
                    {
                        'imageTag': tag,
                    }
                ]
            )
            logger.debug('ecrclient.describe_images response: {}'.format(response_images))
        except ecrclient.exceptions.ImageNotFoundException as e:
            # 見つからない場合は例外が発生する
            existing = False
        else:
            existing = True

    return existing

def deregister_task_definition(taskDefinition) -> bool:
    ret = False
    try:
        client = boto3.client('ecs')
        response = client.deregister_task_definition(taskDefinition=taskDefinition)
        logger.debug('deregister_task_definition response: {}'.format(response))
        ret = True
    except Exception as e:
        # エラー通知が頻発するので、呼び出し元で logger.exception を実行する
        logger.warning('{} の削除でエラーが発生しました。:{}'.format(taskDefinition,str(e)), exc_info=True)

    return ret

def putSns(topicArn, title, message):
    try:
        logger.debug('### putSns start.')
        logger.debug('### title {}'.format(title))
        logger.debug('### message {}'.format(message))
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

def lambda_handler(event, context)-> None:
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)
        topicArn=os.environ.get('TOPIC_ARN')

        PJName=os.getenv('PROJECT_NAME')
        EnvName=os.getenv('ENV_NAME')
        # arn:aws:ecs:ap-northeast-1:<account Id>:task-definition/<task-name>:<revision>
        taskDefArn = os.getenv('TASK_DEF_ARN')
        familyPrefix = taskDefArn.split('/')[1].split(':')[0]
        containerName = os.getenv('CONTAINER_NAME')
        logger.info('familyPrefix: {}'.format(familyPrefix))
        logger.info('containerName: {}'.format(containerName))
        accountId = context.invoked_function_arn.split(':')[4]

        if not familyPrefix or not containerName:
            raise Exception('familyPrefix or containerName does not specified.')

        taskdefs = groupby_task_definitions(get_task_definitions(familyPrefix))

        logger.debug(taskdefs)
        deletedText = ''
        deletionCountsdeletionFailed = 0
        deletionCountsSucceeded = 0
        deletions = 0
        for name, revision_list in taskdefs.items():
            logger.debug(name)
            for revision in revision_list:
                taskDefinition='{}:{}'.format(name, revision)
                logger.debug('taskDefinition: {}'.format(taskDefinition))
                if not existing_imageurl(taskDefinition,containerName):
                    logger.debug('deletion : {}'.format(taskDefinition))
                    deletions+=1
                    if deregister_task_definition(taskDefinition):
                        deletionCountsSucceeded+=1
                        deletedText += '\n' + taskDefinition
                    else: 
                        deletionCountsdeletionFailed+=1

        if deletionCountsdeletionFailed > 0:
            # 個々の削除でERRORログを発生させるとエラー通知が頻発するので、
            # deregister_task_definition では WARNING でログ出力として、ここでログ出力
            logger.exception('タスク定義（{}）の削除でエラーが発生しました。詳細は直前の WARNING を確認してください。'.format(familyPrefix))

        title = f"[{PJName}-{EnvName}]ECS Task Definition Clean | {containerName} | Account:{accountId}"
        message = '※ 本メールはシステムにより自動的に送信されています。'
        message += '\n\n' + \
                    '\n' + 'コンテナイメージが存在しないタスク定義を削除します。' + \
                    '\n' + '削除に失敗したタスク定義がある場合はログを確認してください。' + \
                    '\n' + '----------' + \
                    '\n' + 'AWS アカウント ID: {}'.format(accountId) + \
                    '\n' + 'プロジェクト名: {}'.format(PJName) +\
                    '\n' + '環境名: {}'.format(EnvName) +\
                    '\n' + 'タスク定義: {}'.format(familyPrefix) +\
                    '\n' + '----------' +\
                    '\n' + '削除に成功したタスク定義数: {}'.format(deletionCountsSucceeded) +\
                    '\n' + '削除に失敗したタスク定義数: {}'.format(deletionCountsdeletionFailed) + ('  (削除に失敗しています。要ログ確認)' if deletionCountsdeletionFailed>0 else '') +\
                    '\n' + '----------'+\
                    '\n' + '<削除したタスク定義一覧>'

        if deletedText:
            message += '\n\n' + deletedText
        else:
            message += '\n\n' + '削除したタスク定義はありません。'

        putSns(topicArn, title,message)

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
import json
import urllib.parse
import os
import tempfile
import shutil
import boto3
from logging import getLogger, INFO, DEBUG

logger = getLogger()

import datetime
import subprocess
now = datetime.datetime.now()
now = now.strftime("%Y%m%d%H%M%S")

import base64
import requests

from dulwich import porcelain
from dulwich.client import get_transport_and_path, HttpGitClient
import dulwich.config
from dulwich.errors import NotGitRepository

BUCKET_NAME = os.environ.get('BUCKET_NAME','')
ZIP_FILE_NAME = os.environ.get('ZIP_FILE_NAME','')
SECRETS_ARN = os.environ.get('SECRETS_ARN','')
#USER = os.environ.get('USER','')
#PASS = os.environ.get('PASS','')
REPOSITORY = os.environ.get('REPOSITORY','')
BRANCH = os.environ.get('BRANCH','')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN','')
PIPELINE_NAME = os.environ.get('PIPELINE_NAME','')  # パイプライン名を環境変数から取得

def setup_logging():
    log_level_str = os.environ.get('LOG_LEVEL', 'INFO').upper()
    log_level = getattr(logger, log_level_str, logging.INFO)
    logger.setLevel(log_level)
    logger.info(f"Log level set to {log_level_str}")

def send_sns_notification(sns_topic_arn, message):
    """Sends a notification to the specified SNS topic"""
    sns_client = boto3.client('sns')
    sns_client.publish(
        TopicArn=sns_topic_arn,
        Message=message
    )

def make_zipfile(file_path, target_dir):
    logger.info(f'Creating zip file at: {file_path}')
    shutil.make_archive(file_path, 'zip', target_dir)
    zip_file = f"{file_path}.zip"
    logger.info(f'Zip file created: {zip_file}')
    if not os.path.exists(zip_file):
        raise FileNotFoundError(f"ZIP file was not created: {zip_file}")
    return zip_file

def upload_to_s3(bucket_name, file_name, file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
    logger.info(f'Uploading file: {file_path} to {bucket_name}/{file_name}')
    s3 = boto3.resource('s3')
    bucket = s3.Bucket(bucket_name)
    bucket.upload_file(file_path, file_name)

def clone_repository(url, target_path, branch):
    try:
        # URLの解析とGit URLの構築
        site = urllib.parse.urlparse(url)
        userInfo = get_secret(SECRETS_ARN)
        USER = userInfo["user"]
        PASS = userInfo["pass"]
        userStr = urllib.parse.quote(USER)
        passStr = urllib.parse.quote(PASS)
        
        # .gitの追加判定
        path = site.path if site.path.endswith('.git') else site.path + '.git'
        
        # 認証情報を含むURLの構築
        auth_url = f"{site.scheme}://{userStr}:{passStr}@{site.netloc}{path}"
        
        logger.info('Git clone starting...')
        logger.info(f'Target branch: {branch}')
        # 認証情報を含むURLはログに出力しない
        
        # クローン実行
        porcelain.clone(auth_url, target_path, branch=branch)
        logger.info('Git clone completed successfully')
        
    except Exception as e:
        logger.error(f'Clone failed: {str(e)}')
        raise

# get secrets manager
# {"user": "user", "pass": "pass"}
def get_secret(secret_name):
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager'
    )
    try:
        response = client.get_secret_value(
            SecretId=secret_name
        )
        secret = json.loads(response['SecretString'])
        return secret
    except Exception as e:
        logger.error(f'Failed to retrieve secret: {str(e)}')
        raise

def start_pipeline_with_variables(pipeline_name, repository_name, branch_name, commit_id):
    """
    CodePipelineを環境変数を渡して開始する
    
    Parameters:
    pipeline_name (str): 開始するパイプラインの名前
    repository_name (str): リポジトリ名
    branch_name (str): ブランチ名
    commit_id (str): 最新のコミットID
    
    Returns:
    str: パイプラインの実行ID
    """
    if not pipeline_name:
        logger.warning("Pipeline name not provided, skipping pipeline execution")
        return None
        
    logger.info(f'Starting CodePipeline: {pipeline_name}')
    logger.info(f'With variables - Repository: {repository_name}, Branch: {branch_name}, Commit: {commit_id}')
    
    codepipeline = boto3.client('codepipeline')
    # パイプラインに渡す変数を準備
    variables = [
        {
            'name': 'REPOSITORY_NAME',
            'value': repository_name
        },
        {
            'name': 'BRANCH_NAME',
            'value': branch_name
        },
        {
            'name': 'COMMIT_ID',
            'value': commit_id
        }
    ]

    try:
        # 変数を含めてパイプラインを開始
        response = codepipeline.start_pipeline_execution(
            name=pipeline_name,
            variables=variables
        )
        pipeline_execution_id = response.get('pipelineExecutionId')
        logger.info(f'Pipeline started with execution ID: {pipeline_execution_id}')
        return pipeline_execution_id
    except Exception as e:
        # 変数サポートがない場合、通常モードで実行を試みる
        logger.warning(f"Failed to start pipeline with variables: {str(e)}")
        logger.info("Attempting to start pipeline without variables")
        response = codepipeline.start_pipeline_execution(
            name=pipeline_name
        )
        pipeline_execution_id = response.get('pipelineExecutionId')
        logger.info(f'Pipeline started with execution ID: {pipeline_execution_id}')
        return pipeline_execution_id

def lambda_handler(event, context):
    setup_logging()
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)
        logger.info('BUCKET_NAME: {}'.format(BUCKET_NAME))
        logger.info('ZIP_FILE_NAME: {}'.format(ZIP_FILE_NAME))
        logger.info('REPOSITORY: {}'.format(REPOSITORY))
        logger.info('BRANCH: {}'.format(BRANCH))
        logger.info('PIPELINE_NAME: {}'.format(PIPELINE_NAME))

        # x-www-form-urlencoded形式のペイロードをデコード
        payloadStr = urllib.parse.unquote(event["body"][8:]) # event["body"]  payload="xxxxxx"
        payload = json.loads(payloadStr)

        # リポジトリ情報の取得
        repository_name = payload["repository"]["name"]
        url = payload["repository"]["url"]
        ref = payload["ref"]
        branch_name = ref.split('/')[-1]  # refs/heads/masterからmasterを抽出
        # 最新のコミットIDを取得
        commits = payload.get("commits", [])
        latest_commit_id = payload.get("after")  # afterフィールドからコミットIDを取得
       
        # コミット配列が空でなければ最新のコミットIDを取得
        if commits and not latest_commit_id:
            latest_commit_id = commits[-1].get("id")

        logger.info('repository: {}'.format(repository_name))
        logger.info('url: {}'.format(url))
        logger.info('branch: {}'.format(branch_name))
        logger.info('latest commit id: {}'.format(latest_commit_id))

        # コミット情報のログ出力
        if commits:
            commit = commits[-1]  # 最新のコミット
            logger.info(f'Commit message: {commit.get("message")}')
            logger.info(f'Modified files: {commit.get("modified", [])}')
            logger.info(f'Author: {commit.get("author", {}).get("name")}')

        # コミット情報のログ出力
        revisions = payload.get("revisions", [])
        if revisions:
            commit = revisions[0]
            logger.info(f'Commit message: {commit.get("message")}')
            logger.info(f'Modified files: {commit.get("modified", [])}')
            logger.info(f'Author: {commit.get("author", {}).get("name")}')

        # リポジトリとブランチの検証
        isDeploy = repository_name == REPOSITORY and branch_name == BRANCH
        if not isDeploy:
            logger.info('repository or branch is not match. repository: {}, branch: {}'.format(repository_name, branch_name))
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Repository or branch does not match',
                    'expected': f'{REPOSITORY}/{BRANCH}',
                    'received': f'{repository_name}/{branch_name}'
                })
            }

        # 環境変数の検証
        required_vars = ['BUCKET_NAME', 'ZIP_FILE_NAME', 'USER', 'PASS', 'REPOSITORY', 'BRANCH']
        missing_vars = [var for var in required_vars if not os.environ.get(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        # 一時ディレクトリの作成と作業
        with tempfile.TemporaryDirectory(prefix=now, dir="/tmp") as tmpdir:
            target_dir = os.path.join(tmpdir, repository_name)
            logger.info(f'Working directory: {target_dir}')

            clone_repository(url, target_dir, branch_name)

            # ZIPファイル作成
            zip_base_path = os.path.join(tmpdir, ZIP_FILE_NAME)
            logger.info('zip start')
            zip_file_path = make_zipfile(zip_base_path, target_dir)
            logger.info(f'ZIP file created at: {zip_file_path}')

            # S3アップロード
            s3_file_name = f"{ZIP_FILE_NAME}.zip"
            logger.info('upload to s3 start')
            upload_to_s3(BUCKET_NAME, s3_file_name, zip_file_path)
            logger.info('upload to s3 end')
        
        if PIPELINE_NAME:
            # CodePipelineを開始
            logger.info('Starting CodePipeline')
            pipeline_execution_id = start_pipeline_with_variables(
                PIPELINE_NAME, 
                repository_name, 
                branch_name, 
                latest_commit_id
            )
            logger.info(f'Pipeline started: {pipeline_execution_id}')

        # Send SNS notification if specified
        if SNS_TOPIC_ARN:
            message = {
                'message': 'Success',
                'repository': repository_name,
                'branch': branch_name,
                'commit_id': payload.get('after'),
                'timestamp': now
            }
            send_sns_notification(SNS_TOPIC_ARN, message)

        logger.info('complete')

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Success',
                'repository': repository_name,
                'branch': branch_name,
                'commit_id': payload.get('after'),
                'timestamp': now
            })
        }
    except Exception as e:
        logger.exception(str(e))
        if SNS_TOPIC_ARN:
            message = {
                'error': str(e),
                'timestamp': datetime.datetime.now().isoformat()
            }
            send_sns_notification(SNS_TOPIC_ARN, message)
        return {
                'statusCode': 500,
                'body': json.dumps({
                    'error': str(e),
                    'timestamp': datetime.datetime.now().isoformat()
                })
        }
    finally:
      logger.info('complete.')

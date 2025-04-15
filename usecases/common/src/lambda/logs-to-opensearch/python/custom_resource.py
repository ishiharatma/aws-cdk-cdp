import json
import logging
import os
import boto3
import cfnresponse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    CloudWatch Logsの送信先としてOpenSearch Serverlessを設定するカスタムリソースハンドラー
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    # CloudFormationイベントのタイプを取得
    request_type = event['RequestType']
    
    # プロパティの取得
    properties = event.get('ResourceProperties', {})
    destination_name = properties.get('DestinationName')
    role_arn = properties.get('RoleArn')
    collection_endpoint = properties.get('CollectionEndpoint')
    
    # レスポンスデータの初期化
    response_data = {}
    physical_id = f"LogDestination-{destination_name}"
    
    try:
        logs_client = boto3.client('logs')
        
        if request_type == 'Create' or request_type == 'Update':
            logger.info(f"Creating/Updating log destination: {destination_name}")
            
            # 送信先の作成またはアップデート
            response = logs_client.put_destination(
                destinationName=destination_name,
                targetArn=f"arn:aws:lambda:{os.environ.get('AWS_REGION')}:{os.environ.get('AWS_ACCOUNT_ID')}:function:LogToOpenSearch",
                roleArn=role_arn,
                tags=[
                    {
                        'key': 'ManagedBy',
                        'value': 'CDK'
                    }
                ]
            )
            
            logger.info(f"Created/Updated destination: {response}")
            
            # 送信先のアクセスポリシーを設定
            logs_client.put_destination_policy(
                destinationName=destination_name,
                accessPolicy=json.dumps({
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": f"arn:aws:iam::{os.environ.get('AWS_ACCOUNT_ID')}:root"},
                            "Action": "logs:PutSubscriptionFilter",
                            "Resource": response['destination']['arn']
                        }
                    ]
                })
            )
            
            response_data['DestinationArn'] = response['destination']['arn']
            response_data['CollectionEndpoint'] = collection_endpoint
            
        elif request_type == 'Delete':
            logger.info(f"Deleting log destination: {destination_name}")
            try:
                # 送信先の削除
                logs_client.delete_destination(
                    destinationName=destination_name
                )
                logger.info(f"Deleted destination: {destination_name}")
            except logs_client.exceptions.ResourceNotFoundException:
                logger.info(f"Destination {destination_name} not found, skipping delete")
        
        # 成功レスポンスを送信
        cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data, physical_id)
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        # 失敗レスポンスを送信
        cfnresponse.send(event, context, cfnresponse.FAILED, {"Error": str(e)}, physical_id)
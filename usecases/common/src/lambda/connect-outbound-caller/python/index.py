import json
import boto3
import os
import time
import logging
from datetime import datetime, timedelta
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 環境変数
CALL_STATUS_TABLE = os.environ.get('CALL_STATUS_TABLE', 'CallStatus')
IN_PROGRESS_TABLE = os.environ.get('IN_PROGRESS_TABLE', 'InProgress')
RESPONDERS_TABLE = os.environ.get('RESPONDERS_TABLE', 'Responders')
CALL_HISTORY_TABLE = os.environ.get('CALL_HISTORY_TABLE', 'CallHistory')
CONNECT_INSTANCE_REGION_NAME = os.environ.get('CONNECT_INSTANCE_REGION_NAME', "")
CONNECT_INSTANCE_ID = os.environ.get('CONNECT_INSTANCE_ID')
CONNECT_CONTACT_FLOW_ID = os.environ.get('CONNECT_CONTACT_FLOW_ID')
CONNECT_SOURCE_PHONE = os.environ.get('CALLER_PHONE_NUMBER')
RESPONDERS_GROUP_ID = os.environ.get('RESPONDERS_GROUP_ID', 'default')
HISTORY_TTL_DAYS = os.environ.get('HISTORY_TTL_DAYS', 30)

dynamodb = boto3.resource('dynamodb')
connect = boto3.client("connect", region_name=CONNECT_INSTANCE_REGION_NAME)

def mask_phone_number(phone_number):
    # 電話番号から特殊文字を取り除く
    clean_number = ''.join(c for c in phone_number if c.isdigit() or c == '+')
    
    # 下4桁を取得
    last_four_digits = clean_number[-4:]
    
    # 下4桁以外を「*」に置き換える
    masked_length = len(clean_number) - 4
    masked_number = '*' * masked_length + last_four_digits
    
    return masked_number

def get_call_status():
    """架電状況テーブルから現在のステータスを取得"""
    try:
        table = dynamodb.Table(CALL_STATUS_TABLE)
        response = table.get_item(
            Key={
                'statusId': 'current'
            }
        )
        return response.get('Item')
    except ClientError as e:
        logger.error('Error getting call status: %s', str(e))
        raise

def get_in_progress_errors():
    """対応中テーブルからエラー一覧を取得"""
    try:
        table = dynamodb.Table(IN_PROGRESS_TABLE)
        response = table.scan()
        return response.get('Items', [])
    except ClientError as e:
        logger.error(f"Error getting in-progress errors: {str(e)}")
        raise

def add_to_in_progress(error_id, timestamp, description, responder_id):
    """対応中テーブルにエラーを登録"""
    try:
        table = dynamodb.Table(IN_PROGRESS_TABLE)
        table.put_item(
            Item={
                'errorId': error_id,
                'timestamp': timestamp,
                'description': description,
                'assignedTo': responder_id
            }
        )
    except ClientError as e:
        logger.error(f"Error adding to in-progress: {str(e)}")
        raise

def update_call_status(status, error_id=None):
    """架電状況テーブルを更新"""
    try:
        table = dynamodb.Table(CALL_STATUS_TABLE)
        update_expression = "SET #status = :status, #timestamp = :timestamp"
        expression_attribute_names = {
            '#status': 'status',
            '#timestamp': 'timestamp'
        }
        expression_attribute_values = {
            ':status': status,
            ':timestamp': int(time.time() * 1000)  # ミリ秒単位のタイムスタンプ
        }
        
        if error_id:
            update_expression += ", #errorId = :errorId"
            expression_attribute_names['#errorId'] = 'errorId'
            expression_attribute_values[':errorId'] = error_id
        
        table.update_item(
            Key={
                'statusId': 'current'
            },
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values
        )
    except ClientError as e:
        logger.error(f"Error updating call status: {str(e)}")
        raise

def get_responders_by_group(group_id):
    """特定のグループに所属する担当者リストを取得（優先順位順）"""
    try:
        table = dynamodb.Table(RESPONDERS_TABLE)
        response = table.query(
            KeyConditionExpression="groupId = :groupId",
            FilterExpression="active = :active",
            ExpressionAttributeValues={
                ':groupId': group_id,
                ':active': True
            }
        )
        
        items = response.get('Items', [])
        
        # 担当者が見つからない場合は空のリストを返す
        if not items:
            logger.warning(f'No active responders found in group: {group_id}')
            return []

        return items
    except ClientError as e:
        logger.error(f"Error getting responders for group {group_id}: {str(e)}")
        raise


def initiate_call(responders, error_id, error_message):
    """Amazon Connectで架電を開始し、応答を確認"""
    if not responders:
        return {
            'status': "failed",
            'reason': "no_responders"
        }
    
    assigned = False
    contact_attempts = []
    
    for responder in responders:
        try:
            logger.info('Attempting to call responder: {} at {}'.format(responder['name'], mask_phone_number(responder['phoneNumber'])))

            # コール状態の初期値
            call_status = "unanswered"
            
            # Amazon Connect API を使って架電
            connect_response = connect.start_outbound_voice_contact(
                InstanceId=CONNECT_INSTANCE_ID,
                ContactFlowId=CONNECT_CONTACT_FLOW_ID,
                DestinationPhoneNumber=responder['phoneNumber'],
                SourcePhoneNumber=CONNECT_SOURCE_PHONE,
                Attributes={
                    'errorId': error_id,
                    'errorMessage': error_message,
                    'responderId': responder['responderId'],
                    'responderName': responder.get('name', 'Unknown'),
                    'callStatus': call_status  # コンタクトフローで更新される属性
                }
            )
            
            contact_id = connect_response['ContactId']
            logger.info(f"Contact initiated with ID: {contact_id}")
            
            # 応答を待機（20秒）
            logger.debug(f"Waiting for response...")
            time.sleep(20)
            
            # コンタクト属性を取得して応答状態を確認
            try:
                attributes_response = connect.get_contact_attributes(
                    InstanceId=CONNECT_INSTANCE_ID,
                    InitialContactId=contact_id
                )
                attributes = attributes_response.get('Attributes', {})
                call_status = attributes.get('callStatus', 'unanswered')
                logger.info(f"[get_contact_attributes]Call status for {responder['responderId']}: {call_status}")

                # コンタクトの詳細情報を取得
                contact_details = connect.describe_contact(
                    InstanceId=CONNECT_INSTANCE_ID,
                    ContactId=contact_id
                )
                # コンタクトの状態を確認
                contact_state = contact_details.get('Contact', {}).get('State')
                logger.info(f"[describe_contact]Call status for {responder['responderId']}: {contact_state}")
                if contact_state in ['DISCONNECTED', 'ENDED']:
                    # 通話が切断されていて、応答情報がない場合は「電話に出なかった」と判定
                    call_status = 'no_answer'

                # この試行の結果を記録
                attempt_result = {
                    'responderId': responder['responderId'],
                    'contactId': contact_id,
                    'status': call_status
                }
                contact_attempts.append(attempt_result)
                
                # 応答があった場合は処理を終了
                if call_status == "answered_accepted":
                    logger.debug(f"Call answered by: {responder['responderId']}")
                    assigned = True
                    return {
                        'status': "answered_accepted",
                        'responderId': responder['responderId'],
                        'contactId': contact_id,
                        'attempts': contact_attempts
                    }
                elif call_status == "answered_declined":
                    logger.debug(f"Call answered but declined by: {responder['responderId']}")
                    # 次の担当者に進む
                    contact_attempts.append({
                        'responderId': responder['responderId'],
                        'contactId': contact_id,
                        'status': 'answered_declined'
                    })
                elif call_status == "no_answer":
                    logger.debug(f"No answer from: {responder['responderId']}")
                    # 次の担当者に進む
                    contact_attempts.append({
                        'responderId': responder['responderId'],
                        'contactId': contact_id,
                        'status': 'no_answer'
                    })
            except Exception as attr_error:
                logger.debug(f"Error getting contact attributes: {str(attr_error)}")
                # 属性取得エラーの場合も次の担当者に進む
                contact_attempts.append({
                    'responderId': responder['responderId'],
                    'contactId': contact_id,
                    'status': 'error',
                    'error': str(attr_error)
                })
                
        except Exception as e:
            logger.error(f"Error calling responder {responder['responderId']}: {str(e)}")
            contact_attempts.append({
                'responderId': responder['responderId'],
                'status': 'error',
                'error': str(e)
            })
    
    # すべての担当者に連絡できなかった場合
    if not assigned:
        logger.error(f"Failed to reach any responders after {len(contact_attempts)} attempts")
        return {
            'status': "failed",
            'reason': "all_responders_unavailable",
            'attempts': contact_attempts
        }
    
    # 正常に終了（ここには通常到達しない）
    return {
        'status': "complete",
        'attempts': contact_attempts
    }

def record_history(error_id, timestamp, status, description, result=None):
    """履歴テーブルに記録（TTL付き）"""
    try:
        # TTLの設定 - デフォルトで30日後に削除
        ttl_days = int(HISTORY_TTL_DAYS)
        expiration_time = int(time.time()) + (86400 * ttl_days)  # 現在のUNIXタイムスタンプ（秒）+ TTL日数×86400秒
        
        item = {
            'errorId': error_id,
            'timestamp': timestamp,
            'status': status,
            'description': description,
            'expirationTime': expiration_time  # TTL属性
        }
        
        if result:
            # PythonオブジェクトをJSON文字列に変換
            if isinstance(result, dict):
                item['result'] = json.dumps(result)
                if 'responderId' in result:
                    item['responderId'] = result['responderId']
        
        table = dynamodb.Table(CALL_HISTORY_TABLE)
        table.put_item(Item=item)
    except ClientError as e:
        print(f"Error recording history: {str(e)}")
        raise

def get_timestamp():
    return int(time.time() * 1000)

def lambda_handler(event, context):
    # コンタクトフローを指定して電話を掛ける
    logLevel = os.environ.get('LOG_LEVEL', 'INFO')
    logger.setLevel(logLevel)
    assined = False
    try:
        logger.info('Received event: {}'.format(json.dumps(event)))

        # SNSメッセージを取得
        sns_message = event["Records"][0]["Sns"]
        topic_arn = sns_message["TopicArn"]
        MessageId = sns_message["MessageId"]
        subject = sns_message["Subject"]
        type = sns_message["Type"]
        message = sns_message["Message"]
        messageAttributes = sns_message["MessageAttributes"]

        logger.debug('SNS message: {}'.format(json.dumps(sns_message)))
        logger.debug('topic_arn: {}'.format(topic_arn))
        logger.debug('subject: {}'.format(subject))
        logger.debug('type: {}'.format(type))
        logger.debug('message: {}'.format(json.dumps(message)))
        logger.debug('MessageId: {}'.format(MessageId))
        logger.debug('messageAttributes: {}'.format(json.dumps(messageAttributes)))

        error_id  = str(time.time()).replace('.', '')
        error_message = message
        # 架電状況テーブルを取得
        call_status = get_call_status()
        # 架電中の場合は履歴に記録して終了
        if call_status and call_status.get('status') == "calling":
            print('Call already in progress, skipping this error notification')
            record_history(error_id, get_timestamp(), "skipped_calling", error_message)
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'status': "skipped",
                    'reason': "calling_in_progress",
                    'currentErrorId': call_status.get('errorId')
                })
            }

        # 対応状況テーブルを取得
        in_progress = get_in_progress_errors()
        if in_progress and len(in_progress) > 0:
            logger.warning('Errors already being handled, skipping this error notification')
            record_history(error_id, get_timestamp(), "skipped_inprogress", error_message)
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'status': "skipped",
                    'reason': "error_in_progress",
                    'inProgressErrors': [e.get('errorId') for e in in_progress]
                })
            }
        # 架電状況を「架電中」に設定
        update_call_status("calling", error_id)

        # 担当者リストを取得（優先順位順）
        responders = get_responders_by_group(RESPONDERS_GROUP_ID)
        # Amazon Connectで架電処理
        call_result = initiate_call(responders, error_id, error_message)

        # 履歴テーブルに記録
        record_history(error_id, get_timestamp(), "called", error_message, call_result)
        # 担当者が応答した場合は対応中テーブルに登録
        if call_result.get('status') == "answered_accepted":
            add_to_in_progress(error_id, get_timestamp(), error_message, call_result.get('responderId'))
            logger.debug(f"Error assigned to responder: {call_result.get('responderId')}")
        else:
            logger.warning(f"No responder answered the call. Status: {call_result.get('status')}")
        # 架電状況をクリア
        update_call_status("idle")
        return {
            'statusCode': 200,
            'body': json.dumps('Hello from Lambda!')
        }
    except Exception as error:
        logger.error("Amazon Connectへの連係に失敗")
        logger.error(error)
        return {'statusCode': 400 }
    finally:
        logger.info('Function complete')


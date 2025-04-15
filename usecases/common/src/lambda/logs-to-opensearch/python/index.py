import base64
import gzip
import json
import os
import boto3
from datetime import datetime
from opensearchpy import OpenSearch, RequestsHttpConnection
from aws_requests_auth.aws_auth import AWSRequestsAuth

# 環境変数から設定を取得
OPENSEARCH_ENDPOINT = os.environ.get('OPENSEARCH_COLLECTION_ENDPOINT', '')
REGION = os.environ.get('AWS_REGION', 'ap-northeast-1')
SERVICE = 'aoss'  # OpenSearch Serverlessのサービス名

def create_opensearch_client():
    """OpenSearch Serverlessクライアントの作成"""
    # AWS SigV4認証を使用
    auth = AWSRequestsAuth(
        aws_access_key=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
        aws_token=os.environ.get('AWS_SESSION_TOKEN'),
        aws_host=OPENSEARCH_ENDPOINT,
        aws_region=REGION,
        aws_service=SERVICE
    )
    
    # OpenSearchクライアントの作成
    client = OpenSearch(
        hosts=[{'host': OPENSEARCH_ENDPOINT, 'port': 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=30
    )
    return client

def process_log_event(log_event):
    """ログイベントをOpenSearch用に処理する"""
    # タイムスタンプをISO形式に変換
    timestamp = datetime.fromtimestamp(log_event['timestamp'] / 1000.0).isoformat()
    
    # 基本的なログ情報
    log_entry = {
        '@timestamp': timestamp,
        'message': log_event.get('message', ''),
        'id': log_event.get('id', ''),
    }
    
    # JSONデータとしてパースを試みる
    try:
        message_json = json.loads(log_event.get('message', '{}'))
        if isinstance(message_json, dict):
            for key, value in message_json.items():
                if key != 'timestamp':  # 重複を避ける
                    log_entry[key] = value
    except (json.JSONDecodeError, TypeError):
        # JSON形式でない場合は全体をメッセージとして扱う
        pass
    
    return log_entry

def handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
    if not OPENSEARCH_ENDPOINT:
        raise ValueError("OPENSEARCH_COLLECTION_ENDPOINT environment variable is not set")
    
    try:
        # OpenSearchクライアントの作成
        client = create_opensearch_client()
        
        # CloudWatch Logsからのイベントを処理
        # base64エンコードおよびgzip圧縮されたデータを解凍
        decoded_data = base64.b64decode(event['awslogs']['data'])
        decompressed_data = gzip.decompress(decoded_data)
        log_data = json.loads(decompressed_data)
        
        log_group = log_data.get('logGroup', 'unknown')
        log_stream = log_data.get('logStream', 'unknown')
        
        # インデックス名を日付ベースで作成（YYYY.MM.DD形式）
        today = datetime.now().strftime("%Y.%m.%d")
        index_name = f"cwl-{log_group.replace('/', '-')}-{today}"
        
        # ログイベントの処理とOpenSearchへの送信
        for log_event in log_data.get('logEvents', []):
            document = process_log_event(log_event)
            
            # ログイベントのソース情報を追加
            document['log_group'] = log_group
            document['log_stream'] = log_stream
            document['aws_account_id'] = log_data.get('owner', 'unknown')
            
            # OpenSearchにドキュメントをインデックス化
            response = client.index(
                index=index_name.lower(),  # OpenSearchはインデックス名が小文字である必要がある
                body=document,
                id=log_event.get('id')
            )
            print(f"Document indexed with result: {response['result']}")
        
        return {
            'statusCode': 200,
            'body': f"Successfully processed {len(log_data.get('logEvents', []))} log events"
        }
        
    except Exception as e:
        print(f"Error processing logs: {str(e)}")
        # すべての例外情報をログに出力
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': f"Error processing logs: {str(e)}"
        }
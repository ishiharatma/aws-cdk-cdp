import base64
from urllib.parse import parse_qs, urlencode
from logging import getLogger, INFO, DEBUG

logger = getLogger()
logger.setLevel(INFO)

def lambda_handler(event, context):

    request = event['Records'][0]['cf']['request']
    
    # WAF通過後に、POSTのリクエストボディを加工
    if request['method'] == 'POST':
        logger.info('event: {}'.format(event))

        '''
        Request body is being replaced. To do this, update the following
        three fields:
            1) body.action to 'replace'
            2) body.encoding to the encoding of the new data.
        
            Set to one of the following values:
        
                text - denotes that the generated body is in text format.
                    Lambda@Edge will propagate this as is.
                base64 - denotes that the generated body is base64 encoded.
                    Lambda@Edge will base64 decode the data before sending
                    it to the origin.
            3) body.data to the new body.
        '''
        request['body']['action'] = 'replace'
        request['body']['encoding'] = 'text'
        request['body']['data'] = getUpdatedBody(request)
    return request

def getUpdatedBody(request):
    # HTTP body is always passed as base64-encoded string. Decode it
    data = request['body']['data']
    body = base64.b64decode(data)

    # HTML forms send data in query string format. Parse it
    params = {k: v[0] for k, v in parse_qs(body).items()}

    # クライアントでBase64エンコードされているパラメータの識別子
    PARAMETER_NAME_IDENTIFIER = 'password'
    
    for key, value in params.items():
        # 上記識別子から始まるnameかつBase64エンコード済のパラメータのみ、Base64デコードしてクライアントからの入力値を復元する
        if key.decode('utf-8').startswith(PARAMETER_NAME_IDENTIFIER) and is_base64(value):
            decoded = base64.b64decode(value)
            params[key] = decoded
    return urlencode(params)

def is_base64(bytes):
    try:
        return base64.b64encode(base64.b64decode(bytes)) == bytes
    except Exception:
        return False
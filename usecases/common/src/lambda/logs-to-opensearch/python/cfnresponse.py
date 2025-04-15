# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import logging
import urllib.request

SUCCESS = "SUCCESS"
FAILED = "FAILED"

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def send(event, context, response_status, response_data, physical_resource_id=None, no_echo=False, reason=None):
    """
    CloudFormationのカスタムリソースからレスポンスを送信するヘルパー関数
    """
    response_url = event['ResponseURL']

    logger.info(f"ResponseURL: {response_url}")

    response_body = {
        'Status': response_status,
        'Reason': reason or f"See the details in CloudWatch Log Stream: {context.log_stream_name}",
        'PhysicalResourceId': physical_resource_id or context.log_stream_name,
        'StackId': event['StackId'],
        'RequestId': event['RequestId'],
        'LogicalResourceId': event['LogicalResourceId'],
        'NoEcho': no_echo,
        'Data': response_data
    }

    json_response_body = json.dumps(response_body)
    
    logger.info(f"Response body: {json_response_body}")

    headers = {
        'content-type': '',
        'content-length': str(len(json_response_body))
    }
    
    try:
        req = urllib.request.Request(response_url, data=json_response_body.encode('utf-8'), headers=headers, method='PUT')
        response = urllib.request.urlopen(req)
        logger.info(f"Status code: {response.getcode()}")
        logger.info(f"Status message: {response.msg}")
        return True
    except Exception as e:
        logger.error(f"send(..) failed executing requests.put(..): {str(e)}")
        return False
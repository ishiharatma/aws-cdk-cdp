import json
import secrets
from logging import getLogger, INFO, DEBUG

logger = getLogger()
logger.setLevel(INFO)

buildarn_header = 'x-amz-meta-codebuild-'
csp_header_name = 'Content-Security-Policy'
csp_header_name_ro = 'Content-Security-Policy-Report-Only'
#'unsafe-eval' 'strict-dynamic'
def lambda_handler(event, context):

    logger.info('event: {}'.format(event))
    response = event['Records'][0]['cf']['response']
    logger.info('response: {}'.format(response))
    headers = response['headers']
    logger.info('headers: {}'.format(headers))
    #nonce = secrets.token_urlsafe(20) 
    #Set new headers
    if int(response['status']) == 200:
        for header in list(headers):
            if header.lower().startswith(buildarn_header):
                logger.debug('{} found.'.format(buildarn_header))
                del headers[header]
            if header.lower() == 'server':
                del headers[header]

        headers['strict-transport-security'] = [{'key': 'Strict-Transport-Security', 'value': 'max-age=63072000; includeSubdomains; preload'}]
        headers[csp_header_name.lower()] = [{'key': csp_header_name,
                                               'value': "default-src 'self'; \
base-uri 'self'; \
form-action 'self'; \
frame-ancestors 'self'; \
img-src 'self' data: www.google-analytics.com; \
script-src 'self' 'unsafe-inline' 'unsafe-eval' cdnjs.cloudflare.com cdn.jsdelivr.net code.createjs.com zipcloud.ibsnet.co.jp https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; \
style-src 'self' 'unsafe-inline' cdnjs.cloudflare.com cdn.jsdelivr.net fonts.googleapis.com; \
frame-src 'self' https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/; \
object-src 'none'; \
font-src 'self' fonts.gstatic.com cdn.jsdelivr.net fonts.googleapis.com; \
connect-src 'self' www.google-analytics.com zipcloud.ibsnet.co.jp s3.ap-northeast-1.amazonaws.com *.s3.amazonaws.com;"}]
        headers['x-content-type-options'] = [{'key': 'X-Content-Type-Options', 'value': 'nosniff'}]
        headers['x-frame-options'] = [{'key': 'X-Frame-Options', 'value': 'SAMEORIGIN'}] # Or DENY
        headers['x-xss-protection'] = [{'key': 'X-XSS-Protection', 'value': '1; mode=block'}]
        headers['referrer-policy'] = [{'key': 'Referrer-Policy', 'value': 'same-origin'}]

        if headers.get('content-type'):
          if headers['content-type'][0]['value'] == 'text/html':
              headers['content-type'] = [{ 'key': 'Content-Type', 'value': 'text/html; charset=UTF-8' }]
          if headers['content-type'][0]['value'] == 'text/css':
              headers['content-type'] = [{ 'key': 'Content-Type', 'value': 'text/css; charset=UTF-8' }]

    return response

def lambda_handler_test(event, context):

    logger.info('event: {}'.format(event))
    response = event['Records'][0]['cf']['response']
    logger.info('response: {}'.format(response))
    headers = response['headers']
    logger.info('headers: {}'.format(headers))
    #nonce = secrets.token_urlsafe(20) 
    #Set new headers
    if int(response['status']) == 200:
        for header in list(headers):
            if header.lower().startswith(buildarn_header):
                logger.debug('{} found.'.format(buildarn_header))
                del headers[header]
            if header.lower() == 'server':
                del headers[header]

        headers['strict-transport-security'] = [{'key': 'Strict-Transport-Security', 'value': 'max-age=63072000; includeSubdomains; preload'}]
        headers[csp_header_name.lower()] = [{'key': csp_header_name,
                                               'value': "default-src 'self'; \
base-uri 'self'; \
form-action 'self'; \
frame-ancestors 'self' https://ccs-imss.quizgenerator.net; \
img-src 'self' data: www.google-analytics.com; \
script-src 'self' 'unsafe-inline' 'unsafe-eval' cdnjs.cloudflare.com cdn.jsdelivr.net code.createjs.com zipcloud.ibsnet.co.jp https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; \
style-src 'self' 'unsafe-inline' cdnjs.cloudflare.com cdn.jsdelivr.net fonts.googleapis.com; \
frame-src 'self' https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/; \
object-src 'none'; \
font-src 'self' fonts.gstatic.com cdn.jsdelivr.net fonts.googleapis.com; \
connect-src 'self' www.google-analytics.com zipcloud.ibsnet.co.jp s3.ap-northeast-1.amazonaws.com *.s3.amazonaws.com;"}]
        headers['x-content-type-options'] = [{'key': 'X-Content-Type-Options', 'value': 'nosniff'}]
        headers['x-frame-options'] = [{'key': 'X-Frame-Options', 'value': 'SAMEORIGIN'}] # Or DENY
        headers['x-xss-protection'] = [{'key': 'X-XSS-Protection', 'value': '1; mode=block'}]
        headers['referrer-policy'] = [{'key': 'Referrer-Policy', 'value': 'same-origin'}]

        if headers.get('content-type'):
          if headers['content-type'][0]['value'] == 'text/html':
              headers['content-type'] = [{ 'key': 'Content-Type', 'value': 'text/html; charset=UTF-8' }]
          if headers['content-type'][0]['value'] == 'text/css':
              headers['content-type'] = [{ 'key': 'Content-Type', 'value': 'text/css; charset=UTF-8' }]

    return response
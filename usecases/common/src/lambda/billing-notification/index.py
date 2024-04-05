from collections import namedtuple
import os
from typing import Tuple
import boto3
import json
from datetime import datetime, timedelta, date

from logging import getLogger, INFO
logger = getLogger()
logger.setLevel(INFO)

INDENT_L1 = '　'
INDENT_L2 = '　　'

def lambda_handler(event, context) -> None:
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)
        # ex: arn:aws:lambda:ap-northeast-1:xxxxxxxxxxxxxxxx:function:test
        accountId = context.invoked_function_arn.split(':')[4]
        logger.info('accountId: {}'.format(accountId))
        PROJECT_NAME = os.environ.get('PROJECT_NAME')
        ENV_NAME = os.environ.get('ENV_NAME')
        TOPICARN = os.environ.get('TOPICARN')
        logger.debug('TOPICARN: {}'.format(TOPICARN))
        client = boto3.client('ce')
        #client = boto3.client('ce', region_name='us-east-1')
        sns = boto3.client('sns')
        # 合計とサービス毎の請求額を取得する
        total_billing = get_total_billing(client)
        service_billings = get_service_billings(client)

        # Amazon SNSトピックに発行するメッセージを生成
        #(title, total, period, detail) = get_message(total_billing, service_billings, Message)
        Message = get_message(total_billing, service_billings)
        title = "[{}-{}][AWS アカウント ID: {}] ".format(PROJECT_NAME,ENV_NAME,accountId) + Message.title
        logger.info("title:{}".format(Message.title))
        detail = "※ 本メールはシステムにより自動的に送信されています。" + '\n' + \
                 '\n' + \
                 "{}・AWS アカウント ID: {}".format(INDENT_L1, accountId) + '\n\n' + \
                 "{}・プロジェクト名: {}".format(INDENT_L1, PROJECT_NAME) + '\n\n' + \
                 "{}・環境名: {}".format(INDENT_L1, ENV_NAME) + '\n\n' + \
                 "{}・利用期間: {}".format(INDENT_L1, Message.period) + '\n\n' + \
                 "{}・合計: {:.2f} USD".format(INDENT_L1, Message.total) + '\n\n' + \
                 "{}・内訳".format(INDENT_L1) + '\n' + Message.detail
        logger.info("detail:{}".format(Message.detail))
        if TOPICARN:
            # SNS に Publish
            response = sns.publish(
                TopicArn = TOPICARN,
                Message = detail,
                Subject = title
            )
            logger.info("response:{}".format(response))

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

def get_total_billing(client) -> dict:
    start_date,end_date  = get_total_cost_date_range()

    # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ce.html#CostExplorer.Client.get_cost_and_usage
    response = client.get_cost_and_usage(
        TimePeriod={
            'Start': start_date,
            'End': end_date
        },
        Granularity='MONTHLY',
        Metrics=[
            'AmortizedCost'
        ]
    )
    logger.info('get_total_billing.get_cost_and_usage: {}'.format(response))
    return {
        'start': response['ResultsByTime'][0]['TimePeriod']['Start'],
        'end': response['ResultsByTime'][0]['TimePeriod']['End'],
        'billing': response['ResultsByTime'][0]['Total']['AmortizedCost']['Amount'],
    }


def get_service_billings(client) -> list:
    start_date, end_date = get_total_cost_date_range()

    # https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/ce.html#CostExplorer.Client.get_cost_and_usage
    response = client.get_cost_and_usage(
        TimePeriod={
            'Start': start_date,
            'End': end_date
        },
        Granularity='MONTHLY',
        Metrics=[
            'AmortizedCost'
        ],
        GroupBy=[
            {
                'Type': 'DIMENSION',
                'Key': 'SERVICE'
            }
        ]
    )
    logger.info('get_service_billings.get_cost_and_usage: {}'.format(response))

    billings = list(map(lambda item: {
            'service_name': item['Keys'][0],
            'billing': item['Metrics']['AmortizedCost']['Amount']
        }, response['ResultsByTime'][0]['Groups']))

    return billings


def get_message(total_billing: dict, service_billings: list) -> Tuple[str,float,str,str]:
    start = datetime.strptime(total_billing['start'], '%Y-%m-%d').strftime('%m/%d')

    # Endの日付は結果に含まないため、表示上は前日にしておく
    end_today = datetime.strptime(total_billing['end'], '%Y-%m-%d')
    end_yesterday = (end_today - timedelta(days=1)).strftime('%m/%d')

    total = round(float(total_billing['billing']), 2)
    period = f'{start}～{end_yesterday}'
    title = f'現時点での {start}～{end_yesterday} の請求額は、{total:.2f} USD です。'

    details = []
    for item in service_billings:
        service_name = item['service_name']
        billing = round(float(item['billing']), 2)

        if billing == 0.0:
            # 請求無し（0.0 USD）の場合は、内訳を表示しない
            continue
        details.append(f'{INDENT_L2}・{service_name}: {billing:.2f} USD')
    BillingMessage = namedtuple('BillingMessage', ['title', 'total', 'period', 'detail'])
    return BillingMessage(title, total, period, '\n'.join(details))

def get_total_cost_date_range() -> Tuple[str, str]:
    start_date = get_begin_of_month()
    end_date = get_today()

    # get_cost_and_usage()のstartとendに同じ日付は指定不可のため、
    # 「今日が1日」なら、「先月1日から今月1日（今日）」までの範囲にする
    if start_date == end_date:
        end_of_month = datetime.strptime(start_date, '%Y-%m-%d') + timedelta(days=-1)
        begin_of_month = end_of_month.replace(day=1)
        return begin_of_month.date().isoformat(), end_date
    CostDateRange = namedtuple('CostDateRange', ['start_date', 'end_date'])
    return CostDateRange(start_date, end_date)

def get_begin_of_month() -> str:
    return date.today().replace(day=1).isoformat()


def get_prev_day(prev: int) -> str:
    return (date.today() - timedelta(days=prev)).isoformat()


def get_today() -> str:
    return date.today().isoformat()
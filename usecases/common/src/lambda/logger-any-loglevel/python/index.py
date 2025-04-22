import json
import logging
import os

# ロギングの設定
logger = logging.getLogger()

def lambda_handler(event, context):
    try:
        logger.info('Received event: {}'.format(json.dumps(event)))
        logger.info('logLevel: {}'.format(logger.level))

        logger.debug('1: This is a debug log')
        logger.info('2: This is an info log')
        logger.warning('3: This is a warning log')
        logger.error('4: This is an error log')
        logger.fatal('5: This is a fatal log')
        logger.critical('6: This is a critical log')
        
        return {
            'statusCode': 200,
            'body': json.dumps({"loglevel":logger.level
                                , "message":"Log Level Test"}
                                )
        }

    except Exception as e:
        logger.exception(str(e))
        return {
            'statusCode': 500,
            'body': json.dumps(str(e))
        }
    finally:
        logger.info('Function complete')

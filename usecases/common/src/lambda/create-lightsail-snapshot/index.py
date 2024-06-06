# {"Instances": ["xxxxxxxxxxxxxxxxx","yyyyyyyyyyyyyyyyyy","zzzzzzzzzzzzzzzzz"]}
import boto3
import os
from time import sleep
from datetime import datetime, timedelta, timezone
from botocore.client import ClientError
from logging import getLogger, INFO

logger = getLogger()

lightsail = boto3.client('lightsail')

TAG_KEY_BACKUP = 'ami-backup'
TAG_KEY_BACKUP_GENERATION = 'Backup-Generation'
TAG_KEY_AUTO_BACKUP       = 'Backup-Type'
TAG_VAL_AUTO_BACKUP       = 'auto'
"""
実行ハンドラー
"""
def lambda_handler(event, context):
    try:
        instances = event['Instances']
        createSnapshot(instances)
        deleteOldestSnapshot(instances)
        return
    except Exception as e:
        logger.exception(str(e))
        raise e

"""
自動スナップショット作成
"""
def createSnapshot(instances):
    # タイムゾーンの生成
    JST = timezone(timedelta(hours=+9), 'JST')
    #タイムスタンプ生成
    timestamp = datetime.now(JST).strftime('%Y%m%d-%H%M%S')
    for instanceName in instances:
        instance = lightsail.get_instance(
            instanceName=instanceName)['instance']
        print(instance)
        tags = { tag['key']: tag['value'] for tag in instance['tags'] }
        generation = int( tags.get(TAG_KEY_BACKUP_GENERATION, 0) )
        if generation < 1:
            logger.info('backup skipped: %s (%s = %s) ' % (instance.get('InstanceId'), TAG_KEY_BACKUP_GENERATION, generation))    
            continue
        #スナップショットの作成
        newSnapName = 'autosnap-' + instanceName + '-' + timestamp
        response = lightsail.create_instance_snapshot(
            instanceSnapshotName = newSnapName,
            instanceName = instanceName
        )
        logger.info("Create Snapshot: SnaphostName: %s" % newSnapName)
 
"""
最も古い自動スナップショットの削除
"""
def deleteOldestSnapshot(instances):
    
    #全スナップショットを取得
    allSnaps = lightsail.get_instance_snapshots()
    for instanceName in instances:
        instance = lightsail.get_instance(
            instanceName=instanceName)['instance']
        tags = { tag['key']: tag['value'] for tag in instance['tags'] }
        generation = int( tags.get(TAG_KEY_BACKUP_GENERATION, 0) )
        #自動スナップショットのものだけにフィルタする条件定義
        isAutoInstance = ( lambda x:
            ( x['fromInstanceName'] == instanceName ) and ( x['name'][:8] == 'autosnap' )
        )
        #フィルタ
        autoSnaps = filter(isAutoInstance, allSnaps['instanceSnapshots'])
        #ソート（生成の古い順）
        autoSnaps = sorted(autoSnaps, key=lambda x:x['createdAt'])
    
        #規定のスナップショット数を超えているか確認
        if generation < len(autoSnaps) :
            #スナップショット削除（最も生成の古いもの）
            res = lightsail.delete_instance_snapshot(
                instanceSnapshotName = autoSnaps[0]['name']
            )
            logger.info("Remove Snapshot: SnaphostName: %s" % autoSnaps[0]['name'])
        else:
            logger.info("Snapshot Not Found: instanceName: %s" % instanceName)

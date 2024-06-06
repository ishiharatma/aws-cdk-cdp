import os
import boto3
import collections
from time import sleep
from datetime import datetime, timedelta
from botocore.client import ClientError
from logging import getLogger, INFO

logger = getLogger()


TAG_KEY_BACKUP = 'ami-backup'
TAG_KEY_BACKUP_GENERATION = 'AMI-Backup-Generation'
TAG_KEY_AUTO_BACKUP       = 'Backup-Type'
TAG_VAL_AUTO_BACKUP       = 'auto'
ec2_client = boto3.client('ec2')
ec2_resource = boto3.resource('ec2')

def lambda_handler(event, context):
    descriptions = create_image()
    delete_old_images(descriptions)

def create_image():
    instances = get_instances([TAG_KEY_BACKUP_GENERATION])
    descriptions = {}
    for instance in instances:
        tags = { tag['Key']: tag['Value'] for tag in instance['Tags'] }
        generation = int( tags.get(TAG_KEY_BACKUP_GENERATION, 0) )
        if generation < 1:
            print('ami backup skipped: %s (%s = %s) ' % (instance.get('InstanceId'), TAG_KEY_BACKUP_GENERATION, generation))    
            continue

        instance_id = instance.get('InstanceId')
        create_data_jst = (datetime.now() + timedelta(hours=9)).strftime("%Y%m%d_%H%M%S")
        ami_name = '%s_%s' % (tags['Name'], instance_id)
        ami_name = ami_name + "_" + create_data_jst
        description = instance_id

        image_id = _create_image(instance_id, ami_name, description)
        logger.info('Create Image: ImageId:%s (%s) ' % (image_id['ImageId'], ami_name))
        print('Create Image: ImageId:%s (%s) ' % (image_id['ImageId'], ami_name))       
        descriptions[description] = generation
        ami_tags = []
        ami_tags.append({
                      'Key': 'ami_name',
                      'Value': image_id['ImageId']
                  })
        ami_tags.append({
                      'Key': TAG_KEY_AUTO_BACKUP,
                      'Value': TAG_VAL_AUTO_BACKUP
                  })
        for key in tags:
            print('append instance tags: %s = %s' % (key, tags[key]))
            if key != TAG_KEY_BACKUP_GENERATION:
                ami_tags.append({
                          'Key': key,
                          'Value': tags[key]
                    })
        #_wait_create_image(image_id['ImageId'])
        sleep(10)
        _set_tags_to_image(image_id['ImageId'],ami_tags)
        print('Create Image Tags: image_id:%s' % (image_id['ImageId']))       
        _set_tags_to_snapshot(image_id['ImageId'],ami_tags)
    return descriptions

def get_instances(tag_names):
    reservations = ec2_client.describe_instances(
        Filters=[
            {
                'Name': 'tag-key',
                'Values': tag_names
            }
        ]
    )['Reservations']

    return sum([
        [instance for instance in reservation['Instances']]
        for reservation in reservations
    ], [])

def _create_image(instance_id, ami_name, description):
    for i in range(1, 3):
        try:
            return ec2_client.create_image(
                Description = description,
                NoReboot = True,
                InstanceId = instance_id,
                Name = ami_name
                )
        except ClientError as e:
            logger.exception(str(e))
            print(str(e))
        sleep(2)
    raise Exception('cannot create image ' + ami_name)

def _wait_create_image(image_id):
    try:
        image = ec2_client.describe_images(ImageIds=[image_id])
        print('images_descriptions: %s' % (image))
        while image['Images'][0]['State'] != 'available':
            print('images_descriptions: %s(%s)' % (image_id, image['Images'][0]['State']) )
            sleep(10)
            image = ec2_client.describe_images(ImageIds=[image_id])
        print('Create AMI Complete!: %s' % image_id)
    except ClientError as e:
        logger.exception(str(e))
        print(str(e))

def _set_tags_to_image(image_id, tags):
    try:
        image = ec2_resource.Image(image_id)
        return image.create_tags(Tags = tags)
    except ClientError as e:
        logger.exception(str(e))
        print(str(e))
    return

def _set_tags_to_snapshot(image_id, tags):
    try:
        image = ec2_resource.Image(image_id)
        for dev in image.block_device_mappings:
            print('#block_device_mappings: %s' % (dev))       
            # EBS以外は対象外
            if not 'Ebs' in dev:
                continue
            snapshot_id = dev['Ebs']['SnapshotId']
            snapshot = ec2_resource.Snapshot(snapshot_id)
            snapshot.create_tags(Tags = tags)
            print('Create Snapshot Tags: snapshot_id:%s' % (snapshot_id))       
    except ClientError as e:
        logger.exception(str(e))
        print(str(e))
    return

def _get_snapshots(image_id):
    snapshots = []
    try:
        image = ec2_resource.Image(image_id)
        for dev in image.block_device_mappings:
            print('#block_device_mappings: %s' % (dev))       
            # EBS以外は対象外
            if not 'Ebs' in dev:
                continue
            snapshot_id = dev['Ebs']['SnapshotId']
            snapshots.append(snapshot_id)
    except ClientError as e:
        logger.exception(str(e))
        print(str(e))
    return snapshots


def delete_old_images(descriptions):
    images_descriptions = get_images_descriptions(list(descriptions.keys()))
    for description, images in images_descriptions.items():
        delete_count = len(images) - descriptions[description]
        if delete_count <= 0:
            print('Not Target')
            continue

        images.sort(key=lambda x:x['CreationDate'])
        old_images = images[0:delete_count]

        for image in old_images:
            del_snapshots=_get_snapshots(image['ImageId'])
            logger.info('Delete Snapshots:%s' % (del_snapshots))
            _deregister_image(image['ImageId'])
            logger.info('Deregister Image: ImageId:%s (%s)' % (image['ImageId'], image['Description']))
            print('Deregister Image: ImageId:%s (%s)' % (image['ImageId'], image['Description']))
            _delete_snapshot(del_snapshots)

def get_images_descriptions(descriptions):
    images = ec2_client.describe_images(
        Owners = [
            os.environ['AWS_ACCOUNT']
        ],
        Filters = [
            {
                'Name': 'description',
                'Values': descriptions,
            }
        ]
    )['Images']

    groups = collections.defaultdict(lambda: [])
    { groups[ image['Description'] ].append(image) for image in images }

    return groups

def _deregister_image(image_id):
    for i in range(1, 3):
        try:
            return ec2_client.deregister_image(
                ImageId = image_id
            )
        except ClientError as e:
            logger.exception(str(e))
            print(str(e))
        sleep(2)
    raise Exception('Cannot Deregister image: ' + image_id)

def _delete_snapshot(snapshotids):
    try:
        for snapshot_id in snapshotids:
            snapshot = ec2_resource.Snapshot(snapshot_id)
            ec2_client.delete_snapshot(SnapshotId=snapshot_id)
            print('Remove Snapshot: snapshot_id:%s' % (snapshot_id))       
    except ClientError as e:
        logger.exception("Cannot Delete Snapshot: %s", e)
        sleep(2)
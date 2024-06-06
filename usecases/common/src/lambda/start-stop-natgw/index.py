import os
import boto3
from botocore.client import ClientError
from logging import getLogger, INFO

logger = getLogger()
# [{
#   "Action":"start or stop"
#   , "eipId":""
#   , "natSubnetId": ""
#   , "routeTableId": ""
#   , "attachSubnetIds": [""]
# }]

client = boto3.client('ec2')

def lambda_handler(event, context):
    try:
      for e in event:
        Action = e.get('Action')
        eip = e.get('eipId')
        natSubnetId =  e.get('natSubnetId')
        rtId =  e.get('routeTableId')
        attachSubnetIds =  e.get('attachSubnetIds')

        logger.info('Action(%s)' % (type))
        if (Action == "start"):
            natgw = start_natgw(eip, natSubnetId)
            atatch_natgw(rtId, natgw, attachSubnetIds)
        elif (Action == "stop"):
            detach_natgw(rtId, natgw, attachSubnetIds)
            stop_natgw(natSubnetId)
        else:
            logger.warn('Action(%s) is unknown.' % (Action))
    except ClientError as e:
        logger.exception(str(e))
        print(str(e))

def start_natgw(Eip,Subnet):
  logger.info('Start NATGateway.')
  response = client.create_nat_gateway(
#    AllocationId=eip,
    SubnetId=Subnet
    )
  natid = response['NatGateway']['NatGatewayId']
  client.get_waiter('nat_gateway_available').wait(NatGatewayIds=[natid])
  return(natid)

def atatch_natgw(RouteTableId, natgw, Subnet):
  filters = [ { 'Name': 'association.subnet-id', 'Values': [Subnet] } ]
  response = client.describe_route_tables(Filters = filters)
  rtb = response['RouteTables'][0]['Associations'][0]['RouteTableId']
  response = client.create_route(
  DestinationCidrBlock = '0.0.0.0/0',
  NatGatewayId = natgw,
  RouteTableId = rtb
  )

def stop_natgw(Subnet):
  logger.info('Stop NATGateway.')
  filters = [ { 'Name': 'subnet-id', 'Values': [Subnet] },
              { 'Name': 'state', 'Values': ['available'] } ]
  response = client.describe_nat_gateways(Filters=filters)
  natgw = response['NatGateways'][0]['NatGatewayId']
  client.delete_nat_gateway(NatGatewayId=natgw)

def detach_natgw(RouteTableId, natgw, Subnet):
  #filters = [ { 'Name': 'association.subnet-id', 'Values': [Subnet] } ]
  #response = client.describe_route_tables(Filters = filters)
  #rtb = response['RouteTables'][0]['Associations'][0]['RouteTableId']
  response = client.delete_route(
    DestinationCidrBlock = '0.0.0.0/0',
    RouteTableId = RouteTableId
  )



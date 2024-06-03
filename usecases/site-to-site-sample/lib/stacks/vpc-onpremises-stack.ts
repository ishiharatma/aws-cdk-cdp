import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
    aws_ec2 as ec2, 
  } from 'aws-cdk-lib';

interface OnPremVPCStackProps extends StackProps {
    readonly pjName: string;
    readonly envName: string;
    readonly vpcCIDR: string;
    readonly myIP: string;
    readonly VPNGatewayIpAddress: string;
    readonly useRemoteSSH: boolean;
    readonly isAutoDeleteObject: boolean;
} 

export class OnPremVPCStack extends cdk.Stack {
  readonly _vpc: ec2.Vpc;
  readonly _cgw: ec2.CfnCustomerGateway;
  constructor(scope: Construct, id: string, props: OnPremVPCStackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;

    // VPC (Virtual On-Premises)
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: [id, 'VPC', accountId].join('/') ,
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCIDR),
      maxAzs: 2, // 2 Availability Zones
      natGateways:0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      // Security Hub EC2.2
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-2
      restrictDefaultSecurityGroup: true, 
      createInternetGateway: true,
    });
    this._vpc = vpc;

    // Customer Gateway for VPC-OnPremises
    const customerGateway  = new ec2.CfnCustomerGateway(this, 'CustomerGateway', {
      bgpAsn: 65000,
      ipAddress: vpc.internetGatewayId!,
      type: 'ipsec.1',
    });
    this._cgw = customerGateway;

    new cdk.CfnOutput(this, 'CustomerGatewayId', {
      value: customerGateway.ref,
    });

    const customerGatewayIpAddress = customerGateway.ipAddress;

    new cdk.CfnOutput(this, 'CustomerGatewayPublicIp', {
      value: customerGatewayIpAddress,
      description: 'Public IP address of the Customer Gateway',
    });

    // Create a security group for your EC2 instance
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
        vpc,
        allowAllOutbound: true,    
    });
    if (props.useRemoteSSH) {
      ec2SecurityGroup.addIngressRule(
        ec2.Peer.ipv4(props.myIP), ec2.Port.tcp(22), 'allow ssh access from My Location.'
      );
    }
    new cdk.CfnOutput(this, 'EC2SecurityGroupId', {
      value: ec2SecurityGroup.securityGroupId,
    });

  }
  get vpc() {
    return this._vpc;
  }
  get cgw() {
    return this._cgw;
  }
}

import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';;
import { 
    aws_ec2 as ec2, 
} from 'aws-cdk-lib';

interface VPCStackProps extends StackProps {
    readonly pjName: string;
    readonly envName: string;
    readonly vpcCIDR: string;
    readonly isAutoDeleteObject: boolean;
} 

export class VPCStack extends cdk.Stack {
  readonly _vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, props: VPCStackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;

    // VPC
    const vpc = new ec2.Vpc(this, 'MyVpc', {
        vpcName: [id, 'VPC', accountId].join('/') ,
        ipAddresses: ec2.IpAddresses.cidr(props.vpcCIDR),
        maxAzs: 2, // 2 Availability Zones
        natGateways:0,
        subnetConfiguration: [
          {
            cidrMask: 24,
            name: 'IsolatedSubnet',
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
        ],
        // Security Hub EC2.2
        // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-2
        restrictDefaultSecurityGroup: true, 
        // VPN Gateway
        vpnGateway: true,
        vpnGatewayAsn: 64512, // BGPASN
      });
    new cdk.CfnOutput(this, 'VpnGatewayId', {
        value: vpc.vpnGatewayId!,
    });
    this._vpc = vpc;

    new cdk.CfnOutput(this, 'VGWId', {
      value: vpc.vpnGatewayId!,
    });

    // Create a security group for your EC2 instance
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
        vpc,
        allowAllOutbound: true,    
    });
    new cdk.CfnOutput(this, 'EC2SecurityGroupId', {
        value: ec2SecurityGroup.securityGroupId,
    });
  
    const userData = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userData.addCommands(
      'yum update -y'
    );
    const keyPair = new ec2.KeyPair(this, 'KeyPair', {
      keyPairName: `${id}-ec2-KeyPair`,
    });
    new cdk.CfnOutput(this, 'EC2InstanceKeyPairId', {
      value: keyPair.keyPairId,
    });
  
    // Create an EC2 instance for connection testing
    const ec2Instance = new ec2.Instance(this, 'EC2Instance1', {
      vpc,
      instanceName: [id, 'test', 'instance'].join('/') ,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64 //X86_64, 
      }),
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroup: ec2SecurityGroup,
      //availabilityZone: 'ap-northeast-1a',
      ssmSessionPermissions: true, // Used by SSM session manager
      userData: userData,
      // Configure IMDSv2 for the NAT instance
      // Security Hub EC2.8
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-8
      requireImdsv2: true,
    });
    ec2Instance.node.addDependency(vpc);
  }
  get vpc() {
    return this._vpc;
  }

}

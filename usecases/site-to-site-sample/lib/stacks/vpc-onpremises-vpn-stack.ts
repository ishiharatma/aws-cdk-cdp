import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
    aws_ec2 as ec2, 
  } from 'aws-cdk-lib';

interface OnPremVPCStackProps extends StackProps {
    readonly pjName: string;
    readonly envName: string;
    readonly vpcOnPrem: ec2.Vpc;
    readonly ec2SecurityGroupId: string;
    readonly VPNGatewayId: string;
    readonly customerGatewayIpAddress: string;
    readonly myIP: string;
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

    // Create a security group for your EC2 instance
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
        props.vpcOnPrem,
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
    const vpnGateway = ec2.VpnGateway.fromVpnGatewayId(this, 'VPNGateway', props.VPNGatewayId);
  
    const userData = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userData.addCommands(
      'yum update -y',
      'sudo vi /etc/yum.repos.d/fedora.repo',
      'sudo dnf enablerepo=fedora install libreswan y',
      'echo conn Tunnel1>>/etc/ipsec.d/aws.conf',
      'echo 	authby=secret>>/etc/ipsec.d/aws.conf',
      'echo 	auto=start>>/etc/ipsec.d/aws.conf',
      'echo 	left=%defaultroute>>/etc/ipsec.d/aws.conf',
      `echo 	leftid=${props.VPNGatewayIpAddress}>>/etc/ipsec.d/aws.conf`, // VPN
      `echo 	right=${props.customerGatewayIpAddress}>>/etc/ipsec.d/aws.conf`, // Customer Gateway
      'echo 	type=tunnel>>/etc/ipsec.d/aws.conf',
      'echo 	ikelifetime=8h>>/etc/ipsec.d/aws.conf',
      'echo 	keylife=1h>>/etc/ipsec.d/aws.conf',
      'echo 	phase2alg=aes_gcm>>/etc/ipsec.d/aws.conf',
      'echo 	ike=aes256-sha1>>/etc/ipsec.d/aws.conf',
      'echo 	keyingtries=%forever>>/etc/ipsec.d/aws.conf',
      'echo 	keyexchange=ike>>/etc/ipsec.d/aws.conf',
      'echo 	leftsubnet=192.168.0.0/16>>/etc/ipsec.d/aws.conf',
      'echo 	rightsubnet=10.0.0.0/16>>/etc/ipsec.d/aws.conf',
      'echo 	dpddelay=10>>/etc/ipsec.d/aws.conf',
      'echo 	dpdtimeout=30>>/etc/ipsec.d/aws.conf',
      'echo 	dpdaction=restart_by_peer>>/etc/ipsec.d/aws.conf',
      'echo 	encapsulation=yes>>/etc/ipsec.d/aws.conf',
      '',
      '',
    );
    const keyPair = new ec2.KeyPair(this, 'KeyPair', {
      keyPairName: `${id}-ec2-KeyPair`,
    });
    new cdk.CfnOutput(this, 'EC2InstanceKeyPairId', {
      value: keyPair.keyPairId,
    });
  
    // Create an EC2 instance for connection testing
    const ec2Instance = new ec2.Instance(this, 'EC2Instance', {
      vpc,
      instanceName: [id, 'test', 'instance'].join('/') ,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64 //X86_64, 
      }),
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: ec2SecurityGroup,
      //availabilityZone: 'ap-northeast-1a',
      ssmSessionPermissions: true, // Used by SSM session manager
      userData: userData,
      // Configure IMDSv2 for the NAT instance
      // Security Hub EC2.8
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-8
      requireImdsv2: true,
    });
    new cdk.CfnOutput(this, 'EC2InstancePublicIP', {
      value: ec2Instance.instancePublicIp,
    });
    ec2Instance.node.addDependency(vpc);

  }
  get vpc() {
    return this._vpc;
  }
  get cgw() {
    return this._cgw;
  }
}

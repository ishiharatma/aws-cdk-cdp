import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_s3 as s3,
  aws_ec2 as ec2, 
  aws_iam as iam,
  aws_kms as kms,
} from 'aws-cdk-lib';

interface MyVpcStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly vpcCIDR: string
  /**
   * Define the maximum number of AZs to use in this region
   * @default 2 AZ
   */
  readonly maxAzs?: number;
  readonly isAutoDeleteObject: boolean;
} 

export class MyVpcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MyVpcStackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;
    // VPC
    const vpc = new ec2.Vpc(this, 'MyVpc', {
      vpcName: [id, 'VPC', accountId].join('/') ,
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCIDR),
      maxAzs: props.maxAzs ?? 2, // 2 Availability Zones
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // PRIVATE_WITH_NAT: deprecated
        },
        {
          cidrMask: 24,
          name: 'IsolatedSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      // Security Hub EC2.2
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-2
      restrictDefaultSecurityGroup: true, 
    });

    // NAT Instance Security Group
    const natSecurityGroup = new ec2.SecurityGroup(this, 'NATSecurityGroup', {
      vpc,
      description: 'Security group for NAT instances',
      allowAllOutbound: true,
    });
    new cdk.CfnOutput(this, 'NATSecurityGroupId', {
      value: natSecurityGroup.securityGroupId,
    });

    // Allow inbound traffic from VPC
    // Security Hub EC2.18
    // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-18
    // Security Hub EC2.19
    // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-19
    // natSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp(), 'Allow all inbound traffic');
    natSecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.allTcp(), 'Allow inbound traffic from VPC');

    // // Allow outbound traffic
    natSecurityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp(), 'Allow all outbound traffic');

    // NAT Instance
    const userData = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userData.addCommands(
      // See: https://docs.aws.amazon.com/ja_jp/vpc/latest/userguide/VPC_NAT_Instance.html#create-nat-ami
      'sudo yum install iptables-services -y',
      'sudo systemctl enable iptables',
      'sudo systemctl start iptables',
      'echo net.ipv4.ip_forward=1 >> /etc/sysctl.d/custom-ip-forwarding.conf',
      'sudo sysctl -p /etc/sysctl.d/custom-ip-forwarding.conf',
      'sudo /sbin/iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE',
      'sudo /sbin/iptables -F FORWARD',
      'sudo service iptables save',
    );
    const keyPair = new ec2.KeyPair(this, 'KeyPair', {
      keyPairName: `${id}-nat-KeyPair`,
    });
    new cdk.CfnOutput(this, 'NATInstanceKeyPairId', {
      value: keyPair.keyPairId,
    });
    
    const natInstance = new ec2.Instance(this, 'NATInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      ssmSessionPermissions: true, // SSM用
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64 //X86_64, 
      }),
      keyPair: keyPair,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // NAT instance in the public subnet
      },
      securityGroup: natSecurityGroup, // Assign the security group to the instance
      userData: userData,
      // Configure IMDSv2 for the NAT instance
      // Security Hub EC2.8
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-8
      requireImdsv2: true,
      // Disable source/destination checks for the NAT instance
      sourceDestCheck: false,
    });
    //const natCfnInstance = natInstance.node.defaultChild as ec2.CfnInstance;

    // Output the NAT instance's public IP address
    new cdk.CfnOutput(this, 'NATInstancePublicIP', {
      value: natInstance.instancePublicIp,
    });

    // NACL for Public Subnets
    const naclPublic = new ec2.NetworkAcl(this, 'NaclPublic', {
      vpc: vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
    });
    // Egress Rules for Public Subnets
    naclPublic.addEntry('NaclEgressPublic', {
      direction: ec2.TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });
    // Ingress Rules for Public Subnets
    naclPublic.addEntry('NaclIngressPublic', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });
    // NACL for Private Subnets
    const naclPrivate = new ec2.NetworkAcl(this, 'NaclPrivate', {
      vpc: vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });
    // Egress Rules for Private Subnets
    naclPrivate.addEntry('NaclEgressPrivate', {
      direction: ec2.TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });
    // Ingress Rules for Public Subnets
    naclPrivate.addEntry('NaclIngressPrivate', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 120,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });

    // Security Hub EC2.6
    // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-6
    // FlowLog
    // CMK
    const flowLogKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'for VPC Flow log',
      alias: `${id}-for-flowlog`,
    });
    new cdk.CfnOutput(this, 'KMSKeyId', {
      value: flowLogKey.keyId,
    });
    flowLogKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        resources: ['*'],
      }),
    );
    // S3 Bucket for FlowLogs
    const flowLogsBucket  = new s3.Bucket(this, 'FlowLogsBucket', {
      bucketName: [id, 'flowlogs', accountId].join('.') ,
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.KMS, // s3.BucketEncryption.S3_MANAGED
      encryptionKey: flowLogKey,
      removalPolicy: props.isAutoDeleteObject ? cdk.RemovalPolicy.DESTROY: cdk.RemovalPolicy.RETAIN, // Delete if isAutoDeleteObject is true, otherwise do not delete
      autoDeleteObjects: props.isAutoDeleteObject,
    });
    new cdk.CfnOutput(this, 'FlowLogsBucketName', {
      value: flowLogsBucket.bucketName,
    });

    vpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toS3(flowLogsBucket),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

  }
}


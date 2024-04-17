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
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          // PRIVATE_WITH_EGRESS:
          // PRIVATE_WITH_NAT: deprecated
        },
        {
          cidrMask: 24,
          name: 'IsolatedSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      natGateways: 1,
      natGatewaySubnets: {subnetType: ec2.SubnetType.PUBLIC},
      natGatewayProvider: ec2.NatProvider.gateway(),
      // Security Hub EC2.2
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-2
      restrictDefaultSecurityGroup: true, 
    });

    // Output the NAT instance's public IP address
    // TODO

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
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
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


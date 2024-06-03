import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_s3 as s3,
  aws_ec2 as ec2,
  aws_events as events,
  aws_iam as iam,
  aws_kms as kms,
} from 'aws-cdk-lib';
interface DifyDockerEc2WithVpcStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly vpcCIDR: string
  /**
   * Define the maximum number of AZs to use in this region
   * @default 2 AZ
   */
  readonly maxAzs?: number;
  /**
   * The number of NAT Gateways/Instances to create.
   * @default 1
   */
  readonly natgateways?: number;
  /**
   * Nat Instance Type
   * @default t4.nano
   */
  readonly natInstanceType?: string;
  readonly startSchedule?: string;
  readonly stopSchedule?: string;
  readonly isAutoDeleteObject: boolean;
} 

export class DifyDockerEc2WithVpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: DifyDockerEc2WithVpcStackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;
    const natGateways: number = props.natgateways ?? 0;

    const natInstance = ec2.NatProvider.instanceV2({
      instanceType: props.natInstanceType
                    ? new ec2.InstanceType(props.natInstanceType)
                    : ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64 //X86_64, 
      }),
      defaultAllowedTraffic: ec2.NatTrafficDirection.OUTBOUND_ONLY,
    });

    // VPC
    this.vpc = new ec2.Vpc(this, 'MyVpc', {
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
      natGateways: natGateways,
      natGatewaySubnets: {subnetType: ec2.SubnetType.PUBLIC},
      natGatewayProvider: natInstance,
      // Security Hub EC2.2
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-2
      restrictDefaultSecurityGroup: true, 

    });
    // Allow inbound traffic from VPC
    // Security Hub EC2.18
    // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-18
    // Security Hub EC2.19
    // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-19
    natInstance.securityGroup.addIngressRule(ec2.Peer.ipv4(props.vpcCIDR),ec2.Port.allTraffic());

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

    this.vpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toS3(flowLogsBucket),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    const keyPair = new ec2.KeyPair(this, 'KeyPair', {
      keyPairName: `${id}-ec2-KeyPair`,
    });
    new cdk.CfnOutput(this, 'EC2InstanceKeyPairId', {
      value: keyPair.keyPairId,
    });
    // キーペア取得コマンドアウトプット
    new cdk.CfnOutput(this, 'GetSSHKeyCommand', {
      value: `aws ssm get-parameter --name /ec2/keypair/${keyPair.keyPairId} --region ${this.region} --with-decryption --query Parameter.Value --output text`,
    })
    const userData = ec2.UserData.forLinux({ shebang: '#!/bin/bash' });
    userData.addCommands(
      'yum update -y',
      'yum -y install docker',  // Docker Engine パッケージインストール
      'systemctl start docker', // Docker サービス起動
      'systemctl enable docker', // Dockerサービスの自動起動を有効化
      // コンテナ起動
      `mkdir $HOME/.docker`,
      `DOCKER_CONFIG=\${DOCKER_CONFIG:-$HOME/.docker}`,
      `mkdir -p $DOCKER_CONFIG/cli-plugins`,
      `curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o $DOCKER_CONFIG/cli-plugins/docker-compose`,
      `chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose`,
      `git clone https://github.com/langgenius/dify.git`,
      `cd dify/docker`,
      `docker-compose up -d`,
    );

    // Create a security group for EC2 instance
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,    
    });
    new cdk.CfnOutput(this, 'EC2SecurityGroupId', {
      value: ec2SecurityGroup.securityGroupId,
    });
    // Create an EC2 instance for connection testing
    this.instance = new ec2.Instance(this, 'EC2Instance1', {
      vpc: this.vpc,
      instanceName: [props.pjName, props.envName, 'pgadmin', 'instance'].join('/') ,
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
      keyPair: keyPair,
    });
    new cdk.CfnOutput(this, "EC2InstanceId", {
        value: this.instance.instanceId,
        description: "PgAdmin Instance",
    });

    // 自動起動と停止スケジュール
    if (props.startSchedule && props.stopSchedule) {
      const role = new iam.Role(this, `EC2startstopRole`, {
        roleName: [props.pjName, props.envName, 'PgAdminStopStart'].join('-'),
        assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonSSMAutomationRole'),
        ]
      });
      // 起動スケジュール
      const startRule = new events.CfnRule(this, 'EC2StartRule', {
        name: [props.pjName, props.envName, 'EC2StartRule'].join('-'),
        description: `${this.instance.instanceId} ${props.stopSchedule} Start`,
        scheduleExpression: props.stopSchedule,
        targets: [{
          arn: `arn:aws:ssm:${region}::automation-definition/AWS-StartEC2Instance:$DEFAULT`,
          id: 'TargetEC2Instance1',
          input: `{"InstanceId": ["${this.instance.instanceId}"]}`,
          roleArn: role.roleArn
        }]
      });
      
      // 停止スケジュール
      const stopRule = new events.CfnRule(this, 'EC2StopRule', {
        name: [props.pjName, props.envName, 'EC2StopRule'].join('-'),
        description: `${this.instance.instanceId} ${props.stopSchedule} Stop`,
        scheduleExpression: props.stopSchedule,
        targets: [{
          arn: `arn:aws:ssm:${region}::automation-definition/AWS-StopEC2Instance:$DEFAULT`,
          id: 'TargetEC2Instance1',
          input: `{"InstanceId": ["${this.instance.instanceId}"]}`,
          roleArn: role.roleArn
        }]
      });
    }


  }
}

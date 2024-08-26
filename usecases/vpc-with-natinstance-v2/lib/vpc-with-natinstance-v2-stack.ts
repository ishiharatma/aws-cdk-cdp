import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_s3 as s3,
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_kms as kms,
  aws_events as events,
} from 'aws-cdk-lib';
interface VpcWithNatinstanceV2StackProps extends StackProps {
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
  /**
   * NAT Instance Stop Cron Schedule
   */
  readonly natInstanceStopCronSchedule?: string;
  /**
   * NAT Instance Start Cron Schedule
   */
  readonly natInstanceStartCronSchedule?: string;
  readonly isAttacheElasticIp?: boolean;
  readonly isAutoDeleteObject: boolean;
} 

export class VpcWithNatinstanceV2Stack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcWithNatinstanceV2StackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;
    const natGateways: number = props.natgateways ?? 0;
    const isAttacheElasticIp: boolean = props.isAttacheElasticIp ?? false;

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


    const role = new iam.Role(this, `NatInstanceStartStopRole`, {
      roleName: [props.pjName, props.envName, 'NatInstanceStartStop'].join('-'),
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonSSMAutomationRole'),
      ]
    });

    natInstance.configuredGateways.map(
      (nat, index) =>  {
        if (isAttacheElasticIp) {
          new ec2.CfnEIP(this, `NatEIP${index + 1}`, {
            instanceId: nat.gatewayId,
            tags: [
              { key: 'Name', value: `NatInstanceEIP${index + 1}` },
            ],
          });  
        }
        if (props.natInstanceStartCronSchedule && props.natInstanceStopCronSchedule) {
          // 起動スケジュール
          new events.CfnRule(this, `EC2StartRule${index + 1}`, {
            name: [props.pjName, props.envName, 'NATStartRule', nat.gatewayId].join('-'),
            description: `${nat.gatewayId} ${props.natInstanceStartCronSchedule} Start`,
            scheduleExpression: props.natInstanceStartCronSchedule,
            targets: [{
              arn: `arn:aws:ssm:${region}::automation-definition/AWS-StartEC2Instance:$DEFAULT`,
              id: 'TargetEC2Instance1',
              input: `{"InstanceId": ["${nat.gatewayId}"]}`,
              roleArn: role.roleArn
            }]
          });
          
          // 停止スケジュール
          new events.CfnRule(this, `EC2StopRule${index + 1}`, {
            name: [props.pjName, props.envName, 'NATStopRule', nat.gatewayId].join('-'),
            description: `${nat.gatewayId} ${props.natInstanceStopCronSchedule} Stop`,
            scheduleExpression: props.natInstanceStopCronSchedule,
            targets: [{
              arn: `arn:aws:ssm:${region}::automation-definition/AWS-StopEC2Instance:$DEFAULT`,
              id: 'TargetEC2Instance1',
              input: `{"InstanceId": ["${nat.gatewayId}"]}`,
              roleArn: role.roleArn
            }]
          });
        }
        // Export NAT InstanceID
        new cdk.CfnOutput(this, `NatInstanceId${index + 1}`, {
          value: nat.gatewayId,
        });
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

    this.vpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toS3(flowLogsBucket),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });
  }
}

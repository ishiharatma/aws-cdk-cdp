
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

export class VpcWithNoPublicInternetAccessStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  constructor(scope: Construct, id: string, props: MyVpcStackProps) {
    super(scope, id, props);

    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;
    // VPC
    this.vpc = new ec2.Vpc(this, 'MyVpc', {
      vpcName: [props.pjName, props.envName, 'VPC', accountId].join('/') ,
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCIDR),
      maxAzs: props.maxAzs ?? 2, // 2 Availability Zones
      createInternetGateway: false, // No Internet Gateway
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'IsolatedSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      natGateways: 0, // No NAT Gateway
      // Security Hub EC2.2
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-2
      restrictDefaultSecurityGroup: true, 
    });

    // Security Hub EC2.6
    // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-6
    // FlowLog
    // (Optional)CMK
    /*
    const flowLogKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'for VPC Flow log',
      alias: `${props.pjName}-${props.envName}-for-flowlog`,
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
    */
    // S3 Bucket for FlowLogs
    const flowLogsBucket  = new s3.Bucket(this, 'FlowLogsBucket', {
      bucketName: [props.pjName, props.envName,'flowlogs', accountId].join('-') ,
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      // Optional if you want to use CMK
      //encryption: s3.BucketEncryption.KMS,
      //encryptionKey: flowLogKey,
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

    // Gateway 型 VPC エンドポイント
    // VPC Endpoint for S3
    this.vpc.addGatewayEndpoint('S3VPCE',{
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }], // (CDK v2.69 deprecated)PRIVATE_WITH_NAT
    });

  }
}


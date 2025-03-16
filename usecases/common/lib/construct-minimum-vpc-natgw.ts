import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { 
  aws_s3 as s3,
  aws_ec2 as ec2, 
  aws_iam as iam,
  aws_kms as kms,
} from 'aws-cdk-lib';

interface ConstructProps {
  readonly vpcName: string;
  readonly vpcCIDR: string
  /**
   * Define the maximum number of AZs to use in this region
   * @default 2 AZ
   */
  readonly maxAzs?: number;
  /**
   * Define the number of NAT Gateways to use in this region
   * @default 1 NAT Gateway
   */
  readonly natGateways?: number;
  readonly isAutoDeleteObject: boolean;
} 

export class MinimumVpcNatGw extends Construct {
  public readonly vpc: ec2.IVpc;
  constructor(scope: Construct, id: string, props: ConstructProps) {
    super(scope, id);
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // VPC
    this.vpc = new ec2.Vpc(this, 'default', {
      vpcName: props.vpcName,
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
      natGateways: props.natGateways ?? 1,
      natGatewaySubnets: {subnetType: ec2.SubnetType.PUBLIC},
      natGatewayProvider: ec2.NatProvider.gateway(),
      // Security Hub EC2.2
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-2
      restrictDefaultSecurityGroup: true, 
    });

    // Output the NAT Gateway public IP address
    const natIps:string[] = this._getNatgwPublivIp(this.vpc)
    natIps.forEach((ip, i) => {
      new cdk.CfnOutput(this, `natGwPublicIp${i}`, {
          value: ip,
          exportName: `natGwPublicIp${i}`,
      }).node.addDependency(this.vpc);
    });

    // Security Hub EC2.6 
    // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-6
    // FlowLog
    // CMK
    const flowLogKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'for VPC Flow log',
      alias: `${id.toLowerCase()}-for-flowlog`,
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
      bucketName: [id.toLowerCase(),'flowlogs', accountId].join('-') ,
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

  /*
  * Get NAT Gateway public IP address
  * @param vpc: ec2.IVpc
  * @return string[] list of public IP addresses
  */
  private _getNatgwPublivIp = (vpc: ec2.IVpc): string[] => {
    // VPC内のNAT Gatewayを全て取得
    const natgws = vpc.node.findAll().filter(
        (child) => child instanceof ec2.CfnNatGateway
    ) as ec2.CfnNatGateway[];

    // NAT GatewayのallocationIdを取得
    const allocIds = natgws.map(gw => gw.allocationId);

    // Elastic Ipを全て取得
    const eips = vpc.node.findAll().filter(
        (child) => child instanceof ec2.CfnEIP
    ) as ec2.CfnEIP[];

    // NAT Gatewayに付与されているパブリックIPアドレスを取得
    const ips = eips
        .filter(eip => allocIds.includes(eip.attrAllocationId))
        .map(eip => eip.attrPublicIp);

    return ips;
  };

}


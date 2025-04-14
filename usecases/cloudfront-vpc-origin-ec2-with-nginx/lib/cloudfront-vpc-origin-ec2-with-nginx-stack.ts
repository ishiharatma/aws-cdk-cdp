import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_s3 as s3,
  aws_cloudfront as cloudFront,
  aws_cloudfront_origins as origins,
  aws_ec2 as ec2,
  aws_iam as iam,
 } from 'aws-cdk-lib';

interface CloudfrontVpcOriginEc2WithNginxStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly cloudFrontPrefixList?: string;
  readonly apiKey?: string;
  readonly isAutoDeleteObject?: boolean;
}

export class CloudfrontVpcOriginEc2WithNginxStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudfrontVpcOriginEc2WithNginxStackProps) {
    super(scope, id, props);
    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;

    // Create VPC
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      natGateways: 0,
      // subnet
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });
    // Create a security group for EC2 instance
    const ec2SecurityGroup = new ec2.SecurityGroup(this, 'EC2SecurityGroup', {
      securityGroupName: `${id}-ec2-SecurityGroup`,
      vpc: vpc,
      allowAllOutbound: false,
    });
    ec2SecurityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTPS, 'Allow HTTPS access to anywhere');

    ec2SecurityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(8080), 'Allow HTTP(8080) access from within VPC');
    if (props.cloudFrontPrefixList) {
      ec2SecurityGroup.addIngressRule(ec2.Peer.prefixList(props.cloudFrontPrefixList), ec2.Port.tcp(8080), 'Allow HTTP access(8080) from CloudFront');
    }
    
    new cdk.CfnOutput(this, 'EC2SecurityGroupId', {
      value: ec2SecurityGroup.securityGroupId,
    });

    // EC2 Role for Backend
    const backendEC2Role = new iam.Role(this, 'BackendEC2Role',{
      roleName: ['@role', 'backend', 'ec2', props.pjName, props.envName].join('-'),
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSCodeDeployRole'),
      ],
      inlinePolicies: { }
    });
    
    // EC2 KeyPair
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
      // Optional: timezone setting (Asia/Tokyo)
      //'ln -sf /usr/share/zoneinfo/Asia/Tokyo /etc/localtime',
      // Install Docker Engine
      'yum -y install docker',  // Docker Engine パッケージインストール
      'systemctl start docker', // Docker サービス起動
      'systemctl enable docker', // Dockerサービスの自動起動を有効化
      // install Nginx docker
      'docker run --restart=always --name nginx -d -p 8080:80 nginx',
      // clear yum cache
      'yum clean all',
    );

    const nginxInstance = new ec2.Instance(this, 'Instance', {
      vpc,
      instanceName: [props.pjName, props.envName, 'nginx'].join('-') ,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64 //X86_64, 
      }),
      vpcSubnets: { 
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      ssmSessionPermissions: true, // Used by SSM session manager
      userData: userData,
      // Configure IMDSv2 for the NAT instance
      // Security Hub EC2.8
      // https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/ec2-controls.html#ec2-8
      requireImdsv2: true,
      role: backendEC2Role,
      keyPair: keyPair,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true, // AwsSolutions-EC26: The resource creates one or more EBS volumes that have encryption disabled.
            deleteOnTermination: true,
          }),
        },
      ],  
    });

    // CloudFront
    const cloudfront = new cloudFront.Distribution(this, 'CloudFrontVpvOrigin',{
      comment: 'CloudFront with VPC Origin and EC2',
      minimumProtocolVersion: cloudFront.SecurityPolicyProtocol.TLS_V1_2_2021,
      enableIpv6: false,
      defaultBehavior: {
        origin: origins.VpcOrigin.withEc2Instance(nginxInstance,{
          customHeaders: props.apiKey ? {
            'X-api-key': props.apiKey,
          }: undefined,
          keepaliveTimeout: cdk.Duration.seconds(60),
          connectionTimeout: cdk.Duration.seconds(10),
          httpPort: 8080,
          protocolPolicy: cloudFront.OriginProtocolPolicy.HTTP_ONLY,
          originShieldEnabled: true,
          originShieldRegion: region,
        }),
        cachePolicy: cloudFront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudFront.OriginRequestPolicy.ALL_VIEWER,
        allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.ALLOW_ALL,
        compress: true,
      },
    });

  }
}

import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BucketConstruct } from '../../common/lib/construct-bucket';
import * as path from 'path';
import {
  aws_s3 as s3,
  aws_cloudfront as cloudFront,
  aws_cloudfront_origins as origins,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
 } from 'aws-cdk-lib';

interface CloudFrontVPCOaiStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly prefixList?: string;
  readonly isAutoDeleteObject?: boolean;
}

export class CloudfrontVpcOriginAlbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudFrontVPCOaiStackProps) {
    super(scope, id, props);

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
    // create alb securityu group
    const albSg = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: vpc,
      description: 'ALB Security Group',
    });
    if (props.prefixList) {
      // allow alb from prefixList
      albSg.addIngressRule(
        ec2.Peer.prefixList(props.prefixList),
        ec2.Port.tcp(80),
        'Allow ALB from PrefixList'
      );
  }

    // create ALB on Private Subnet
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: vpc,
      internetFacing: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroup: albSg,
    });
    // add Listener
    const listener = alb.addListener('Listener', {
      port: 80,
      open: false,
      defaultAction : elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'CloudFront with VPC Origin and ALB',
      }),
    });
    // CloudFront
    const cloudfront = new cloudFront.Distribution(this, 'CloudFrontVpvOrigin',{
      comment: 'CloudFront with VPC Origin and ALB',
      minimumProtocolVersion: cloudFront.SecurityPolicyProtocol.TLS_V1_2_2021,
      enableIpv6: false,
      defaultBehavior: {
        origin: origins.VpcOrigin.withApplicationLoadBalancer(alb,{}),
        ////originRequestPolicy: cloudFront.OriginRequestPolicy.ALL_VIEWER,
        ////cachePolicy: cloudFront.CachePolicy.CACHING_OPTIMIZED,
        ////allowedMethods: cloudFront.AllowedMethods.ALLOW_GET_HEAD,
      },
    });
  }
}

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_ec2 as ec2, 
} from 'aws-cdk-lib';

interface SiteToSiteSampleStackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly transitGatewayId: string;
  readonly vpnGatewayId: string;
  readonly customerGatewayId: string;
  readonly virtualPrivateGatewayId: string;
}

export class SiteToSiteSampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SiteToSiteSampleStackProps) {
    super(scope, id, props);

    // Site-to-Site VPN Connection
    const vpnConnection = new ec2.CfnVPNConnection(this, 'VPN-Connection', {
      customerGatewayId: props.customerGatewayId,
      vpnGatewayId: props.vpnGatewayId,
      type: 'ipsec.1',
      staticRoutesOnly: true,
    });

    // Output VPN Connection
    new cdk.CfnOutput(this, 'VPNConnection', {
      value: vpnConnection.ref,
      description: 'The ID of the VPN Connection',
    });
  }
}

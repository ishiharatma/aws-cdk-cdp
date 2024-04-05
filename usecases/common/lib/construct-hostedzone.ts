import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { aws_route53 as r53 } from 'aws-cdk-lib';

interface HostedZoneConstructProps {
    readonly pjName: string;
    readonly envName: string;
    readonly zoneName?: string;
    readonly hostedZoneId?: string;
}

export class HostedZoneConstruct extends Construct {
  public readonly hostedZone: r53.IPublicHostedZone;

  constructor(scope: Construct, id: string, props: HostedZoneConstructProps) {
    super(scope, id);

    if (props.zoneName) {
        this.hostedZone = new r53.PublicHostedZone(this, 'Default', {
          zoneName: props.zoneName,
        });
    } else if (props.hostedZoneId) {
        this.hostedZone = r53.PublicHostedZone.fromHostedZoneId(this,'Default',props.hostedZoneId);
    }
  }
}
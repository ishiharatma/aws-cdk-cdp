import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_route53 as route53,
  aws_certificatemanager  as acm,
} from 'aws-cdk-lib';

interface ACMProps {
  readonly pjName: string;
  readonly envName: string;
  readonly domainName: string;
  readonly hostedZoneId: string;
  readonly certificateArn?:string;
}
export class ACMConstruct extends Construct {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: ACMProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    if (props.certificateArn) {
      this.certificate = acm.Certificate.fromCertificateArn(this,'Certificate', props.certificateArn);
    } else if (props.domainName) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        zoneName: props.domainName,
        hostedZoneId: props.hostedZoneId
      });
      
      /* deprecated
      this.certificate = new acm.DnsValidatedCertificate(this, 'certificate', {
        domainName: props.domainName,
        subjectAlternativeNames: [
          "*." + props.domainName
        ],
        hostedZone: hostedZone,
        validation: acm.CertificateValidation.fromDns(hostedZone)
      });
      */
      this.certificate = new acm.Certificate(this, 'Certificate', {
        domainName: props.domainName,
        subjectAlternativeNames: [
          "*." + props.domainName
        ],
        validation: acm.CertificateValidation.fromDns(hostedZone)
      });  
    }

  }
}

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_logs as logs,
} from 'aws-cdk-lib';
interface CloudFrontLoggingS3V2StackProps extends cdk.StackProps {
  readonly pjName: string;
  readonly envName: string;
  /*
    @param distributionId: string;
    @required
  */
    readonly distributionId: string;
    /*
      @param logPrefix?: string;
      @default /{DistributionId}/{yyyy}/{MM}/{dd}/{HH}
    */
    readonly logPrefix?: string;
    /*
      @param HiveCompatiblePath?: boolean;
      @default false
    */
    readonly HiveCompatiblePath?: boolean;
    /*
      @param logsDeliverySourceFormat?:string;
      see: https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_PutDeliveryDestination.html#API_PutDeliveryDestination_RequestSyntax
      @default json
    */
    readonly logsDeliveryDestinationFormat?:string;
    /*
      @param loggingBucketArn: string;
      @required
    */
    readonly loggingBucketArn: string;
}

export class CloudFrontLoggingS3V2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudFrontLoggingS3V2StackProps) {
    super(scope, id, props);
    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;

    // logging v2
    // see: https://docs.aws.amazon.com/ja_jp/ja_jp/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html
    // Logs: Delivery Source
    const logsDeliverySource = new logs.CfnDeliverySource(this, 'LogsDeliverySource', {
      name: `${props.pjName}-${props.envName}-cloudfront-delivery-source`,
      resourceArn: `arn:aws:cloudfront::${accountId}:distribution/${props.distributionId}`,
      logType: 'ACCESS_LOGS'
    });
    // Logs: Delivery Destination
    const logsDeliveryDestination = new logs.CfnDeliveryDestination(this, 'LogsDeliveryDestination', {
      name: `${props.pjName}-${props.envName}-cloudfront-delivery-destination`,
      destinationResourceArn: `${props.loggingBucketArn}`,///AWSLogs/${accountId}/CloudFront`,
      outputFormat: props.logsDeliveryDestinationFormat ?? 'json'
    });
    // Logs: Delivery
    const logsDelivery = new logs.CfnDelivery(this, 'LogsDelivery', {
      deliverySourceName: `${props.pjName}-${props.envName}-cloudfront-delivery-source`,
      deliveryDestinationArn: logsDeliveryDestination.attrArn,
      recordFields: [
        'timestamp', 'DistributionId', 'date', 'time', 'x-edge-location', 
        'sc-bytes', 'c-ip', 'cs-method', 'cs(Host)', 'cs-uri-stem', 
        'sc-status', 'cs(Referer)', 'cs(User-Agent)', 'cs-uri-query', 
        'cs(Cookie)', 'x-edge-result-type', 'x-edge-request-id', 
        'x-host-header', 'cs-protocol', 'cs-bytes', 'time-taken', 
        'x-forwarded-for', 'ssl-protocol', 'ssl-cipher', 
        'x-edge-response-result-type', 'cs-protocol-version', 'fle-status', 
        'fle-encrypted-fields', 'c-port', 'time-to-first-byte', 
        'x-edge-detailed-result-type', 'sc-content-type', 'sc-content-len', 
        'sc-range-start', 'sc-range-end', 'timestamp(ms)', 'origin-fbl', 
        'origin-lbl', 'asn'
      ],
      s3SuffixPath: props.logPrefix ?? '/v2/{DistributionId}/{yyyy}/{MM}/{dd}/{HH}',
      s3EnableHiveCompatiblePath: props.HiveCompatiblePath ?? false
    });
    // 依存関係の設定
    logsDelivery.addDependency(logsDeliverySource);
    logsDelivery.addDependency(logsDeliveryDestination);

  }
}

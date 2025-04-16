import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SubscriptionFilterKDSConstruct } from './constructs/subscription-filter-kds';

export class CwlSubscriptionFiltersKinesisStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // Kinesis Data Stream サブスクリプションフィルター
    new SubscriptionFilterKDSConstruct(this, 'SubscriptionFilterKDSConstruct', {});
  }
}

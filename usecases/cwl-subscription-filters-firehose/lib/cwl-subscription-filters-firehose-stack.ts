import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SubscriptionFilterFirehoseConstruct } from './constructs/subscription-filter-firehose';
export class CwlSubscriptionFiltersFirehoseStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Firehose サブスクリプションフィルター
    new SubscriptionFilterFirehoseConstruct(this, 'SubscriptionFilterFirehoseConstruct', {});
  }
}

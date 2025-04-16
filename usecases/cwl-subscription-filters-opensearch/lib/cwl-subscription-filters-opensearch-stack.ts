import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SubscriptionFilterOpenSearchConstruct } from './constructs/subscription-filter-opensearch';

export class CwlSubscriptionFiltersOpensearchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // OpenSearch Service サブスクリプションフィルター
    new SubscriptionFilterOpenSearchConstruct(this, 'SubscriptionFilterOpenSearchConstruct', {});
    
  }
}

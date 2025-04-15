import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SubscriptionFilterLambdaConstruct } from './constructs/subscription-filter-lambda';
import { SubscriptionFilterKDSConstruct } from './constructs/subscription-filter-kds';
import { SubscriptionFilterFirehoseConstruct } from './constructs/subscription-filter-firehose';
import { SubscriptionFilterOpenSearchConstruct } from './constructs/subscription-filter-opensearch';

interface myStackProps extends cdk.StackProps {

}

export class CwlSubscriptionFiltersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: myStackProps) {
    super(scope, id, props);

    // Lambda サブスクリプションフィルター
    new SubscriptionFilterLambdaConstruct(this, 'SubscriptionFilterLambdaConstruct', {});
    // Kinesis Data Stream サブスクリプションフィルター
    new SubscriptionFilterKDSConstruct(this, 'SubscriptionFilterKDSConstruct', {});
    // Firehose サブスクリプションフィルター
    new SubscriptionFilterFirehoseConstruct(this, 'SubscriptionFilterFirehoseConstruct', {});
    // OpenSearch Service サブスクリプションフィルター
    new SubscriptionFilterOpenSearchConstruct(this, 'SubscriptionFilterOpenSearchConstruct', {});
    
  }
}

import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs_destinations as logsdedestinations,
  aws_opensearchserverless as opensearchserverless,
  aws_logs as logs,
} from 'aws-cdk-lib';
import * as path from 'path';

interface ConstructProps {
}
export class SubscriptionFilterOpenSearchConstruct extends Construct {

  constructor(scope: Construct, id: string, props: ConstructProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // サブスクリプションフィルター for  Amazon OpenSearch Service
    const opensearchLogGroup = new logs.LogGroup(this, 'OpenSearchLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      logGroupName: '/aws/cwl-subscription-filters/opensearch',
    });


//    // OpenSearch Serviceのドメイン名
//    const domainName = 'cwl-subscription-filters-opensearch';
//    // OpenSearch のIAMロール
//    const opensearchRole = new iam.Role(this, 'CwlSubscriptionFiltersOpenSearchRole', {
//      roleName: 'CwlSubscriptionFiltersOpenSearchRole',
//      assumedBy: new iam.ServicePrincipal('logs.amazonaws.com'),
//      managedPolicies: [],
//      inlinePolicies: {
//        'OpenSearchAccess': new iam.PolicyDocument({
//          statements: [
//            new iam.PolicyStatement({
//              effect: iam.Effect.ALLOW,
//              actions: [
//                'aoss:APIAccessAll',
//                'aoss:BatchGetCollection',
//                'aoss:CreateIndex',
//                'aoss:WriteDocument'
//              ],
//              resources: [`arn:aws:aoss:${region}:${accountId}:collection/*`]
//            })
//          ]
//        })
//      },
//    });
//
//    // OpenSearch Serverless
//    const opensearchServerless = new opensearchserverless.CfnCollection(this, 'CwlSubscriptionFiltersOpenSearchServerless', {
//      name: 'CwlSubscriptionFiltersOpenSearchServerless',
//      description: 'CwlSubscriptionFiltersOpenSearchServerless',
//      // see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_opensearchserverless.CfnCollection.html#standbyreplicas
//      standbyReplicas: "DISABLED",
//      // see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_opensearchserverless.CfnCollection.html#type
//      type: 'TIMESERIES',
//    });
//
//    // OpenSearch Serverlessのデータアクセスポリシー
//    const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'OpenSearchServerlessDataAccessPolicy', {
//      name: 'OpenSearchServerlessDataAccessPolicy',
//      description: 'Data access policy for OpenSearch Serverless',
//      policy: JSON.stringify([
//        {
//          Rules: [
//            {
//              ResourceType: 'index',
//              Resource: ['index/*/*'],
//              Permission: ['aoss:CreateIndex', 'aoss:WriteDocument', 'aoss:ReadDocument']
//            }
//          ],
//          Principal: [opensearchRole.roleArn]
//        }
//      ]),
//      type: 'data'
//    });
//
//    // CloudWatchLogsへのサブスクリプションフィルター ERROR または FATAL
//    const subscriptionFilter = new logs.SubscriptionFilter(
//      this,
//      'CwlSubscriptionFilters',
//      {
//        logGroup: opensearchLogGroup,
//        destination: new logs.LogsDestination.fromArn(
//          `arn:aws:logs:${region}:${accountId}:destination:OpenSearchServerlessDestination`
//        ),
//        filterPattern: logs.FilterPattern.any(
//          logs.FilterPattern.stringValue('$.level', '=', 'ERROR'),
//          logs.FilterPattern.stringValue('$.level', '=', 'FATAL')
//        ),
//        filterName: 'CwlSubscriptionFilters',
//      }
//    );
//
//    // 必要な依存関係の設定
//    subscriptionFilter.node.addDependency(opensearchServerless);
//    subscriptionFilter.node.addDependency(dataAccessPolicy);
//    
//    // CloudWatch Logsの送信先を設定するカスタムリソース
//    const createLogDestinationLambda = new lambda.Function(this, 'CreateLogDestinationFunction', {
//      runtime: lambda.Runtime.PYTHON_3_13,
//      handler: 'custom_resource.handler',
//      code: lambda.Code.fromAsset(path.join(__dirname, '../../../common/src/lambda/logs-to-opensearch/python')),
//      environment: {
//        OPENSEARCH_COLLECTION_ENDPOINT: opensearchServerless.attrCollectionEndpoint,
//        ROLE_ARN: opensearchRole.roleArn,
//        AWS_ACCOUNT_ID: accountId,
//      },
//      timeout: cdk.Duration.minutes(5),
//    });
//
//    // ログをOpenSearchに送信するメインのLambda関数
//    const logToOpenSearchLambda = new lambda.Function(this, 'LogToOpenSearchFunction', {
//      runtime: lambda.Runtime.PYTHON_3_13,
//      functionName: 'LogToOpenSearch', // カスタムリソースで参照する名前と一致させる
//      handler: 'index.handler',
//      code: lambda.Code.fromAsset(path.join(__dirname, '../../../common/src/lambda/logs-to-opensearch/python')),
//      environment: {
//        OPENSEARCH_COLLECTION_ENDPOINT: opensearchServerless.attrCollectionEndpoint,
//      },
//      timeout: cdk.Duration.minutes(5),
//    });
//
//    // OpenSearchへのアクセス権限を付与
//    logToOpenSearchLambda.addToRolePolicy(new iam.PolicyStatement({
//      effect: iam.Effect.ALLOW,
//      actions: [
//        'aoss:APIAccessAll',
//        'aoss:BatchGetCollection',
//        'aoss:CreateIndex',
//        'aoss:WriteDocument'
//      ],
//      resources: [`arn:aws:aoss:${region}:${accountId}:collection/*`]
//    }));
//
//    // Lambdaが基本的なCloudWatch Logsを使用できるようにする権限
//    logToOpenSearchLambda.addToRolePolicy(new iam.PolicyStatement({
//      effect: iam.Effect.ALLOW,
//      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
//      resources: [`arn:aws:logs:${region}:${accountId}:*`]
//    }));
//
//    // カスタムリソースの作成
//    const createDestination = new cdk.CustomResource(this, 'CreateLogDestination', {
//      serviceToken: createLogDestinationLambda.functionArn,
//      properties: {
//        DestinationName: 'OpenSearchServerlessDestination',
//        RoleArn: opensearchRole.roleArn,
//        CollectionEndpoint: opensearchServerless.attrCollectionEndpoint,
//      }
//    });
  }
}

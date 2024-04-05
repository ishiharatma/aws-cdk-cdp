import * as cdk from 'aws-cdk-lib';
import {
  aws_iam as iam,
  aws_lamnda as lambda,
  aws_s3_deployment as s3deploy,
  aws_logs_destinations as logsdedestinations,
  aws_events as events,
  aws_events_targets as targets,
  aws_logs as logs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { BucketConstruct } from '../../common/lib/construct-bucket';

export class EcrContinuousScanStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;
    const ecrScanLambdaSrcPath:string = '../../common/src/lambda/ecr-scan-notification/python';
    const ecrContinuousScanSrcPath:string = '../../common/src/lambda/ecr-continuous-scan/python';
    const cWLambdaErrorSubscriptionFilterLambdaFunctionPath:string = '../../common/src/lambda/cloudwatch-lambda-error-subscriptionfilter/python';
    // サブスクリプションフィルター
    const cWLambdaErrorSubscriptionFilterLambdaRole = new iam.Role(this, 'CWLambdaErrorSubscriptionFilterLambdaRole',{
      roleName: ['@role', 'lambda', props.pjName, props.envName, 'ecrscan', 'subscriptionfilter'].join('-'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: { 
        cWLambdaErrorSubscriptionFilter: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions:[
              "logs:Get*",
              "sns:Publish",
            ],
            resources: ["*"],
          }),
         ]
      })}
    });
    const cWLambdaErrorSubscriptionFilterLambdaFunction = new lambda.Function(
      this,
      'cWLambdaErrorSubscriptionFilterLambdaFunction',
      {
        functionName: `${props.pjName}-${props.envName}-ecrscan-cw-subscriptionfilter`,
        code: lambda.Code.fromAsset(
          path.join(__dirname, cWLambdaErrorSubscriptionFilterLambdaFunctionPath)
        ),
        handler: 'index.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_9,
        timeout: cdk.Duration.seconds(30),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          PROJECT_NAME: props.pjName,
          ENV_NAME: props.envName,
          TOPIC_ARNS: props.snsARTopicArn,
          LOG_LEVEL: props.lambdaLogLevel,
        },
        role: cWLambdaErrorSubscriptionFilterLambdaRole,
        tracing: lambda.Tracing.ACTIVE,
      }
    );
    cWLambdaErrorSubscriptionFilterLambdaFunction.addPermission('cWLambdaErrorSubscriptionFilterLambdaFunctionEventPermisson',{
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });
    cWLambdaErrorSubscriptionFilterLambdaFunction.addPermission('cWLambdaErrorSubscriptionFilterLambdaFunctionPermisson',{
      principal: new iam.ServicePrincipal('logs.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:logs:${region}:${accountId}:log-group:*:*`,
      sourceAccount: accountId,
    });
    //////////////////////////////////////////////////////////////////
    // ECRスキャン時の通知
    //////////////////////////////////////////////////////////////////
    const ecrScanFunctionRole = new iam.Role(this, 'EcrScanFunctionRole',{
      roleName: ['@role', 'lambda', props.pjName, props.envName, 'ecrscan'].join('-'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: { 
        scrScan: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions:[
              "ecr:DescribeImages",
              "sns:Publish",
            ],
            resources: ["*"],
          }),
         ]
      })}
    });
    const ecrScanLambdaFunction = new lambda.Function(
      this,
      'ecrScanFunction',
      {
        functionName: `${props.pjName}-${props.envName}-ecr-scan-notification`,
        code: lambda.Code.fromAsset(
          path.join(__dirname, ecrScanLambdaSrcPath)
        ),
        handler: 'index.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_9,
        timeout: cdk.Duration.seconds(30),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          PROJECT_NAME: props.pjName,
          ENV_NAME: props.envName,
          TOPIC_ARN: props.snsNoticeTopicArn,
          LOG_LEVEL: props.lambdaLogLevel,
        },
        role: ecrScanFunctionRole,
        tracing: lambda.Tracing.ACTIVE,
      }
    );
    const ecrScanEvent = new events.Rule(this, 'ecrScanEvent', {
      enabled: true,
      eventPattern: {
        source : [
          "aws.ecr"
        ],
        detailType: [
          "ECR Image Scan"
        ]
      },
    })
    ecrScanEvent.addTarget(new targets.LambdaFunction(ecrScanLambdaFunction));
    // エラー検知用
    ecrScanLambdaFunction.logGroup.addSubscriptionFilter('EcrScanLambdaFunctionSubscriptionFilter',{
      destination: new logsdedestinations.LambdaDestination(cWLambdaErrorSubscriptionFilterLambdaFunction),
      filterPattern: logs.FilterPattern.literal('"[ERROR]"'),
    });
    //////////////////////////////////////////////////////////////////
    // ECR の定期スキャン
    //////////////////////////////////////////////////////////////////
    // スキャン定義JSON格納用バケット
    const ecrContinuousScanConfigS3 = new BucketConstruct(this,'configS3',{
      pjName: '',
      envName: '',
      bucketPrefix: ['ecr','continuous','scan','config'].join('.') ,
      
    });
    // スキャン定義ファイル
    const configJson = [
      {
          "region": region,
          "registry": accountId,
          "repository": `${props.pjName}-${props.envName}/keycloak`,
          "tags": [
              "latest"
          ]
      },
      {
          "region": region,
          "registry": accountId,
          "repository": `${props.pjName}-${props.envName}/backend`,
          "tags": [
              "latest"
          ]
      }
    ];
    
    // JSON ファイルをアップロード
    new s3deploy.BucketDeployment(this, 'EcrContinuousScanConfigJson', {
      sources: [
        s3deploy.Source.data(`${props.envName}.json`, JSON.stringify(configJson))
      ],
      destinationBucket: ecrContinuousScanConfigS3,
    });
    const ecrContinuousScanFunctionRole = new iam.Role(this, 'EcrContinuousScanFunctionRole',{
      roleName: ['@role', 'lambda', props.pjName, props.envName, 'ecr', 'continuous', 'scan'].join('-'),
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: { 
        ecrScan: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions:[
              "ecr:DescribeImages",
              "ecr:DescribeImageScanFindings",
              "ecr:ListImages",
              "ecr:StartImageScan",
              "s3:Get*",
              "sns:Publish",
            ],
            resources: ["*"],
          }),
         ]
      })}
    });
    const ecrContinuousScanLambdaFunction = new lambda.Function(
      this,
      'ecrContinuousScanFunction',
      {
        functionName: `${props.pjName}-${props.envName}-ecr-continuous-scan`,
        code: lambda.Code.fromAsset(
          path.join(__dirname, ecrContinuousScanSrcPath)
        ),
        handler: 'index.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_9,
        timeout: cdk.Duration.seconds(600),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          BUCKET_NAME: ecrContinuousScanConfigS3.bucket.bucketName,
          OBJECT_KEY_NAME: `${props.envName}.json`,
          LOG_LEVEL: props.lambdaLogLevel,
        },
        role: ecrContinuousScanFunctionRole,
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // 定期起動のイベント
    const ecrContinuousScanEventRule = new events.Rule(this, 'EcrContinuousScanEventRule', {
      schedule: events.Schedule.cron(
        //{minute: '0', hour:'0', weekDay: 'MON' ,month: '*', year: '*'} // テスト用:dayとweekDayは両方指定不可。省略すると"?"が自動で設定される
        {minute: '0', hour:'0', day: '1' ,month: '*', year: '*'}
      ),
      //description: 'ECR Container Image Re-Scan. Run at 9:00 (JST) every Monday.(test)',
      description: 'ECR Container Image Re-Scan. Run at 9:00 (JST) every 1st day of the month',
    });
    ecrContinuousScanEventRule.addTarget(new targets.LambdaFunction(ecrContinuousScanLambdaFunction));

    // エラー検知用
    ecrContinuousScanLambdaFunction.logGroup.addSubscriptionFilter('EcrContinuousScanLambdaFunctionSubscriptionFilter',{
      destination: new logsdedestinations.LambdaDestination(cWLambdaErrorSubscriptionFilterLambdaFunction),
      filterPattern: logs.FilterPattern.literal('"[ERROR]"'),
    });
  }
}

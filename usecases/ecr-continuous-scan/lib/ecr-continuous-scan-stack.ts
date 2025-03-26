import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import {
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3_deployment as s3deploy,
  aws_logs_destinations as logsdedestinations,
  aws_events as events,
  aws_events_targets as targets,
  aws_logs as logs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { BucketConstruct } from '../../common/lib/construct-bucket';

import * as interfaceDef from '../../common/interface/index';

interface EcrContinuousScanStackProps extends StackProps {
  input: interfaceDef.EcrContinuousScanStackProps;
}
export class EcrContinuousScanStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcrContinuousScanStackProps) {
    super(scope, id, props);
    const accountId:string = cdk.Stack.of(this).account;
    const region:string = cdk.Stack.of(this).region;
    const defaultLambdaLogLevel:string = 'INFO';
    const defaultLambdaTimeoutSeconds:number = 30;
    const ecrScanLambdaSrcPath:string = '../../common/src/lambda/ecr-scan-notification/python';
    const ecrContinuousScanSrcPath:string = '../../common/src/lambda/ecr-continuous-scan/python';
    const cWLambdaErrorSubscriptionFilterLambdaFunctionPath:string = '../../common/src/lambda/cloudwatch-lambda-error-subscriptionfilter/python';
    // サブスクリプションフィルター
    const cWLambdaErrorSubscriptionFilterLambdaRole = new iam.Role(this, 'CWLambdaErrorSubscriptionFilterLambdaRole',{
      roleName: ['@role', 'lambda', props.input.pjName, props.input.envName, 'ecrscan', 'subscriptionfilter'].join('-'),
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
        functionName: `${props.input.pjName}-${props.input.envName}-ecrscan-cw-subscriptionfilter`,
        code: lambda.Code.fromAsset(
          path.join(__dirname, cWLambdaErrorSubscriptionFilterLambdaFunctionPath)
        ),
        handler: 'index.lambda_handler',
        runtime: props.input.lambdaRuntime ?? lambda.Runtime.PYTHON_3_11,
        timeout: cdk.Duration.seconds(defaultLambdaTimeoutSeconds),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          PROJECT_NAME: props.input.pjName,
          ENV_NAME: props.input.envName,
          TOPIC_ARNS: props.input.notificationTopicArn,
          LOG_LEVEL: props.input.lambdaLogLevel ?? defaultLambdaLogLevel,
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
      roleName: ['@role', 'lambda', props.input.pjName, props.input.envName, 'ecrscan'].join('-'),
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
        functionName: `${props.input.pjName}-${props.input.envName}-ecr-scan-notification`,
        code: lambda.Code.fromAsset(
          path.join(__dirname, ecrScanLambdaSrcPath)
        ),
        handler: 'index.lambda_handler',
        runtime: props.input.lambdaRuntime ?? lambda.Runtime.PYTHON_3_11,
        timeout: cdk.Duration.seconds(defaultLambdaTimeoutSeconds),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          PROJECT_NAME: props.input.pjName,
          ENV_NAME: props.input.envName,
          TOPIC_ARN: props.input.notificationTopicArn,
          LOG_LEVEL: props.input.lambdaLogLevel ?? defaultLambdaLogLevel,
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
      pjName: props.input.pjName,
      envName: props.input.envName,
      bucketPrefix: ['ecr','continuous','scan','config'].join('.') ,
      contentsPath: path.join(__dirname, `../parameters/${props.input.envName}`),
      isAutoDeleteObject: props.input.isAutoDeleteObject,
    });
    // スキャン定義ファイル
    // 動的に作成する場合は上記contentsPathを使わずに下記
    /*
    const configJson = [
      {
          "region": region,
          "registry": accountId,
          "repository": `${props.input.pjName}-${props.input.envName}/foo`,
          "tags": [
              "latest"
          ]
      },
      {
          "region": region,
          "registry": accountId,
          "repository": `${props.input.pjName}-${props.input.envName}/bar`,
          "tags": [
              "latest"
          ]
      }
    ];
    // JSON ファイルをアップロード
    new s3deploy.BucketDeployment(this, 'EcrContinuousScanConfigJson', {
      sources: [
        s3deploy.Source.data(`${props.input.envName}.json`, JSON.stringify(configJson))
      ],
      destinationBucket: ecrContinuousScanConfigS3.bucket,
    });
    */
    
    const ecrContinuousScanFunctionRole = new iam.Role(this, 'EcrContinuousScanFunctionRole',{
      roleName: ['@role', 'lambda', props.input.pjName, props.input.envName, 'ecr', 'continuous', 'scan'].join('-'),
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
        functionName: `${props.input.pjName}-${props.input.envName}-ecr-continuous-scan`,
        code: lambda.Code.fromAsset(
          path.join(__dirname, ecrContinuousScanSrcPath)
        ),
        handler: 'index.lambda_handler',
        runtime: props.input.lambdaRuntime ?? lambda.Runtime.PYTHON_3_11,
        timeout: cdk.Duration.seconds(600),
        architecture: lambda.Architecture.ARM_64,
        environment: {
          BUCKET_NAME: ecrContinuousScanConfigS3.bucket.bucketName,
          OBJECT_KEY_NAME: `${props.input.envName}.json`,
          LOG_LEVEL: props.input.lambdaLogLevel ?? defaultLambdaLogLevel,
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

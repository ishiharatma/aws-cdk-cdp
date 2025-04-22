import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SubscriptionFilterLambda } from '../lib/constructs/subsription-filter-lambda';

describe('SubscriptionFilterLambda', () => {
  let app: App;
  let stack: Stack;
  let template: Template;

  beforeEach(() => {
    // GIVEN
    app = new App();
    stack = new Stack(app, 'TestStack');
    
    // サブスクリプションフィルターLambdaをスタックに追加
    new SubscriptionFilterLambda(stack, 'SubscriptionFilterLambda', {
        subscriptionSNSTopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:TestTopic',
        alarmSNSTopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:TestTopic',
        lambdaLogLevel: 'INFO',
    });
    
    // WHEN
    template = Template.fromStack(stack);
  });

  test('Lambda関数が作成されていること', () => {
    // THEN
    template.resourceCountIs('AWS::Lambda::Function', 1);
  });

  test('Lambda関数が正しく設定されていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.13',
      Timeout: 60,
      Environment: {
        Variables: {
          SNS_TOPIC_ARN: 'arn:aws:sns:ap-northeast-1:123456789012:TestTopic',
        },
      },
      LoggingConfig: {
        LogFormat: 'JSON',
        ApplicationLogLevel: 'INFO',
      },
    });
  });

  test('CloudWatch Alarmが2つ（エラーと実行時間）作成されていること', () => {
    // THEN
    template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
  });

  test('エラー用CloudWatch Alarmが正しく設定されていること', () => {
    // THEN
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      EvaluationPeriods: 1,
      Threshold: 1,
      TreatMissingData: 'notBreaching',
      AlarmDescription: Match.stringLikeRegexp('.*subscription filter Lambda function throws errors.*'),
    });
  });

  test('実行時間用CloudWatch Alarmが正しく設定されていること', () => {
    // THEN
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 3,
      Threshold: 50000,
      TreatMissingData: 'notBreaching',
      AlarmDescription: Match.stringLikeRegexp('.*subscription filter Lambda function duration is high.*'),
    });
  });

  test('両方のAlarmにSNSアクションが設定されていること', () => {
    // SNSアクションの設定を確認
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmActions: Match.arrayWith([
        Match.objectLike({
          'Fn::Join': Match.arrayWith([
            Match.arrayWith([
              'arn:',
              Match.objectLike({}),
              ':cloudwatch-alarm:',
              Match.objectLike({}),
              ':alarm:action/sns/',
              Match.anyValue()
            ])
          ])
        })
      ]),
    });

    // OK Actionの設定も確認
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      OKActions: Match.arrayWith([
        Match.objectLike({
          'Fn::Join': Match.arrayWith([
            Match.arrayWith([
              'arn:',
              Match.objectLike({}),
              ':cloudwatch-alarm:',
              Match.objectLike({}),
              ':alarm:action/sns/',
              Match.anyValue()
            ])
          ])
        })
      ]),
    });
  });

  test('Lambda関数のIAMロールにSNS発行権限が含まれていること', () => {
    // THEN
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
          },
        ],
      },
      ManagedPolicyArns: Match.arrayWith([
        {
          'Fn::Join': Match.arrayWith([
            Match.arrayWith([
              'arn:',
              Match.objectLike({}),
              ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            ])
          ])
        }
      ]),
      Policies: Match.arrayWith([
        {
          PolicyName: 'SnsPublishPolicy',
          PolicyDocument: {
            Statement: [
              {
                Action: 'sns:Publish',
                Effect: 'Allow',
                Resource: 'arn:aws:sns:ap-northeast-1:123456789012:TestTopic',
              },
            ],
          },
        },
      ]),
    });
  });

  test('Lambda関数に関連するロググループが作成されていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 7,
    });
  });

  test('メトリクス設定が正しいこと', () => {
    // エラーメトリクスの期間設定
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'Errors',
      Period: 300, // 5分 = 300秒
      Statistic: 'Sum',
    });

    // 実行時間メトリクスの期間設定
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'Duration',
      Period: 300, // 5分 = 300秒
      Statistic: 'p90',
    });
  });
});
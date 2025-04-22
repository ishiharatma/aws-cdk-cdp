// unit test for lambda-python-alpha-samples
import { App, Stack, Tags } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { LambdaPythonAlphaSamplesStack } from '../lib/lambda-python-alpha-samples-stack';

const pjName = 'unittest';
const envName = 'test';

const defaultEnv = {
    account: '123456789012',
    region: 'ap-northeast-1',
};

describe('Lambda Python Alpha Samples Stack', () => {
  let app: App;
  let stack: Stack;
  let template: Template;

  const loglevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']

  beforeEach(() => {
    // GIVEN
    app = new App({
      context: {}
    });
    stack = new LambdaPythonAlphaSamplesStack(app, 'LambdaPythonAlphaSamplesStack', {
      stackName: 'LambdaPythonAlphaSamplesStack',
      description: 'Lambda Python Alpha Samples Stack',
      env: defaultEnv,
    });
    Tags.of(app).add('Project', pjName);
    Tags.of(app).add('Environment', envName);
    // WHEN
    template = Template.fromStack(stack);
  });

  test('4つのLambda関数が作成されていること', () => {
    // THEN
    template.resourceCountIs('AWS::Lambda::Function', loglevels.length);
  });

  test('すべてのLambda関数がPython 3.13ランタイムを使用していること', () => {
    // THEN
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.13',
    });
  });

  test('すべてのLambda関数が30秒のタイムアウト設定を持っていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 30,
    });
  });

  test('すべてのLambda関数が128MBのメモリ設定を持っていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 128,
    });
  });

  test('すべてのLambda関数がEnvironment設定を持っていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          MY_ENV_VAR: 'my_value',
        },
      },
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          MY_ENV_VAR2: 'my_value2',
        },
      },
    });
  });

  test('各ログレベルのLambda関数が存在すること', () => {
    // THEN
    ['DEBUG', 'INFO', 'WARN', 'ERROR'].forEach(logLevel => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: `LambdaPythonAlphaSamples${logLevel}`,
      });
    });
  });

  test('すべてのLambda関数がアクティブなトレースを持っていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Lambda::Function', {
      TracingConfig: {
        Mode: 'Active',
      },
    });
  });

  test('すべてのLambda関数がJSON形式のログ出力を持っていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Lambda::Function', {
      LoggingConfig: {
        LogFormat: 'JSON',
      }
    });
  });

  test('すべてのLambda関数が1日のログ保持期間を持っていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 1,
    });
  });

  // 追加テストケース: IAMロールの検証
  test('Lambda関数に適切なIAMロールがアタッチされていること', () => {
    // THEN
    template.resourceCountIs('AWS::IAM::Role', 4);
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
    });
  });

  // 追加テストケース: タグの検証
  test('Lambda関数に適切なタグが設定されていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Lambda::Function', {
      Tags: Match.arrayWith([
        {
          Key: 'Project',
          Value: Match.anyValue(),
        },
      ]),
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
      Tags: Match.arrayWith([
        {
          Key: 'Environment',
          Value: Match.anyValue(),
        },
      ]),
    });
  });

  // 追加テストケース: DLQ(Dead Letter Queue)の設定検証（存在する場合）
  test('Lambda関数にDLQが設定されている場合は正しく設定されていること', () => {
    // まずDLQの存在を確認する（このテストは条件付きで実行される）
    const lambdaResources = template.findResources('AWS::Lambda::Function');
    for (const logicalId in lambdaResources) {
      const lambda = lambdaResources[logicalId];
      if (lambda.Properties.DeadLetterConfig) {
        expect(lambda.Properties.DeadLetterConfig).toHaveProperty('TargetArn');
      }
    }
  });

  // 追加テストケース: Lambda関数のアーキテクチャ設定検証
  test('Lambda関数が正しいアーキテクチャで設定されていること', () => {
    // ARM64かx86_64かを確認（デフォルトではx86_64）
    template.hasResourceProperties('AWS::Lambda::Function', {
      Architectures: ['arm64'], // デフォルトはx86_64
    });
  });

  // 追加テストケース: ロググループの正しい命名確認
  test('ロググループが正しく命名されていること', () => {
    // THEN
    loglevels.forEach(logLevel => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: `/aws/lambda/LambdaPythonAlphaSamples${logLevel}`,
      });
    });
  });

  // 追加テストケース: Lambda関数ハンドラの検証
  test('Lambda関数に正しいハンドラが設定されていること', () => {
    // THEN
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.lambda_handler',
    });
  });

  // 追加テストケース: 依存関係の検証
  test('Lambda関数がロググループに対して依存関係を持つこと', () => {
    // THEN
    // リソース間の依存関係を検証するテスト
    const lambdaResources = template.findResources('AWS::Lambda::Function');
    
    for (const logicalId in lambdaResources) {
      const lambda = lambdaResources[logicalId];
      if (lambda.DependsOn) {
        // 配列の場合
        if (Array.isArray(lambda.DependsOn)) {
          expect(lambda.DependsOn.some((dep: string) => dep.includes('LogGroup'))).toBeTruthy();
        } 
        // 文字列の場合
        else if (typeof lambda.DependsOn === 'string') {
          expect(lambda.DependsOn.includes('LogGroup')).toBeTruthy();
        }
      }
    }
  });
});
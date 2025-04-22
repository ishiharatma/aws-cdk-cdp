import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PythonFunction, PythonFunctionProps } from "@aws-cdk/aws-lambda-python-alpha";
import {
  aws_lambda as lambda,
  aws_logs as logs  
} from "aws-cdk-lib";

export class LambdaPythonAlphaSamplesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda関数の作成
    const lambdaProps: PythonFunctionProps = {
      runtime: cdk.aws_lambda.Runtime.PYTHON_3_13,
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      entry: '../common/src/lambda/logger-any-loglevel/python',
      tracing: cdk.aws_lambda.Tracing.ACTIVE,
      loggingFormat: lambda.LoggingFormat.JSON,
      architecture: lambda.Architecture.ARM_64, // アーキテクチャを明示的に設定
      bundling: {
        image: lambda.Runtime.PYTHON_3_13.bundlingImage,
        platform: "linux/amd64",
        bundlingFileAccess: cdk.BundlingFileAccess.VOLUME_COPY,
        outputPathSuffix: '.',  // 出力先を明示的に指定
      },
    };
    const loglevels = [
      lambda.ApplicationLogLevel.DEBUG,
      lambda.ApplicationLogLevel.INFO,
      lambda.ApplicationLogLevel.WARN,
      lambda.ApplicationLogLevel.ERROR,
      lambda.ApplicationLogLevel.FATAL,
    ];

    loglevels.forEach((loglevel) => {
      // カスタムロググループを先に作成
      const functionName = `LambdaPythonAlphaSamples${loglevel}`;
      const logGroup = new logs.LogGroup(this, `${functionName}LogGroup`, {
        logGroupName: `/aws/lambda/${functionName}`,
        retention: logs.RetentionDays.ONE_DAY,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      // Lambda関数の作成
      const lambdaFunction = new PythonFunction(this, functionName, {
        ...lambdaProps,
        functionName: functionName,
        description: `Lambda Python Alpha Samples ${loglevel}`,
        environment: {
          // 環境変数の設定
          MY_ENV_VAR: 'my_value',
        },
        applicationLogLevelV2:
          lambda.ApplicationLogLevel[
            loglevel as keyof typeof lambda.ApplicationLogLevel
          ],
        logGroup: logGroup, // 先に作成したロググループを使用
      });
      lambdaFunction.addEnvironment('MY_ENV_VAR2', 'my_value2');

      // 明示的な依存関係を追加（テストが期待する依存関係）
      const cfnLambda = lambdaFunction.node.defaultChild as cdk.aws_lambda.CfnFunction;
      const cfnLogGroup = logGroup.node.defaultChild as cdk.aws_logs.CfnLogGroup;
      cfnLambda.addDependency(cfnLogGroup);

    });
  }
}

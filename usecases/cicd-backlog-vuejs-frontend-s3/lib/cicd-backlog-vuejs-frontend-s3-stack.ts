import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import {
  aws_s3 as s3,
  aws_lambda as lambda,
  aws_apigateway as apigw,
  aws_iam as iam,
  aws_codedeploy as codedeploy,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_codebuild as codebuild,
 } from 'aws-cdk-lib';

interface CicdBacklogVuejsFrontendS3StackProps extends StackProps {
  readonly pjName: string;
  readonly envName: string;
  readonly repositoryName: string;
  readonly branchName: string;
  readonly allowedIps?: string[];
  readonly websiteBucketName?: string;
  readonly distributionId?: string;
  readonly isAutoDeleteObject?: boolean;
}


export class CicdBacklogVuejsFrontendS3Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CicdBacklogVuejsFrontendS3StackProps) {
    super(scope, id, props);

    const accountId = cdk.Stack.of(this).account;

    // Create Source S3 bucket
    const bucketName = `${props.pjName}-${props.envName}-source-s3-${accountId}`;
    const bucket = new s3.Bucket(this, bucketName, {
      bucketName: bucketName,
      removalPolicy: props.isAutoDeleteObject ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: props.isAutoDeleteObject,
    });

    // Lambda function name
    const gitCloneFunctionName = `${props.pjName}-${props.envName}-git-clone-lambda-${accountId}`;

    // create lambda Iam Role and policy
    const lambdaRole = new iam.Role(this, `${gitCloneFunctionName}-lambda-role`, {
      roleName: `${gitCloneFunctionName}-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    lambdaRole.attachInlinePolicy(new iam.Policy(this, `${gitCloneFunctionName}-lambda-policy`, {
      policyName: `${gitCloneFunctionName}-policy`,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: [
            `arn:aws:logs:${cdk.Stack.of(this).region}:${accountId}:log-group:/aws/lambda/${props.pjName}-${props.envName}-*`,
          ],
        }),
      ],
    }));
    // attach policy to lambda role for s3
    lambdaRole.attachInlinePolicy(new iam.Policy(this, `${gitCloneFunctionName}-s3-policy`, {
      policyName: `${gitCloneFunctionName}-s3-policy`,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:ListBucket',
          ],
          resources: [
            bucket.bucketArn,
            `${bucket.bucketArn}/*`,
          ],
        }),
      ],
    }));  

    // Create Lambda function for git clone
    const pipelineName = `${props.pjName}-${props.envName}-pipeline`;
    const gitCloneFunctionPath = path.join(__dirname, '../src/lambda/backlog-git-clone/python');
    const gitCloneFunction = new lambda.Function(this, gitCloneFunctionName, {
      functionName: gitCloneFunctionName,
      description: 'git clone lambda function for s3',
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      timeout: cdk.Duration.seconds(300),
      memorySize: 1024,
      role: lambdaRole,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(gitCloneFunctionPath),
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(this, 'LambdaLayer', `arn:aws:lambda:ap-northeast-1:${accountId}:layer:dulwich-layer:2`),
      ],
      environment: {
        BUCKET_NAME: bucket.bucketName,
        REPOSITORY: props.repositoryName,
        BRANCH: props.branchName,
        ZIP_FILE_NAME: "source",
        USER: "",
        PASS: "",
        PIPELINE_NAME: pipelineName,
      },
    });

    // Create API Gateway for Lambda
    const api = new apigw.LambdaRestApi(this, 'GitCloneApi', {
      restApiName: 'GitCloneApi',
      description: 'This service is for git clone',
      handler: gitCloneFunction,
      deployOptions: {
        stageName: 'dev',
      },
      policy: props.allowedIps ? new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*/*/*'], // ステージ作成前なのでワイルドカードを使用
            conditions: {
              'NotIpAddress': {
                'aws:SourceIp': props.allowedIps,
              },
            },
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*/*/*'],
          }),
        ],
      }) : undefined,
    });
    // add resource /backlog-webhook
    // https://[API_ID].execute-api.[REGION].amazonaws.com/dev/backlog-git-webhook
    const webhook = api.root.addResource('backlog-git-webhook');
    // add method POST
    webhook.addMethod('POST');

    // output api url
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });

    // 静的ウェブサイトのバケット
    let websiteBucket: s3.IBucket;
    if (props.websiteBucketName) {
      // 既存のウェブサイトバケットを参照
      websiteBucket = s3.Bucket.fromBucketName(this, 'ExistingWebsiteBucket', props.websiteBucketName);
    } else {
      // 新しいウェブサイトバケットを作成
      const websiteBucketName = `${props.pjName}-${props.envName}-website-${accountId}`;
      websiteBucket = new s3.Bucket(this, websiteBucketName, {
        bucketName: websiteBucketName,
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'index.html',
        publicReadAccess: true,
        removalPolicy: props.isAutoDeleteObject ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
        autoDeleteObjects: props.isAutoDeleteObject,
        cors: [
          {
            allowedMethods: [
              s3.HttpMethods.GET,
              s3.HttpMethods.HEAD,
            ],
            allowedOrigins: ['*'],
            allowedHeaders: ['*'],
          },
        ],
      });
    }

    // パイプラインの変数定義を作成
    const repositoryNameVar = new codepipeline.Variable({
      variableName: 'REPOSITORY_NAME',
      description: 'The name of the repository',
      defaultValue: props.repositoryName || '',
    });
    const branchNameVar = new codepipeline.Variable({
      variableName: 'BRANCH_NAME',
      description: 'The branch name of the repository',
      defaultValue: props.branchName || '',
    });
    const commitIdVar = new codepipeline.Variable({
      variableName: 'COMMIT_ID',
      description: 'The commit ID of the repository',
      defaultValue:'',
    });

    // Create CodePipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: pipelineName,
      pipelineType: codepipeline.PipelineType.V2,
      restartExecutionOnUpdate: true,
      variables: [repositoryNameVar, branchNameVar, commitIdVar],
    });

    // Source stage
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const sourceAction = new codepipeline_actions.S3SourceAction({
      actionName: 'S3Source',
      bucket: bucket,
      bucketKey: 'source.zip',
      output: sourceOutput,
      trigger: codepipeline_actions.S3Trigger.NONE, // Webhook Lambda から手動でトリガー
    });
    // Add stages to pipeline
    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // Create CodeBuild project
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: `${props.pjName}-${props.envName}-build`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_4,
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.CUSTOM),
//      buildSpec: codebuild.BuildSpec.fromObject({
//        version: '0.2',
//        phases: {
//          install: {
//            'runtime-versions': {
//              nodejs: '18',
//            },
//            commands: [
//              'echo Installing dependencies...',
//              'npm install',
//            ],
//          },
//          build: {
//            commands: [
//              'echo Building Vue.js application...',
//              'npm run build',
//            ],
//          },
//          post_build: {
//            commands: [
//              'echo Build completed successfully',
//            ],
//          },
//        },
//        artifacts: {
//          'base-directory': 'dist',
//          files: [
//            '**/*',
//          ],
//        },
//      }),
    });

    // Build stage
    const buildOutput = new codepipeline.Artifact('BuildOutput');
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });
    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    // Deploy stage
    const deployAction = new codepipeline_actions.S3DeployAction({
      actionName: 'PublishAssets',
      bucket: websiteBucket,
      input: buildOutput,
      accessControl: s3.BucketAccessControl.PUBLIC_READ,
      extract: true,
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [deployAction],
    });

    // Add permissions for pipeline to access S3 bucket
    bucket.grantRead(pipeline.role);
    websiteBucket.grantWrite(pipeline.role);

    // Cleanup S3 buclet
    const cleanupFunctionName = `${props.pjName}-${props.envName}-cleanup-lambda-${accountId}`;
    const lambdaRoleCleanup = new iam.Role(this, `${cleanupFunctionName}-lambda-role`, {
      roleName: `${cleanupFunctionName}-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });    
    lambdaRoleCleanup.attachInlinePolicy(new iam.Policy(this, `${cleanupFunctionName}-lambda-policy`, {
      policyName: `${cleanupFunctionName}-policy`,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: [
            `arn:aws:logs:${cdk.Stack.of(this).region}:${accountId}:log-group:/aws/lambda/${props.pjName}-${props.envName}-*`,
          ],
        }),
      ],
    })); 
    lambdaRoleCleanup.attachInlinePolicy(new iam.Policy(this, `${cleanupFunctionName}-s3-policy`, {
      policyName: `${cleanupFunctionName}-s3-policy`,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:DeleteObject',
            's3:DeleteBucket',
          ],
          resources: [
            bucket.bucketArn,
            `${bucket.bucketArn}/*`,
          ],
        }),
      ],
    }));
    const cleanupFunctionPath = path.join(__dirname, '../src/lambda/cleanup/python');
    const cleanupFunction = new lambda.Function(this, cleanupFunctionName, {
      functionName: cleanupFunctionName,
      description: 'cleanup lambda function for s3',
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      role: lambdaRoleCleanup,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(cleanupFunctionPath),
      environment: {
        BUCKET_NAME: bucket.bucketName,
      },
    });
    pipeline.addStage({
      stageName: 'Cleanup',
      actions: [
        new codepipeline_actions.LambdaInvokeAction({
          actionName: 'Cleanup',
          lambda: cleanupFunction,
          userParameters: {
            BUCKET_NAME: bucket.bucketName,
          },
        }),
      ],
    });

    // CloudFront Cache Invalidation
    if (!props.distributionId) {
      const cloudFrontInvalidationFunctionName = `${props.pjName}-${props.envName}-cloudfront-invalidation-lambda-${accountId}`;
      const cloudFrontInvalidationFunction = new lambda.Function(this, cloudFrontInvalidationFunctionName, {
        functionName: cloudFrontInvalidationFunctionName,
        description: 'CloudFront Cache Invalidation Lambda',
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: 'index.lambda_handler',
        timeout: cdk.Duration.seconds(300),
        memorySize: 1024,
        role: lambdaRole,
        code: lambda.Code.fromAsset(path.join(__dirname, '../src/lambda/cloudfront-invalidation/python')),
        environment: {
          DISTRIBUTION_ID: '',
        },
      });
      cloudFrontInvalidationFunction.addPermission('CloudFrontInvalidationPermission', {
        principal: new iam.ServicePrincipal('lambda.amazonaws.com'),
        sourceArn: websiteBucket.bucketArn,
      });
      pipeline.addStage({
        stageName: 'CloudFrontInvalidation',
        actions: [
          new codepipeline_actions.LambdaInvokeAction({
            actionName: 'CloudFrontInvalidation',
            lambda: cloudFrontInvalidationFunction,
            userParameters: {
              DISTRIBUTION_ID: websiteBucket.bucketArn,
            },
          }),
        ],
      });
      cloudFrontInvalidationFunction.addEnvironment('DISTRIBUTION_ID', props.distributionId!);
    }
    // Add permissions for lambda to trigger pipeline
    const pipelineExecutionPolicy = new iam.Policy(this, 'PipelineExecutionPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'codepipeline:StartPipelineExecution',
          ],
          resources: [
            pipeline.pipelineArn,
          ],
        }),
      ],
    });
    lambdaRole.attachInlinePolicy(pipelineExecutionPolicy);

    // Update Lambda environment variables to include pipeline information
    gitCloneFunction.addEnvironment('PIPELINE_NAME', pipeline.pipelineName);
    gitCloneFunction.addEnvironment('ZIP_FILE_NAME', 'source.zip');

  }
}

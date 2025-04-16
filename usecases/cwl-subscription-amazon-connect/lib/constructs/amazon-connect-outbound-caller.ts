import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import { kebabCase, pascalCase } from "change-case-commonjs";
import { Construct } from "constructs";
import * as path from "path";

export interface AmazonConnectProps {
  /*
    * Amazon Connectインスタンスのエイリアス名
    */
  readonly instanceId: string;
  /*
   * Amazon ConnectのコンタクトフローID
   */
  readonly contactFlowId: string;
  /*
   * 架電元電話番号
   */
  readonly phoneSourceNumber: string;
  /*
   *  * 担当者グループID
   *  * 担当者グループIDを指定することで、特定のグループに対してのみ架電を行うことができます。
   * @default "default"
   */
  readonly respondersGroupId?: string;

  readonly callStatusTableName: string;
  readonly inProgressTableName: string;
  readonly respondersTableName: string;
  readonly callHistoryTableName: string;
  readonly outboundCallerLambdaName: string;
  readonly snsTopic?: sns.ITopic;
}

export class AmazonConnect extends Construct {
  public readonly connectCallerLambda: lambda.IFunction;

  constructor(scope: Construct, id: string, props: AmazonConnectProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    // Amazon Connectで使用するDynamoDBテーブルの作成
    // 架電状況テーブル
    /*
    主キー: statusId (String, 固定値 "current")
    属性:
    - status (String): "calling" または "idle"
    - timestamp (Number): 最終更新時間（Unix timestamp）
    - errorId (String): 現在処理中のエラーID
    */
    const callStatusTable = new cdk.aws_dynamodb.Table(this, props.callStatusTableName, {
      partitionKey: { name: "statusId", type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // 対応状況テーブル
    /*
    主キー: errorId (String)
    属性:
    - timestamp (Number): 対応開始時間（Unix timestamp）
    - description (String): エラー内容
    - assignedTo (String): 担当者ID
    */
    const inProgressTable = new cdk.aws_dynamodb.Table(this, props.inProgressTableName, {
      partitionKey: { name: "errorId", type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // 担当者テーブル
    /*
    主キー (パーティションキー): groupId (String) - 担当者グループ名
    ソートキー: priority (Number) - グループ内での優先順位（1から始まる数値、低いほど優先）
    属性:
    - responderId (String): 担当者ID（一意識別子）
    - name (String): 担当者名
    - phoneNumber (String): 電話番号
    - active (Boolean): アクティブ状態
    */
    const respondersTable = new cdk.aws_dynamodb.Table(this, props.respondersTableName, {
      partitionKey: { name: "responderId", type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: "priority", type: cdk.aws_dynamodb.AttributeType.NUMBER },
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    // 架電履歴テーブル
    /*
    主キー: errorId (String)
    ソートキー: timestamp (Number)
    属性:
    - status (String): "called", "skipped_calling", "skipped_inprogress"
    - responderId (String): 対応した担当者ID（対応があった場合）
    - description (String): エラー内容
    - result (String): "answered", "no_answer", "voicemail"等
    - expirationTime (Number): データ自動削除タイムスタンプ（TTL属性）
    */
    const callHistoryTable = new cdk.aws_dynamodb.Table(this, props.callHistoryTableName, {
      partitionKey: { name: "errorId", type: cdk.aws_dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: cdk.aws_dynamodb.AttributeType.NUMBER },
      timeToLiveAttribute: "expirationTime",
      billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const connectPolicy = new iam.PolicyStatement({
      actions: [
        "connect:StartOutboundVoiceContact",
        "connect:GetContactAttributes",
        "connect:StopContact",
      ],
      resources: ["*"],
    });
    // IAMロールの作成
    const connectFunctionRole = new iam.Role(this, "ConnectFunctionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
      inlinePolicies: {},
    });
    connectFunctionRole.addToPolicy(connectPolicy);

    connectFunctionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem"],
        resources: [
          callStatusTable.tableArn,
          inProgressTable.tableArn,
          respondersTable.tableArn,
          callHistoryTable.tableArn,
        ],
      })
    );
    connectFunctionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query"],
        resources: [
            respondersTable.tableArn,
            ],
        conditions: {
            StringEquals: {
                "dynamodb:LeadingKeys": ["responderId"],
            },
        },
      })
    );
    const logGroupName = `/aws/vendedlogs/lambda/${kebabCase(cdk.Stack.of(this).stackName)}/${kebabCase(props.outboundCallerLambdaName)}`;
    this.connectCallerLambda  = new PythonFunction(this, props.outboundCallerLambdaName, {
      runtime: lambda.Runtime.PYTHON_3_13,
      timeout: cdk.Duration.seconds(900),
      entry: path.join(__dirname, '../../../common/src/lambda/connect-outbound-caller/python'),
      role: connectFunctionRole,
      index: "index.py",
      handler: "index.lambda_handler",
      environment: {
        CALL_STATUS_TABLE: props.callStatusTableName,
        IN_PROGRESS_TABLE: props.inProgressTableName,
        RESPONDERS_TABLE: props.respondersTableName,
        CALL_HISTORY_TABLE: props.callHistoryTableName,
        CONNECT_INSTANCE_REGION_NAME: region,
        CONNECT_INSTANCE_ID: props.instanceId,
        CONNECT_CONTACT_FLOW_ID: props.contactFlowId,
        CONNECT_SOURCE_PHONE: props.phoneSourceNumber,
        RESPONDERS_GROUP_ID: props.respondersGroupId ?? "default",
      },
      bundling: {
        platform: "linux/amd64",
      },
      loggingFormat: lambda.LoggingFormat.JSON,
      logGroup: new logs.LogGroup(this, `${pascalCase(props.outboundCallerLambdaName)}LogGroup`, {
        logGroupName,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: logs.RetentionDays.ONE_WEEK,
      }),
    });
    if (props.snsTopic) {
      const connectCallerLambdaPermission = new lambda.CfnPermission(this, "ConnectCallerLambdaPermission", {
        action: "lambda:InvokeFunction",
        functionName: this.connectCallerLambda.functionArn,
        principal: "sns.amazonaws.com",
        sourceArn: props.snsTopic.topicArn,
      });
      props.snsTopic.grantPublish(connectFunctionRole);
    }
  }
}

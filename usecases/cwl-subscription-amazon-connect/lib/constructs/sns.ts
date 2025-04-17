// filepath: /mnt/c/git-c/work/geekplus/nest/infra/lib/construct/ops/sns.ts
import * as cdk from "aws-cdk-lib";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { error, info } from "console";

export interface SnsProps {
  /**
   * メール通知先のリスト
   */
  emailAddresses?: {
    critical?: string[],
    error?: string[],
    warning?: string[],
    info?: string[],
  };
  
  /**
   * SMS通知先の電話番号リスト（E.164形式: +819012345678）
   */
  phoneNumbers?: string[]
  
  /**
   * Lambdaリスト
   */
  lambdaArns?: {
    critical?: string[],
    error?: string[],
    warning?: string[],
    info?: string[],
  };
  
  /**
   * 環境名
   */
  envName: string;

  /**
   * アラート通知の特定のタイプに応じたトピック名
   */
  topics?: {
    /**
     * 重大アラート用のトピック名
     */
    critical?: string;
    
    /**
     * エラーアラート用のトピック名
     */
    error?: string;

    /**
     * 警告アラート用のトピック名
     */
    warning?: string;
    
    /**
     * 情報通知用のトピック名
     */
    info?: string;
  };
}

/**
 * SNSリソースを管理するクラス
 * 監視アラートや通知のためのSNSトピックとサブスクリプションを作成します
 */
export class Sns extends Construct {
  /**
   * SNSトピックのマップ
   */
  public readonly topics: Record<string, sns.Topic> = {};

  constructor(scope: Construct, id: string, props: SnsProps) {
    super(scope, id);

    // デフォルトのトピック名
    const defaultTopics = {
      critical: "CriticalAlerts",
      error: "ErrorAlerts",
      warning: "WarningAlerts",
      info: "InfoNotifications",
    };
    // ユーザー指定またはデフォルトのトピック名を使用
    const topicNames = {
      critical: props.topics?.critical || defaultTopics.critical,
      error: props.topics?.error || defaultTopics.critical,
      warning: props.topics?.warning || defaultTopics.warning,
      info: props.topics?.info || defaultTopics.info,
    };

    if (props.topics) {
      if (props.topics.critical) {
        // 重大アラート用のSNSトピックを作成
        this.topics["critical"] = new sns.Topic(this, topicNames.critical, {
          topicName: `${props.envName}-${topicNames.critical}`,
          displayName: `${props.envName} Critical Alerts`,
        });
      }
      if (props.topics.error) {
        // エラーアラート用のSNSトピックを作成
        this.topics["error"] = new sns.Topic(this, topicNames.error, {
          topicName: `${props.envName}-${topicNames.error}`,
          displayName: `${props.envName} Error Alerts`,
        });
      }
      if (props.topics.warning) {
        // 警告アラート用のSNSトピックを作成
        this.topics["warning"] = new sns.Topic(this, topicNames.warning, {
          topicName: `${props.envName}-${topicNames.warning}`,
          displayName: `${props.envName} Warning Alerts`,
        });
      }
      if (props.topics.info) {
        // 情報通知用のSNSトピックを作成
        this.topics["info"] = new sns.Topic(this, topicNames.info, {
          topicName: `${props.envName}-${topicNames.info}`,
          displayName: `${props.envName} Information Notifications`,
        });
      }
    }

    // メール通知の設定
    /*
    if (props.emailAddresses && props.emailAddresses.length > 0) {
        // 各トピックにメールサブスクリプションを追加
        Object.values(this.topics).forEach((topic) => {
          props.emailAddresses!.forEach((email) => {
            topic.addSubscription(new subs.EmailSubscription(email));
          });
        });
    }
    */
    if (props.emailAddresses) {
      if (this.topics["critical"] && props.emailAddresses.critical && props.emailAddresses.critical.length > 0) {
        // 重要なアラートのみにメールサブスクリプションを追加
        props.emailAddresses.critical.forEach((email) => {
          this.topics["critical"].addSubscription(new subs.EmailSubscription(email));
        });
      }
      if (this.topics["error"] && props.emailAddresses.error && props.emailAddresses.error.length > 0) {
        // エラーアラートのみにメールサブスクリプションを追加
        props.emailAddresses.error.forEach((email) => {
          this.topics["error"].addSubscription(new subs.EmailSubscription(email));
        });
      }
      if (this.topics["warning"] && props.emailAddresses.warning && props.emailAddresses.warning.length > 0) {
        // 警告アラートのみにメールサブスクリプションを追加
        props.emailAddresses.warning.forEach((email) => {
          this.topics["warning"].addSubscription(new subs.EmailSubscription(email));
        });
      }
      if (this.topics["info"] && props.emailAddresses.info && props.emailAddresses.info.length > 0) {
        // 情報通知のみにメールサブスクリプションを追加
        props.emailAddresses.info.forEach((email) => {
          this.topics["info"].addSubscription(new subs.EmailSubscription(email));
        });
      }
    }

    // SMS通知の設定
    if (this.topics["critical"] && props.phoneNumbers && props.phoneNumbers.length > 0) {
      // 重要なアラートのみにSMSサブスクリプションを追加
      props.phoneNumbers.forEach((phoneNumber) => {
        this.topics["critical"].addSubscription(new subs.SmsSubscription(phoneNumber));
      });
    }

    // Lambda通知の設定
    if (props.lambdaArns) {
      if (this.topics["critical"] && props.lambdaArns.critical && props.lambdaArns.critical.length > 0) {
        // 重要なアラートのみにLambdaサブスクリプションを追加
        props.lambdaArns.critical.forEach((lambdaArn,index) => {
          // Lambda ARNからLambda関数を取得
          const lambdaFunction = lambda.Function.fromFunctionArn(this, `CriticalLambda${index}`, lambdaArn);
          this.topics["critical"].addSubscription(new subs.LambdaSubscription(
            lambdaFunction
          ));
          lambdaFunction.addPermission(`CriticalLambda${index}Permission`, {
            principal: new cdk.aws_iam.ServicePrincipal('sns.amazonaws.com'),
            action: 'lambda:InvokeFunction',
            sourceArn: this.topics["critical"].topicArn,
          });
        });
      }
      if (this.topics["error"] && props.lambdaArns.error && props.lambdaArns.error.length > 0) {
        // エラーアラートのみにLambdaサブスクリプションを追加
        props.lambdaArns.error.forEach((lambdaArn,index) => {
          // Lambda ARNからLambda関数を取得
          const lambdaFunction = lambda.Function.fromFunctionArn(this, `ErrorLambda${index}`, lambdaArn);
          this.topics["error"].addSubscription(new subs.LambdaSubscription(
            lambdaFunction
          ));
          lambdaFunction.addPermission(`ErrorLambda${index}Permission`, {
            principal: new cdk.aws_iam.ServicePrincipal('sns.amazonaws.com'),
            action: 'lambda:InvokeFunction',
            sourceArn: this.topics["error"].topicArn,
          });
        });
      }
      if (this.topics["warning"] && props.lambdaArns.warning && props.lambdaArns.warning.length > 0) {
        // 警告アラートのみにLambdaサブスクリプションを追加
        props.lambdaArns.warning.forEach((lambdaArn,index) => {
          // Lambda ARNからLambda関数を取得
          const lambdaFunction = lambda.Function.fromFunctionArn(this, `WarningLambda${index}`, lambdaArn);
          this.topics["warning"].addSubscription(new subs.LambdaSubscription(
            lambdaFunction
          ));
          lambdaFunction.addPermission(`WarningLambda${index}Permission`, {
            principal: new cdk.aws_iam.ServicePrincipal('sns.amazonaws.com'),
            action: 'lambda:InvokeFunction',
            sourceArn: this.topics["warning"].topicArn,
          });
        });
      }
      if (this.topics["info"] && props.lambdaArns.info && props.lambdaArns.info.length > 0) {
        // 情報通知のみにLambdaサブスクリプションを追加
        props.lambdaArns.info.forEach((lambdaArn,index) => {
          // Lambda ARNからLambda関数を取得
          const lambdaFunction = lambda.Function.fromFunctionArn(this, `InfoLambda${index}`, lambdaArn);
          this.topics["info"].addSubscription(new subs.LambdaSubscription(
            lambdaFunction
          ));
          lambdaFunction.addPermission(`InfoLambda${index}Permission`, {
            principal: new cdk.aws_iam.ServicePrincipal('sns.amazonaws.com'),
            action: 'lambda:InvokeFunction',
            sourceArn: this.topics["info"].topicArn,
          });
        });
      }
    }

    // CloudWatch Alarmsなどからの通知に使用できるようにトピックARNをエクスポート
    Object.entries(this.topics).forEach(([key, topic]) => {
      new cdk.CfnOutput(this, `${key}TopicArn`, {
        value: topic.topicArn,
        description: `ARN for ${key} SNS topic`,
        exportName: `${props.envName}-${key}-topic-arn`,
      });
    });
  }
}
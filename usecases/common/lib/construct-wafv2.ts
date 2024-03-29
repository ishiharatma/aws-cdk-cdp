import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
    aws_wafv2 as wafv2,
    aws_s3 as s3,
} from 'aws-cdk-lib';
import { BucketConstruct } from './construct-bucket';
import { listOfWAFRules } from '../interface/index';

interface ACMProps {
  readonly pjName: string;
  readonly envName: string;
  readonly webACLNameSuffix: string;
  readonly domainName: string;
  readonly hostedZoneId: string;
  /**
   * @default - false
   */
  readonly isInternal?: boolean;
  /**
   * @default - false
   */
  readonly isIPv6?: boolean;
  /**
   * @default - false
   */
  readonly enableWhitelist?: boolean;
  readonly logsBucket?: BucketConstruct;
  readonly S3LogsBucketExpirationDays?: number;
  readonly S3LogsBucketIADays?: number;
  readonly S3LogsBucketArchiveDays?: number;
  readonly isAutoDeleteObject?: boolean;
}
export class WAFv2Construct extends Construct {
  public readonly webACL: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: ACMProps) {
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    /**
     * List available Managed Rule Groups using AWS CLI
     * aws wafv2 list-available-managed-rule-groups --scope CLOUDFRONT
     * total capacity = 1575
     */
    const managedRules: listOfWAFRules[] = [{
        // capacity = 700
        // Web アプリケーション防御の一般的なルール
        "name": "AWSManagedRulesCommonRuleSet",
        "priority": 10,
        "overrideAction": "none",
        // Excluding generic RFI body rule for sns notifications
        // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html
        "excludedRules": ["GenericRFI_BODY", "SizeRestrictions_BODY"]
      }, {
        // capacity = 25
        // ボットやその他の脅威に関連付けられている IP アドレスをブロックするルール
        "name": "AWSManagedRulesAmazonIpReputationList",
        "priority": 20,
        "overrideAction": "none",
        "excludedRules": []
      }, {
        // capacity = 200
         // 脆弱性や悪用のあるパターンに報告されているインプットをブロックするルール
        "name": "AWSManagedRulesKnownBadInputsRuleSet",
        "priority": 30,
        "overrideAction": "none",
        "excludedRules": []
      }, {
        // capacity = 50
        // 匿名 IP リストルールグループには、ビューワー ID の難読化を許可するサービスからのリクエストをブロックするルール
        "name": "AWSManagedRulesAnonymousIpList",
        "priority": 40,
        "overrideAction": "none",
        "excludedRules": []
      }, {
        // capacity = 200
        // Linux 固有の LFI 攻撃を防ぐルール
        // AWSManagedRulesUnixRuleSetと組み合わせて使用する
        "name": "AWSManagedRulesLinuxRuleSet",
        "priority": 50,
        "overrideAction": "none",
        "excludedRules": []
      }, {
        // capacity = 200
        // POSIX 固有の LFI 攻撃を防ぐルール
        "name": "AWSManagedRulesUnixRuleSet",
        "priority": 60,
        "overrideAction": "none",
        "excludedRules": [],
      }, {
        // capacity = 200
        // SQL Database ルールグループには、SQL インジェクション攻撃などの SQL データベースの悪用に関連するリクエストパターンをブロックするルール
        "name": "AWSManagedRulesSQLiRuleSet",
        "priority": 70,
        "overrideAction": "none",
        "excludedRules": [],
      }
    ];

    const whitelist = props.enableWhitelist
        ? new wafv2.CfnIPSet(this,'whitelist',{
                name: [props.pjName, props.envName, 'whitelist'].join('-'),
                scope: "CLOUDFRONT",
                ipAddressVersion: props.isIPv6 ? "IPV6": "IPV4",
                addresses: [],
            })
        : undefined
    ;

    const blacklist = new wafv2.CfnIPSet(this,'blacklist',{
        name: [props.pjName, props.envName, 'blacklist'].join('-'),
        scope: "CLOUDFRONT",
        ipAddressVersion: props.isIPv6 ? "IPV6": "IPV4",
        addresses: [],
    });
    const WebACLName:string = [props.pjName, props.envName, props.webACLNameSuffix].join('-');
    const overrideAction: wafv2.CfnWebACL.OverrideActionProperty = { none: {} }

    let webACLRules:wafv2.CfnWebACL.RuleProperty[] = [
        {
            // ブラックリストのIPに該当したら Block
            name: "Custom-IPaddress-BlackList",
            priority: 1,
            overrideAction: overrideAction,
            statement: {
              ipSetReferenceStatement: {
                arn: blacklist.attrArn,
              },
            },
            action: { block: {}},
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              sampledRequestsEnabled: false,
              metricName: ["BlacklistWAFv2WebACLRuleIPSet"].join('-'),
            },
         },
        {
            // capacity = 100
            name: "Custom-Ratebased-100",
            action: {block: {}},
            priority: 2,
            overrideAction: overrideAction,
            statement: {
              rateBasedStatement: {
                aggregateKeyType: "IP",
                limit: 100,
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              sampledRequestsEnabled: false,
              metricName: ["Custom-Ratebased-100"].join('-'),
            },
        },
    ];

    if (whitelist) {
        var rule: wafv2.CfnWebACL.RuleProperty = {
            name: "Custom-IPaddress-WhiteList",
            priority: 1000,
            overrideAction: overrideAction,
            action: { allow: {} },
            statement: {
              ipSetReferenceStatement: {
                arn: whitelist!.attrArn,
              },
            },
            visibilityConfig: {
              sampledRequestsEnabled: true,
              cloudWatchMetricsEnabled: true,
              metricName: ["WhitelistWAFv2WebACLRuleIPSet"].join('-'),
            },
          };
          webACLRules.push(rule);
    }

    managedRules.forEach((r) => {
        var mrgsp: wafv2.CfnWebACL.ManagedRuleGroupStatementProperty = {
            name: r['name'],
            vendorName: "AWS",
            excludedRules: []
        };
        var stateProp: wafv2.CfnWebACL.StatementProperty = {
            managedRuleGroupStatement: {
              name: r['name'],
              vendorName: "AWS",
            }
        };
        var rule: wafv2.CfnWebACL.RuleProperty = {
            name: r['name'],
            priority: r['priority'],
            statement: stateProp,
            overrideAction: overrideAction,
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              sampledRequestsEnabled: true,
              metricName: r['name'],
            },
        };
        webACLRules.push(rule);
    });// forEach

/*
    var rule: wafv2.CfnWebACL.RuleProperty = {
        // capacity = 25
        // ボットやその他の脅威に関連付けられている IP アドレスをブロックするルール
        // IP アドレスは AWS によって管理されています。
        name: "AWSManagedRulesAmazonIpReputationList",
        priority: 12,
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesAmazonIpReputationList",
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
          metricName: ["AWSManagedRulesAmazonIpReputationList"].join('-'),
        },
    };
    webACLRules.push(rule);
    var rule: wafv2.CfnWebACL.RuleProperty = {
        // capacity = 50
        // 匿名 IP リストルールグループには、ビューワー ID の難読化を許可するサービスからのリクエストをブロックするルール
        name: "AWSManagedRulesAnonymousIpList",
        priority: 13,
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesAnonymousIpList",
            //scopeDownStatement: {
            //  notStatement: {
            //    statement: {
            //      ipSetReferenceStatement: {
            //        arn: whitelist.attrArn
            //      }  
            //    }
            //  }
            //}
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
          metricName: ["AWSManagedRulesAnonymousIpList"].join('-'),
        },
    };
    webACLRules.push(rule);
    var rule: wafv2.CfnWebACL.RuleProperty = {
        // capacity = 700
        // Web アプリケーション防御の一般的なルール
        name: "AWSManagedRulesCommonRuleSet",
        priority: 14,
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesCommonRuleSet",
            //scopeDownStatement: {
            //  notStatement: {
            //    statement: {
            //      ipSetReferenceStatement: {
            //        arn: whitelist.attrArn
            //      }  
            //    }
            //  }
            //},
            // Excluding generic RFI body rule for sns notifications
            // https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html
            //excludedRules: [
            //  {name: "GenericRFI_BODY"},
            //  {name: "SizeRestrictions_BODY"},
            //]
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
          metricName: ["AWSManagedRulesCommonRuleSet"].join('-'),
        },
    };
    webACLRules.push(rule);
    var rule: wafv2.CfnWebACL.RuleProperty = {
        // capacity = 700
        // Web アプリケーション防御の一般的なルール
        // capacity = 200
        // 脆弱性や悪用のあるパターンに報告されているインプットをブロックするルール
        name: "AWSManagedRulesKnownBadInputsRuleSet",
        priority: 15,
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesKnownBadInputsRuleSet",
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
          metricName: ["AWSManagedRulesKnownBadInputsRuleSet"].join('-'),
        },
    };
    webACLRules.push(rule);
    var rule: wafv2.CfnWebACL.RuleProperty = {
        // capacity = 200
        // SQL Database ルールグループには、SQL インジェクション攻撃などの SQL データベースの悪用に関連するリクエストパターンをブロックするルール
        name: "AWSManagedRulesSQLiRuleSet",
        priority: 16,
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesSQLiRuleSet",
          },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
          metricName: ["AWSManagedRulesSQLiRuleSet"].join('-'),
        },
    };
    webACLRules.push(rule);
*/

    this.webACL = new wafv2.CfnWebACL(this,'wafv2',{
        name:  WebACLName,
        scope: "CLOUDFRONT",
        defaultAction: props.enableWhitelist ? {block: {}} : {allow: {}}, // ホワイトリスト使用の場合はデフォルト BLOCK
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
          metricName: ["wafv2", "cloudfront"].join('-'),
        },
        description: "WAFv2 ACL for CloudFront",
        rules: webACLRules,
    });

    if (props.logsBucket) {
    // S3への直接保存用
      props.logsBucket.bucket.addLifecycleRule({
          expiration: cdk.Duration.days(props.S3LogsBucketExpirationDays ?? 365),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7), // 不完全なマルチパートアップロードの削除
          transitions: [
            {
                storageClass: s3.StorageClass.INTELLIGENT_TIERING, // (S3 標準 – IT)
                transitionAfter: cdk.Duration.days(0),
            },
          {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS, // 低頻度アクセス (S3 標準 – IA)
              transitionAfter: cdk.Duration.days(props.S3LogsBucketIADays ?? 30),
          },
          {
              storageClass: s3.StorageClass.GLACIER, // S3 Glacier Flexible Retrieval (旧 S3 Glacier)
              transitionAfter: cdk.Duration.days(props.S3LogsBucketArchiveDays ?? 90),
          },
          ],
      });
      // WAF ログ出力設定
      const logConfig = new wafv2.CfnLoggingConfiguration(
        this,
        "wafv2LoggingConfiguration",
        {
          logDestinationConfigs: [props.logsBucket.bucket.bucketArn],
          resourceArn: this.webACL.attrArn,
        }
      );
      logConfig.addDependency(this.webACL);
      logConfig.addDependency(props.logsBucket.bucket.node.defaultChild as cdk.CfnResource);
    }
    new cdk.CfnOutput(this, "wafAclCloudFrontArn", {
        value: this.webACL.attrArn,
        description: "WAF CloudFront arn",
        //exportName: "WafAclCloudFrontArn"
    });
  }
}

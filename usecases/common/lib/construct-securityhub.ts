import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_securityhub as securityhub,
} from 'aws-cdk-lib';
import { BucketConstruct } from './construct-bucket';
import * as interfaceConfig from '../interface/index';

export class SecurityHubConstruct extends Construct {
  constructor(scope: Construct, id: string, props: interfaceConfig.SecurityHubConstructProps) {
      super(scope, id);
      const accountId = cdk.Stack.of(this).account;
      const region = cdk.Stack.of(this).region;

      // Security Hubを全リージョンで有効化
      for (const region of this.availableRegions) {
        new securityhub.CfnHub(this, `SecurityHubHub-${region}`, {
          enableDefaultStandards: true,
          region,
        });
      }
      // 他のリージョンのセキュリティハブを管理リージョンに関連付ける
      for (const region of this.availableRegions) {
        if (region !== 'ap-northeast-1') {
          new securityhub.CfnMemberAccount(this, `SecurityHubMemberAccount-${region}`, {
            accountId,
            Email: 'example@example.com',
            MasterId: `arn:aws:securityhub:ap-northeast-1:${accountId}:hub/default`,
            RegionLink: region,
          });
        }
      }
      // 管理アカウントに必要なIAMロールを作成
      const adminRole = new iam.Role(this, 'SecurityHubAdminRole', {
        assumedBy: new iam.ServicePrincipal('securityhub.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('SecurityHubFullAccess'),
        ],
      });
  }
  get availableRegions(): string[] {
    return cdk.Stack.of(this).availableRegions;
  }
}
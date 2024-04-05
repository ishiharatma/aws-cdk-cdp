# aws-cdk-cdp

This is a sample repository of cloud design patterns on AWS CDK.

## Add usecase

- linux

```sh
usecase_name=sample
npm init -w usecases\${usecase_name}
cd usecases\${usecase_name}
rm package.json
cdk init app --language typescript
cd ../../
cp tsconfig_usecases.json .\usecases\${usecase_name}\tsconfig.json
npm install -w usecases\${usecase_name} --save aws-cdk-lib constructs
```

- Windows

```bat
SET usecase_name=sample
npm init -w usecases\%usecase_name%
cd usecases\%usecase_name%
del package.json
cdk init app --language typescript
cd ../../
copy /y tsconfig_usecases.json .\usecases\%usecase_name%\tsconfig.json
npm install -w usecases\%usecase_name% --save aws-cdk-lib constructs
npm install -w usecases\%usecase_name% --save-dev @types/js-yaml
```

```json
,
    "cdk:synth": "cdk synth --version-reporting false --path-metadata false --asset-metadata false -c project=%npm_config_project% -c env=%npm_config_env% --profile %npm_config_project%-%npm_config_env%",
    "cdk:diff:all": "cdk diff --all --version-reporting false --path-metadata false --asset-metadata false -c project=%npm_config_project% -c env=%npm_config_env% --profile %npm_config_project%-%npm_config_env%",
    "cdk:deploy:all": "cdk deploy --all --version-reporting false --path-metadata false --asset-metadata false -c project=%npm_config_project% -c env=%npm_config_env% --profile %npm_config_project%-%npm_config_env%",
    "cdk:destroy:all": "cdk destroy --all -c project=%npm_config_project% -c env=%npm_config_env% --profile %npm_config_project%-%npm_config_env%"
```

## Samples

### Uncategorized

- env-parameter

### VPC

- vpc-with-nat-ami-al1
- vpc-with-nat
- vpc-with-natgw

### Static Web Site

- s3-static-web-site

### Web Application

- cloudfront-s3-oai (Legacy)
- cloudfront-s3-oac
- cloudfront-s3-oac-apigw-lambda

### CI/CD

TODO

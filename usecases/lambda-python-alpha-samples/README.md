# AWS Lambda Python Alpha CDK Samples

[日本語](README.ja.md) | English

## Architecture Overview

![overview](overview.drawio.svg)

This project demonstrates how to use the AWS CDK Python Lambda Alpha package to deploy Python Lambda functions with different log level configurations.

- Creates multiple Lambda functions using the `@aws-cdk/aws-lambda-python-alpha` package
- Configures each function with different application log levels (DEBUG, INFO, WARN, ERROR, FATAL=CRITICAL)
- Uses Python 3.13 runtime with ARM64 architecture for better performance and cost savings

### Key Components

- **AWS Lambda**: Serverless compute service that runs your code in response to events
- **AWS CloudWatch Logs**: Stores and manages logs from Lambda functions with customizable retention periods
- **AWS CDK Python Lambda Alpha Package**: CDK construct library for Python Lambda functions with advanced bundling features

## Deploy

To deploy this project, follow these steps:

1. Make sure you have the AWS CDK installed and configured:

   ```bash
   npm install -g aws-cdk
   cdk --version
   ```

2. Install the project dependencies:

   ```bash
   npm install
   ```

3. Deploy the stack to your AWS account:

   ```bash
   cdk deploy
   ```

## Usage

After deployment, you'll have multiple Lambda functions created with different log level configurations:

- `LambdaPythonAlphaSamplesDEBUG` - Set to show all log levels (DEBUG and above)
- `LambdaPythonAlphaSamplesINFO` - Set to show INFO level logs and above
- `LambdaPythonAlphaSamplesWARN` - Set to show WARN level logs and above
- `LambdaPythonAlphaSamplesERROR` - Set to show only ERROR level logs
- `LambdaPythonAlphaSamplesFATAL` - Set to show only CRITICAL level logs

You can invoke these functions through the AWS Console or AWS CLI to see the differences in log output based on the configured log levels.

### Example AWS CLI invocation

```bash
aws lambda invoke --function-name LambdaPythonAlphaSamplesDEBUG --payload '{}' response.json --profile xxxxx
aws lambda invoke --function-name LambdaPythonAlphaSamplesINFO --payload '{}' response.json --profile xxxxx
aws lambda invoke --function-name LambdaPythonAlphaSamplesWARN --payload '{}' response.json --profile xxxxx
aws lambda invoke --function-name LambdaPythonAlphaSamplesERROR --payload '{}' response.json --profile xxxxx
aws lambda invoke --function-name LambdaPythonAlphaSamplesFATAL --payload '{}' response.json --profile xxxxx
```

Then check the CloudWatch Logs in the AWS Console or via AWS CLI to observe the logged output.

Retrieve the last 10 minutes of CloudWatch Logs from a Lambda function using dynamic timestamp calculations to simplify debugging recent executions.

```bash
aws logs filter-log-events --log-group-name /aws/lambda/LambdaPythonAlphaSamplesDEBUG --start-time $(( $(date +%s) * 1000 - 10 * 60 * 1000 )) --end-time $(( $(date +%s) * 1000 )) --profile xxxxx
```

## Clean-up

To avoid incurring charges, make sure to clean up the resources when you're done:

```bash
cdk destroy
```

This will remove all resources created by this stack.

## Cost

The resources deployed in this stack are generally within the AWS Free Tier limits if you're under the free tier eligibility period. The primary costs would come from:

- Lambda invocations beyond the free tier
- CloudWatch Logs storage (configured with 1-day retention to minimize costs)

[AWS Pricing Calculator](https://calculator.aws/#/) can be used to estimate costs for your specific usage patterns.

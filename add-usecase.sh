#!/bin/bash
# filepath: /workspaces/aws-cdk-cdp/add-usecase.sh

# Usage: ./add-usecase.sh my-usecase
# Description: Initialize a new CDK usecase project with the specified name

if [ -z "$1" ]; then
    echo "Error: usecase_name parameter is required."
    exit 1
fi

usecase_name=$1
npm init -w usecases/${usecase_name} -y
cd usecases/${usecase_name}
rm package.json
cdk init app --language typescript
cd ../../
cp -f tsconfig_usecases.json ./usecases/${usecase_name}/tsconfig.json
cp -f README_usecase_template.md ./usecases/${usecase_name}/README.md
cp -f overview_template.drawio.svg ./usecases/${usecase_name}/overview.drawio.svg
npm install -w usecases/${usecase_name} --save aws-cdk-lib constructs
npm install -w usecases/${usecase_name} --save-dev @types/js-yaml

exit 0
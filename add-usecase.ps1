# Usage: 
# Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
#.\add-usecase.ps1 my-usecase
# Description: Initialize a new CDK usecase project with the specified name

param(
   [Parameter(Mandatory=$true)]
   [string]$usecase_name
)

npm init -w "usecases\$usecase_name" -y
Set-Location "usecases\$usecase_name"
Remove-Item package.json -Force
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
cdk init app --language typescript
Set-Location ..\..\
Copy-Item tsconfig_usecases.json .\usecases\$usecase_name\tsconfig.json -Force
Copy-Item README_usecase_template.md .\usecases\$usecase_name\README.md -Force
Copy-Item overview_template.drawio.svg .\usecases\$usecase_name\overview.drawio.svg -Force
npm install -w usecases\$usecase_name --save aws-cdk-lib constructs
npm install -w usecases\$usecase_name --save-dev @types/js-yaml

exit 0
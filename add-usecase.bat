@echo off
rem Usage: init-usecase.bat my-usecase
rem Description: Initialize a new CDK usecase project with the specified name

IF "%1"=="" (
    echo Error: usecase_name parameter is required.
    exit /b 1
)

SET usecase_name=%1
npm init -w usecases\%usecase_name% -y
cd usecases\%usecase_name%
del package.json
cdk init app --language typescript
cd ../../
copy /y tsconfig_usecases.json .\usecases\%usecase_name%\tsconfig.json
copy /y README_usecase_template.md .\usecases\%usecase_name%\README.md
copy /y overview_template.drawio.svg .\usecases\%usecase_name%\overview.drawio.svg
npm install -w usecases\%usecase_name% --save aws-cdk-lib constructs
npm install -w usecases\%usecase_name% --save-dev @types/js-yaml

exit /b 0
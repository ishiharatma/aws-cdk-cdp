# Add usecase

- linux

```sh
usecase_name=sample
npm init -w usecases\${usecase_name} -y 
cd usecases\${usecase_name}
rm package.json
cdk init app --language typescript
cd ../../
cp tsconfig_usecases.json .\usecases\${usecase_name}\tsconfig.json
cp README_usecase_template.md .\usecases\${usecase_name}\README.md
npm install -w usecases\${usecase_name} --save aws-cdk-lib constructs
```

- Windows

```bat
SET usecase_name=sample
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
```

```PowerShell
$usecase_name="sample"
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
```

```json
,
    "cdk:synth": "cdk synth --version-reporting false --path-metadata false --asset-metadata false -c project=%npm_config_project% -c env=%npm_config_env% --profile %npm_config_project%-%npm_config_env%",
    "cdk:diff:all": "cdk diff --all --version-reporting false --path-metadata false --asset-metadata false -c project=%npm_config_project% -c env=%npm_config_env% --profile %npm_config_project%-%npm_config_env%",
    "cdk:deploy:all": "cdk deploy --all --version-reporting false --path-metadata false --asset-metadata false -c project=%npm_config_project% -c env=%npm_config_env% --profile %npm_config_project%-%npm_config_env%",
    "cdk:destroy:all": "cdk destroy --all -c project=%npm_config_project% -c env=%npm_config_env% --profile %npm_config_project%-%npm_config_env%"
```

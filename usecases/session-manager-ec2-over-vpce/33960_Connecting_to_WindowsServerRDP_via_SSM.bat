@echo off

REM ****************************
REM Please specify the ID of the EC2 instance to connect to.
SET INSTANCE_ID=i-0af01c0123456789a
REM The following are the items used on the display during batch execution.
SET SERVER_NAME=WindowsServer
SET AWS_ACCOUNT_NAME=foobar

REM ****************************
REM Please specify the profile name set in .aws\credentials
SET AWS_PROFILE=foobar

REM ****************************
REM Please specify a non-conflicting port in the terminal you are running
SET LOCAL_PORT_NO=33890

REM Remote Listen Port
SET SERVER_PORT_NO=3389

echo.
echo Connecting to %SERVER_NAME% via SSM
echo.
echo ^<!!!!! check !!!!!^>
echo * AWS CLI and Session Manager plugin installed
echo.
echo ****************************************************
echo AWS Account: %AWS_ACCOUNT_NAME%
echo Connect to %SERVER_NAME%(%INSTANCE_ID%)
echo ****************************************************
echo.
echo Connect to EC2 in the private subnet via the session manager.
echo To run this batch file, settings must be made in "%HOMEDRIVE%%HOMEPATH%\.aws\credentials".
echo.
echo After connecting, please connect to the following in your RDP Client.
echo localhost:%LOCAL_PORT_NO%
REM If you would like to display your connection information, please enter it below.
echo LoginUser: Administrator
echo LoginPassword: Get from AWS Management Console
echo.
echo To disconnect from this batch, close the command prompt or press Ctrl + C.
echo.
echo.

SET DEBUG=
set /p yn_check="Do you want to connect in debug mode? (y/n)"
IF %yn_check:Y=Y%==Y (
  SET DEBUG=--debug
)

aws ssm start-session %DEBUG% --target %INSTANCE_ID% --document-name AWS-StartPortForwardingSession ^
    --parameters "portNumber=%SERVER_PORT_NO%,localPortNumber=%LOCAL_PORT_NO%" ^
    --profile %AWS_PROFILE%

echo .
echo disconnected
echo .

pause

exit /b 0
echo .
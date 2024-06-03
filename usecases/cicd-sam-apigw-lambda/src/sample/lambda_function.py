from datetime import datetime

def lambda_handler(event, context):
  # Get the current date and time
  now = datetime.now()

  # Format the date and time in a readable format (e.g., YYYY-MM-DD HH:MM:SS)
  current_time = now.strftime("%Y-%m-%d %H:%M:%S")

  # Return the current date and time
  return {
    "statusCode": 200,
    "body": current_time
  }
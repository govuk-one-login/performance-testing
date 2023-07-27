#!/bin/bash

# Script to handle posting messages to Slack
# To be called with source in the pipeline with argument 'POST' or 'UPDATE'
# e.g. `source ./slack.sh POST` or `source ./slack.sh UPDATE`

valid_args=true
case $1 in
    "POST") # Send initial message
        api_command="chat.postMessage"
        dashboard_end="now"
        title="*:loading: Performance Test - Build In Progress*"
        color="#c7c700" # yellow
        ts_prop=""
        other_info=""
        ;;

    "UPDATE") # Update message at end of test
        api_command="chat.update"
        dashboard_end=$(date +%s000)
        if [ $CODEBUILD_BUILD_SUCCEEDING -eq 1 ]; then
            title="*✅ Performance Test - Build Passed*"
            color="#00c700" # green
        else
            title="*❌ Performance Test - Build Failed*"
            color="#c70000" # red
        fi
        ts_prop='"ts": "'$message_id'",'
        other_info="\n• Results URI: \`${S3_LOCATION}\`"
        ;;

    *)
        echo "Script must have argument in ['POST','UPDATE']"
        valid_args=false
        ;;
esac

if $valid_args; then
    dynatrace_url="${K6_DYNATRACE_URL}/#dashboard;gtf=${CODEBUILD_START_TIME}%20to%20${dashboard_end};id=${K6_DYNATRACE_DASHBOARD_ID};gf=all;es=CUSTOM_DIMENSION-build_id:${CODEBUILD_BUILD_NUMBER}/"
    message_id=$(curl https://www.slack.com/api/${api_command} \
            -X POST \
            -H "Authorization: Bearer ${SLACK_OAUTH_TOKEN}" \
            -H "Content-type: application/json" \
            -d '{
    "channel": "'"${SLACK_NOTIFY_CHANNEL}"'",
    '"${ts_prop}"'
    "attachments": [
      {
        "color": "'"${color}"'",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "'"${title}"'"
            }
          },
          {
            "type": "section",
            "fields": [
              {
                "type": "mrkdwn",
                "text": "*Test Script:* `'"${TEST_SCRIPT}"'`"
              },
              {
                "type": "mrkdwn",
                "text": "*Profile:* `'"${PROFILE}"'`"
              },
              {
                "type": "mrkdwn",
                "text": "*Scenarios:* `'"${SCENARIO}"'`"
              },
              {
                "type": "mrkdwn",
                "text": "*Environment:* `'"${ENVIRONMENT}"'`"
              }
            ]
          },
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "• <'"${dynatrace_url}"'|Dynatrace Dashboard>\n• <'"${CODEBUILD_BUILD_URL}"'|CodeBuild>'"${other_info}"'"
            }
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "plain_text",
                "text": "#'"${CODEBUILD_BUILD_NUMBER}"'"
              }
            ]
          }
        ]
      }
    ]
    }' | jq -r '.ts // .')

    echo "Message ID: ${message_id}"
fi

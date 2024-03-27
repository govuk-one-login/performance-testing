#!/bin/bash

# Utility script for reporting on key metrics from a k6 performance test using
# the JSON file output
#
# ARGUMENTS:
#  $1: path to a .gz archive containing test results in JSON format
#  $2: folder to use a working and output directory

set -e
INPUT=${1:-results.gz}
OUTPUT=${2:-results_$(date +%s)}

mkdir -p $OUTPUT
if [[ ! -f "$OUTPUT/results.json" ]]; then # Do not unzip or copy if this has already been done
    if [[ $INPUT == *.gz ]]; then
        gunzip -c $INPUT >$OUTPUT/results.json
    else
        cp $INPUT $OUTPUT/results.json
    fi
fi

cd $OUTPUT

# Generate durations CSV
echo ''
echo '┌-----------------------------------------┐'
echo '| Request Duration by Timestamp and Group |'
echo '└-----------------------------------------┘'
if [[ ! -f "durations.csv" ]]; then # Do not filter if this has already been done
    jq --arg startTime "$START_TIME" --arg endTime "$END_TIME" '
      [($startTime, $endTime) | strptime("%Y-%m-%dT%H:%M:%S")[0:6]] as $r
        | select(
            .type=="Point"
            and .metric=="duration"
            and ( .data.time[:19] | strptime("%Y-%m-%dT%H:%M:%S")[0:6]) as $timediff
              | $timediff >= $r[0] and $timediff <= $r[1]
    )
    | [
      .data.time,
      .data.tags.group,
      .data.value
    ]
    | @csv' results.json >durations.csv
fi
echo "Output to $OUTPUT/durations.csv"

# Generate HTTP Request Durations CSV
echo ''
echo '┌------------------------------------------------┐'
echo '| Request Duration by Timestamp and HTTP Request |'
echo '└------------------------------------------------┘'
if [[ ! -f "http_req_duration.csv" ]]; then # Do not filter if this has already been done
    jq --arg startTime "$START_TIME" --arg endTime "$END_TIME" '
      [($startTime, $endTime) | strptime("%Y-%m-%dT%H:%M:%S")[0:6]] as $r
        | select(
            .type=="Point"
            and .metric=="http_req_duration"
            and ( .data.time[:19] | strptime("%Y-%m-%dT%H:%M:%S")[0:6]) as $timediff
              | $timediff >= $r[0] and $timediff <= $r[1]
    )
    | [
      .data.time,
      .data.tags.name,
      .data.value
    ]
    | @csv' results.json >http_req_duration.csv
fi
echo "Output to $OUTPUT/http_req_duration.csv"

#Generate Iterations Started Count By Scenario
echo ''
echo '┌--------------------------------------┐'
echo '| Iterations Started Count by Scenario |'
echo '└--------------------------------------┘'
if [[ ! -f "iterationsStarted.json" ]]; then # Do not filter if this has already been done
    jq --arg startTime "$START_TIME" --arg endTime "$END_TIME" '
      [($startTime, $endTime) | strptime("%Y-%m-%dT%H:%M:%S")[0:6]] as $r
        | select(
            .type=="Point"
            and .metric=="iterations_started"
            and .data.value == 1
            and ( .data.time[:19] | strptime("%Y-%m-%dT%H:%M:%S")[0:6]) as $timediff
              | $timediff >= $r[0] and $timediff <= $r[1]
    )
    | {
      "scenario":.data.tags.scenario,
    }' results.json > iterationsStarted.json
fi
if [[ ! -f "iterationsStarted-pivot.json" ]]; then # Do not pivot if this has already been done
    jq -s 'group_by(.scenario)
    | map({
        "scenario":first.scenario,
        "count":length
    })
    | sort_by(.count)
    | reverse' iterationsStarted.json >iterationsStarted-pivot.json
fi
# Pretty print to stdout using column
jq -r '(
  ["Scenario","Count"]
  | (., map(length*"-"))
), (
  .[]
  | [.scenario, .count]
)
| @tsv' iterationsStarted-pivot.json | column -ts$'\t'

#Generate Iterations Completed Count By Scenario
echo ''
echo '┌----------------------------------------┐'
echo '| Iterations Completed Count by Scenario |'
echo '└----------------------------------------┘'
if [[ ! -f "iterationsCompleted.json" ]]; then # Do not filter if this has already been done
    jq --arg startTime "$START_TIME" --arg endTime "$END_TIME" '
      [($startTime, $endTime) | strptime("%Y-%m-%dT%H:%M:%S")[0:6]] as $r
        | select(
            .type=="Point"
            and .metric=="iterations_completed"
            and .data.value == 1
            and ( .data.time[:19] | strptime("%Y-%m-%dT%H:%M:%S")[0:6]) as $timediff
              | $timediff >= $r[0] and $timediff <= $r[1]
    )
    | {
      "scenario":.data.tags.scenario,
    }' results.json > iterationsCompleted.json
fi
if [[ ! -f "iterationsCompleted-pivot.json" ]]; then # Do not pivot if this has already been done
    jq -s 'group_by(.scenario)
    | map({
        "scenario":first.scenario,
        "count":length
    })
    | sort_by(.count)
    | reverse' iterationsCompleted.json >iterationsCompleted-pivot.json
fi
# Pretty print to stdout using column
jq -r '(
  ["Scenario","Count"]
  | (., map(length*"-"))
), (
  .[]
  | [.scenario, .count]
)
| @tsv' iterationsCompleted-pivot.json | column -ts$'\t'

#Generate Total Request (Passed + Failed) Count By Group and filter by time
echo ''
echo '┌-----------------------------------------------------------┐'
echo '| Total Request Count by Group and Status and Filter by Time|'
echo '└-----------------------------------------------------------┘'
if [[ ! -f "passedTime.json" ]]; then # Do not filter if this has already been done
    jq --arg startTime "$START_TIME" --arg endTime "$END_TIME" '
      [($startTime, $endTime) | strptime("%Y-%m-%dT%H:%M:%S")[0:6]] as $r
        | select(
          .type=="Point"
          and .metric=="http_reqs"
          and .data.value == 1
          and ( .data.time[:19] | strptime("%Y-%m-%dT%H:%M:%S")[0:6]) as $timediff
              | $timediff >= $r[0] and $timediff <= $r[1]
          )
       | {
              "group":.data.tags.group,
              "status":.data.tags.status
    }' results.json >passedTime.json
fi
if [[ ! -f "passedTime-pivot.json" ]]; then # Do not pivot if this has already been done
    jq -s 'group_by(.group,.status)
    | map({
        "group":first.group,
        "status":first.status,
        "count":length
    })
    | sort_by(.count)
    | reverse' passedTime.json >passedTime-pivot.json
fi
# Pretty print to stdout using column
jq -r '(
  ["Group Name","Status","Count"]
  | (., map(length*"-"))
), (
  .[]
  | [.group, .status, .count]
)
| @tsv' passedTime-pivot.json | column -ts$'\t'
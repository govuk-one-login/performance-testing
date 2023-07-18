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
echo ''
echo '┌---------------------------------┐'
echo '| Error Count by Group and Status |'
echo '└---------------------------------┘'
if [[ ! -f "errors.json" ]]; then # Do not filter if this has already been done
    jq 'select(
      .type=="Point"
      and .metric=="http_req_failed"
      and .data.value == 1
    )
    | {
      "group":.data.tags.group,
      "status":.data.tags.status
    }' results.json >errors.json
fi
if [[ ! -f "error-pivot.json" ]]; then # Do not pivot if this has already been done
    jq -s 'group_by(.group,.status)
    | map({
        "group":first.group,
        "status":first.status,
        "count":length
    })
    | sort_by(.count)
    | reverse' errors.json >error-pivot.json
fi
# Pretty print to stdout using column
jq -r '(
  ["Group Name","Status","Count"]
  | (., map(length*"-"))
), (
  .[]
  | [.group, .status, .count]
)
| @tsv' error-pivot.json | column -ts$'\t'

# Generate durations CSV
echo ''
echo '┌-----------------------------------------┐'
echo '| Request Duration by Timestamp and Group |'
echo '└-----------------------------------------┘'
if [[ ! -f "durations.csv" ]]; then # Do not filter if this has already been done
    jq -r 'select(
      .type=="Point"
      and .metric=="duration"
    )
    | [
      .data.time,
      .data.tags.group,
      .data.value
    ]
    | @csv' results.json >durations.csv
fi
echo "Output to $OUTPUT/durations.csv"

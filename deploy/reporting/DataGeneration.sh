#!/bin/bash
# Utility script for generating data for IPV CORE, EVCS and AIS
# JSON file output to CSV format
#
# ARGUMENTS:
#  $1: path to a .gz archive containing test results in JSON format
#  $2: folder to use a working and output directory
set -e
INPUT=${1:-TestData.gz}
OUTPUT=${2:-results_$(date +%s)}
mkdir -p $OUTPUT
if [[ ! -f "$OUTPUT/TestData.json" ]]; then # Do not unzip or copy if this has already been done
    if [[ $INPUT == *.gz ]]; then
        gunzip -c $INPUT >$OUTPUT/TestData.json
    else
        cp $INPUT $OUTPUT/TestData.json
    fi
fi
cd $OUTPUT
echo ''
echo '┌------------------------------------------┐'
echo '|Output to CSV file from TestData.json file|'
echo '└------------------------------------------┘'
if [[ ! -f "TestData.csv" ]]; then # Do not filter if this has already been done
    jq -rc 'select(
    .level=="info"
    and .source=="console"
)
|[
   .msg
   ]
    | @csv' TestData.json >TestData.csv
fi
echo "Output to $OUTPUT/TestData.csv"

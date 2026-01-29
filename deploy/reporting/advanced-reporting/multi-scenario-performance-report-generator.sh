#!/bin/bash

# ============================================================================
# Script: multi-scenario-performance-report-generator.sh
# Created: December 2025
# Last Modified: 21-Jan-2026
# Version: 4.0
# New: Auto-detect SLA breaches and generate transaction analysis + graphs + separate folder inside reporting
# ============================================================================
# Combined Performance Report Generator with Per-Scenario Steady-State Support
# ============================================================================
# This script processes k6 performance test results and generates:
#   - Steady-state percentiles (P95, P99) per scenario
#   - Full test duration percentiles per scenario
#   - Throughput calculations (iterations/second)
#   - Journey error rates
#   - HTTP request statistics by status code
#   - CSV files and JSON data for Excel export
#
# Usage:
#   Single scenario: ./multi-scenario-performance-report-generator.sh results.gz "ScenarioName:13:05:03:13:35:03"
#   Multi scenario:  ./multi-scenario-performance-report-generator.sh results.gz "scenario1:13:05:03:13:35:03,scenario2:14:00:00:14:30:00"
#   Interactive:     ./multi-scenario-performance-report-generator.sh results.gz
# ============================================================================

set -e  # Exit immediately if any command fails

# Parse command-line arguments
INPUT=${1:-results.gz}  # First argument: input file (default: results.gz)
TIME_PARAM=$2            # Second argument: time parameters (optional)
ANALYSIS_MODE="all"      # Default: analyze all transactions
DETAILED_ANALYSIS="no"   # Default: no detailed analysis

# ============================================================================
# INTERACTIVE MODE: Prompt user for scenario configuration if not provided
# ============================================================================
if [[ -z "$TIME_PARAM" ]]; then
    echo ""
    echo "=== Performance Test Steady-State Configuration ==="
    echo ""
    read -p "Enter the total number of scenarios in the test: " SCENARIO_COUNT

    if [[ "$SCENARIO_COUNT" -eq 1 ]]; then
        # Single scenario mode - collect one set of times
        # Format: ScenarioName:HH:MM:SS:HH:MM:SS
        echo ""
        read -p "Enter Scenario Name: " SCENARIO_NAME
        read -p "Enter Steady-State Start Time (HH:MM:SS): " START_TIME
        read -p "Enter Steady-State End Time (HH:MM:SS): " END_TIME
        TIME_PARAM="${SCENARIO_NAME}:${START_TIME}:${END_TIME}"
    else
        # Multi-scenario mode - collect multiple sets of times
        # Format: scenario1:HH:MM:SS:HH:MM:SS,scenario2:HH:MM:SS:HH:MM:SS
        SCENARIO_TIMES=""
        for ((i=1; i<=SCENARIO_COUNT; i++)); do
            echo ""
            echo "--- Scenario $i of $SCENARIO_COUNT ---"
            read -p "Enter Scenario Name: " SCENARIO_NAME
            read -p "Enter Steady-State Start Time (HH:MM:SS): " START_TIME
            read -p "Enter Steady-State End Time (HH:MM:SS): " END_TIME

            if [[ $i -eq 1 ]]; then
                SCENARIO_TIMES="${SCENARIO_NAME}:${START_TIME}:${END_TIME}"
            else
                SCENARIO_TIMES="${SCENARIO_TIMES},${SCENARIO_NAME}:${START_TIME}:${END_TIME}"
            fi
        done
        TIME_PARAM="$SCENARIO_TIMES"
    fi
    echo ""
fi

START_TIMESTAMP=$(date +%s.%N)

echo "Processing $INPUT..."
echo "Started at: $(date)"

echo "┌─────────────────────────────────────┐"
echo "│   Combined Performance Report       │"
echo "└─────────────────────────────────────┘"

# Check if multi-scenario format (contains colon)
if [[ "$TIME_PARAM" == *":"* ]]; then
    # Multi-scenario mode
    SCENARIO_TIMES="$TIME_PARAM"
    MODE="multi"
else
    # Single scenario mode - need third parameter
    START_TIME=$TIME_PARAM
    END_TIME=$3
    if [[ -z "$END_TIME" ]]; then
        echo "Error: For single scenario, provide: results.gz START_TIME END_TIME" >&2
        exit 1
    fi
    MODE="single"
fi

# Single pass through the data to extract all required metrics
gunzip -c "$INPUT" | jq -r '
select(.type=="Point") |
if .metric=="duration" then
    [(.data.time | split("T")[1] | split(".")[0]), "duration", .data.tags.group, .data.tags.scenario, .data.value] | @tsv
elif .metric=="iterations_started" and .data.value == 1 then
    [(.data.time | split("T")[1] | split(".")[0]), "iter_start", .data.tags.scenario, "", "1"] | @tsv
elif .metric=="iterations_completed" and .data.value == 1 then
    [(.data.time | split("T")[1] | split(".")[0]), "iter_complete", .data.tags.scenario, "", "1"] | @tsv
elif .metric=="http_reqs" and .data.value == 1 then
    [(.data.time | split("T")[1] | split(".")[0]), "http_req", .data.tags.group, .data.tags.scenario, .data.tags.status] | @tsv
else empty end' | \
    awk -F'\t' -v mode="$MODE" -v scenario_times="$SCENARIO_TIMES" -v single_start="$START_TIME" -v single_end="$END_TIME" '
# ============================================================================
# AWK DATA PROCESSING SECTION
# ============================================================================
# This AWK script processes tab-separated data from jq output
# Input format: time | metric_type | group_or_scenario | scenario_tag | value_or_status

BEGIN {
    # Initialize global counters
    total = 0                    # Total records processed
    total_http = 0               # Total HTTP requests across all scenarios
    total_iter_start = 0         # Total iterations started (entire test)
    total_iter_complete = 0      # Total iterations completed (entire test)

    # ========================================================================
    # PARSE SCENARIO TIME WINDOWS AND CALCULATE DURATIONS
    # ========================================================================
    # Multi-scenario mode: Each scenario has its own steady-state window
    if (mode == "multi") {
        # Split comma-separated scenario entries
        split(scenario_times, scenarios_arr, ",")
        for (i in scenarios_arr) {
            # Parse format: ScenarioName:HH:MM:SS:HH:MM:SS
            # Example: drivingLicence:13:03:55:13:33:55
            entry = scenarios_arr[i]
            first_colon = index(entry, ":")
            scenario_name = substr(entry, 1, first_colon - 1)  # Extract scenario name
            times_part = substr(entry, first_colon + 1)        # Extract time portion

            # Split time portion into 6 parts: H:M:S:H:M:S
            split(times_part, time_parts, ":")
            scenario_start[scenario_name] = time_parts[1] ":" time_parts[2] ":" time_parts[3]  # Start time
            scenario_end[scenario_name] = time_parts[4] ":" time_parts[5] ":" time_parts[6]    # End time

            # Calculate steady-state duration in seconds (end_time - start_time)
            # Used later for throughput calculation: iterations / duration
            start_sec = time_parts[1] * 3600 + time_parts[2] * 60 + time_parts[3]
            end_sec = time_parts[4] * 3600 + time_parts[5] * 60 + time_parts[6]
            scenario_duration[scenario_name] = end_sec - start_sec
        }
    } else {
        # Single scenario mode - calculate duration from global start/end times
        split(single_start, start_parts, ":")
        split(single_end, end_parts, ":")
        start_sec = start_parts[1] * 3600 + start_parts[2] * 60 + start_parts[3]
        end_sec = end_parts[1] * 3600 + end_parts[2] * 60 + end_parts[3]
        single_duration = end_sec - start_sec
    }
}

# ============================================================================
# MAIN PROCESSING LOOP: Process each record from jq output
# ============================================================================
{
    total++  # Increment total record counter

    # Parse tab-separated fields from jq output
    time_part = $1           # Timestamp (HH:MM:SS)
    metric_type = $2         # Type: duration, iter_start, iter_complete, http_req
    group_or_scenario = $3   # Transaction group name or scenario name
    scenario_tag = $4        # Scenario name (for duration/http_req metrics)
    value_or_status = $5     # Duration value (ms) or HTTP status code

    # Track overall test time range
    if (total == 1) first_time = time_part  # First record timestamp
    last_time = time_part                    # Last record timestamp (updated each iteration)

    # Determine which scenario this record belongs to
    # Different metrics store scenario name in different fields
    if (metric_type == "duration" || metric_type == "http_req") {
        current_scenario = scenario_tag      # Scenario in field 4
    } else {
        current_scenario = group_or_scenario # Scenario in field 3
    }

    # ========================================================================
    # STEADY-STATE DETECTION: Check if record falls within steady-state window
    # ========================================================================
    # Steady-state = stable performance period (excludes ramp-up/ramp-down)
    in_steady_state = 0  # Default: not in steady-state

    if (mode == "multi") {
        # Multi-scenario: Each scenario has its own time window
        # Check if current time is within this scenario start/end times
        if (current_scenario in scenario_start) {
            if (time_part >= scenario_start[current_scenario] && time_part <= scenario_end[current_scenario]) {
                in_steady_state = 1  # Record is within steady-state window
            }
        }
    } else {
        # Single scenario: Use global time window for all scenarios
        if (time_part >= single_start && time_part <= single_end) {
            in_steady_state = 1
        }
        # Track discovered scenarios for later processing
        if (current_scenario != "" && !(current_scenario in seen_single_scenarios)) {
            seen_single_scenarios[current_scenario] = 1
        }
    }

    # ========================================================================
    # COLLECT STEADY-STATE DATA (for steady-state percentiles & throughput)
    # ========================================================================
    if (in_steady_state) {
        if (metric_type == "duration") {
            # Store duration values using compound key (avoids ARG_MAX limits)
            # Key format: "ScenarioName|TransactionName|Index"
            key = current_scenario "|" group_or_scenario
            duration_count[key]++
            idx = duration_count[key]
            duration_values[key "|" idx] = value_or_status
            scenario_duration_count[current_scenario]++
        }
        else if (metric_type == "iter_start") {
            # Count iterations started during steady-state
            iter_start_counts[current_scenario]++
        }
        else if (metric_type == "iter_complete") {
            # Count iterations completed during steady-state (used for throughput)
            iter_complete_counts[current_scenario]++
        }
    }

    # ========================================================================
    # COLLECT ENTIRE TEST DURATION DATA (for error rates & full percentiles)
    # ========================================================================
    # Process ALL iterations regardless of steady-state window
    if (metric_type == "iter_start") {
        total_iter_start_counts[group_or_scenario]++  # Per-scenario count
        total_iter_start++                             # Global count
    }
    else if (metric_type == "iter_complete") {
        total_iter_complete_counts[group_or_scenario]++  # Per-scenario count
        total_iter_complete++                             # Global count
    }

    # Collect ALL duration data for full test duration percentiles
    if (metric_type == "duration") {
        full_key = current_scenario "|" group_or_scenario
        full_duration_count[full_key]++
        full_idx = full_duration_count[full_key]
        full_duration_values[full_key "|" full_idx] = value_or_status
    }

    # Collect ALL HTTP requests with status codes
    if (metric_type == "http_req") {
        # Key format: "ScenarioName|GroupName|StatusCode"
        http_key = current_scenario "|" group_or_scenario "|" value_or_status
        http_counts[http_key]++                    # Count per group/status
        scenario_http_counts[current_scenario]++   # Total HTTP count per scenario
        total_http++                                # Global HTTP count
    }
}
END {
    printf "\n📊 TEST ANALYSIS\n"
    printf "─────────────────\n"
    printf "Test Time Range: %s - %s\n", first_time, last_time
    printf "Total Records Processed: %d\n", total
    printf "Total Iterations Started: %d\n", total_iter_start
    printf "Total Iterations Completed: %d\n", total_iter_complete
    printf "Total HTTP Requests: %d\n", total_http

    # Get list of scenarios from all sources
    scenario_count = 0
    for (scenario in iter_start_counts) {
        if (!(scenario in seen_scenarios)) {
            scenarios[++scenario_count] = scenario
            seen_scenarios[scenario] = 1
        }
    }
    for (scenario in total_iter_start_counts) {
        if (!(scenario in seen_scenarios)) {
            scenarios[++scenario_count] = scenario
            seen_scenarios[scenario] = 1
        }
    }

    # Sort scenarios alphabetically
    for (i = 1; i <= scenario_count; i++) {
        for (j = i + 1; j <= scenario_count; j++) {
            if (scenarios[i] > scenarios[j]) {
                temp = scenarios[i]
                scenarios[i] = scenarios[j]
                scenarios[j] = temp
            }
        }
    }

    # Generate timestamp for filenames
    cmd = "date +%Y-%m-%d-%H-%M-%S"
    cmd | getline timestamp
    close(cmd)

    # Process each scenario
    for (s = 1; s <= scenario_count; s++) {
        scenario = scenarios[s]

        # Get duration for this scenario
        if (mode == "multi") {
            duration = scenario_duration[scenario]
        } else {
            duration = single_duration
        }

        printf "\n\n"
        print "═══════════════════════════════════════════════════════════════════════════════════════════════"
        printf "  SCENARIO: %s\n", scenario
        print "═══════════════════════════════════════════════════════════════════════════════════════════════"

        # Iterations Started
        printf "\n🚀 ITERATIONS STARTED (STEADY-STATE)\n"
        print "───────────────────────────────────────────────"
        printf "%-30s %15s\n", "Scenario", "Count"
        print "───────────────────────────────────────────────"
        start_count = (scenario in iter_start_counts) ? iter_start_counts[scenario] : 0
        printf "%-30s %15d\n", scenario, start_count

        # ====================================================================
        # THROUGHPUT CALCULATION
        # ====================================================================
        # Formula: Throughput = Completed Iterations / Duration (seconds)
        # Duration is dynamically calculated from start/end times provided
        # Example: 896 iterations / 1800 seconds = 0.50 iterations/sec
        printf "\n✅ ITERATIONS COMPLETED & THROUGHPUT (STEADY-STATE)\n"
        print "─────────────────────────────────────────────────────────────────────"
        printf "%-30s %15s %20s\n", "Scenario", "Count", "Throughput/sec"
        print "─────────────────────────────────────────────────────────────────────"
        count = (scenario in iter_complete_counts) ? iter_complete_counts[scenario] : 0
        throughput = (duration > 0) ? count / duration : 0  # Avoid division by zero
        printf "%-30s %15d %20.2f\n", scenario, count, throughput

        # ====================================================================
        # CALCULATE STEADY-STATE PERCENTILES - FIXED VERSION
        # ====================================================================
        # Use temp file to avoid ARG_MAX and sort efficiently
        result_count = 0
        for (key in duration_count) {
            split(key, key_parts, "|")
            if (key_parts[1] == scenario) {
                group = key_parts[2]
                count = duration_count[key]

                # Write values to temp file with safe filename
                tmpfile = "/tmp/perf_" s "_" result_count "_" rand() ".txt"
                for (i = 1; i <= count; i++) {
                    print duration_values[key "|" i] > tmpfile
                }
                close(tmpfile)

                # Sort using system sort
                cmd = "sort -n " tmpfile
                idx = 0
                while ((cmd | getline val) > 0) {
                    sorted_vals[++idx] = val
                }
                close(cmd)
                system("rm -f " tmpfile)

                # Calculate percentile indices
                p95_idx = int(count * 0.95)
                p99_idx = int(count * 0.99)
                if (p95_idx < 1) p95_idx = 1
                if (p99_idx < 1) p99_idx = 1
                if (p95_idx > count) p95_idx = count
                if (p99_idx > count) p99_idx = count

                results[++result_count] = group "|" sorted_vals[p95_idx] "|" sorted_vals[p99_idx] "|" count
                delete sorted_vals
            }
        }

        # Sort results by group name
        for (i = 1; i <= result_count; i++) {
            for (j = i + 1; j <= result_count; j++) {
                split(results[i], parts_i, "|")
                split(results[j], parts_j, "|")
                if (parts_i[1] > parts_j[1]) {
                    temp = results[i]
                    results[i] = results[j]
                    results[j] = temp
                }
            }
        }

        # Generate CSV for this scenario
        csv_filename = "SS_RT_" scenario "_" timestamp ".csv"
        print "Transaction Name,P95(ms),P99(ms),Count" > csv_filename
        for (i = 1; i <= result_count; i++) {
            split(results[i], parts, "|")
            printf "%s,%.0f,%.0f,%d\n", parts[1], parts[2], parts[3], parts[4] >> csv_filename
        }
        close(csv_filename)

        # Display percentiles
        printf "\n⏱️  STEADY-STATE PERCENTILES\n"
        print "═══════════════════════════════════════════════════════════════════════════════════════════════"
        printf "%-60s %12s %12s %10s\n", "Transaction Name", "P95(ms)", "P99(ms)", "Count"
        print "───────────────────────────────────────────────────────────────────────────────────────────────"

        for (i = 1; i <= result_count; i++) {
            split(results[i], parts, "|")
            printf "%-60s %12.0f %12.0f %10d\n", parts[1], parts[2], parts[3], parts[4]
        }

        print "═══════════════════════════════════════════════════════════════════════════════════════════════"
        printf "\n📄 CSV file generated: %s\n", csv_filename

        # Calculate full test duration percentiles for this scenario
        full_result_count = 0
        for (key in full_duration_count) {
            split(key, key_parts, "|")
            if (key_parts[1] == scenario) {
                group = key_parts[2]
                count = full_duration_count[key]

                # Write values to temp file with safe filename
                tmpfile = "/tmp/perf_full_" s "_" full_result_count "_" rand() ".txt"
                for (i = 1; i <= count; i++) {
                    print full_duration_values[key "|" i] > tmpfile
                }
                close(tmpfile)

                # Sort using system sort
                cmd = "sort -n " tmpfile
                idx = 0
                while ((cmd | getline val) > 0) {
                    sorted_vals[++idx] = val
                }
                close(cmd)
                system("rm -f " tmpfile)

                # Calculate percentile indices
                p95_idx = int(count * 0.95)
                p99_idx = int(count * 0.99)
                if (p95_idx < 1) p95_idx = 1
                if (p99_idx < 1) p99_idx = 1
                if (p95_idx > count) p95_idx = count
                if (p99_idx > count) p99_idx = count

                full_results[++full_result_count] = group "|" sorted_vals[p95_idx] "|" sorted_vals[p99_idx] "|" count
                delete sorted_vals
            }
        }

        # Sort full results by group name
        for (i = 1; i <= full_result_count; i++) {
            for (j = i + 1; j <= full_result_count; j++) {
                split(full_results[i], parts_i, "|")
                split(full_results[j], parts_j, "|")
                if (parts_i[1] > parts_j[1]) {
                    temp = full_results[i]
                    full_results[i] = full_results[j]
                    full_results[j] = temp
                }
            }
        }

        # Display full test duration percentiles
        printf "\n⏱️  FULL TEST DURATION PERCENTILES\n"
        print "═══════════════════════════════════════════════════════════════════════════════════════════════"
        printf "%-60s %12s %12s %10s\n", "Transaction Name", "P95(ms)", "P99(ms)", "Count"
        print "───────────────────────────────────────────────────────────────────────────────────────────────"

        for (i = 1; i <= full_result_count; i++) {
            split(full_results[i], parts, "|")
            printf "%-60s %12.0f %12.0f %10d\n", parts[1], parts[2], parts[3], parts[4]
        }

        print "═══════════════════════════════════════════════════════════════════════════════════════════════"

        # HTTP Requests by Status for this scenario (entire test duration)
        printf "\n🌐 HTTP REQUESTS BY STATUS (ENTIRE TEST)\n"
        print "═══════════════════════════════════════════════════════════════════════════════════════════════"
        printf "%-60s %8s %10s\n", "Group Name", "Status", "Count"
        print "───────────────────────────────────────────────────────────────────────────────────────────────"

        # Collect HTTP results for this scenario
        scenario_http_result_count = 0
        for (key in http_counts) {
            split(key, key_parts, "|")
            if (key_parts[1] == scenario) {
                scenario_http_results[++scenario_http_result_count] = key_parts[2] "|" key_parts[3] "|" http_counts[key]
            }
        }

        # Sort by count descending
        for (i = 1; i <= scenario_http_result_count; i++) {
            for (j = i + 1; j <= scenario_http_result_count; j++) {
                split(scenario_http_results[i], parts_i, "|")
                split(scenario_http_results[j], parts_j, "|")
                count_i = parts_i[3]
                count_j = parts_j[3]

                if (count_i < count_j) {
                    temp = scenario_http_results[i]
                    scenario_http_results[i] = scenario_http_results[j]
                    scenario_http_results[j] = temp
                }
            }
        }

        # Display HTTP results for this scenario
        for (i = 1; i <= scenario_http_result_count; i++) {
            split(scenario_http_results[i], parts, "|")
            printf "%-60s %8s %10d\n", parts[1], parts[2], parts[3]
        }

        print "═══════════════════════════════════════════════════════════════════════════════════════════════"

        # Clear results for next scenario
        delete results
        delete scenario_http_results
    }

    # Journey Error Rate (entire test duration)
    printf "\n\n"
    print "═══════════════════════════════════════════════════════════════════════════════════════════════"
    printf "  ENTIRE TEST SUMMARY\n"
    print "═══════════════════════════════════════════════════════════════════════════════════════════════"

    # ========================================================================
    # JOURNEY ERROR RATE CALCULATION (ENTIRE TEST DURATION)
    # ========================================================================
    # Formula: Error Rate = (Started - Completed) / Started * 100
    # Failed = Iterations that started but did not complete
    # Uses entire test duration data (not just steady-state)
    printf "\n❌ JOURNEY ERROR RATE (ENTIRE TEST)\n"
    print "─────────────────────────────────────────────────────────────────────────────────────"
    printf "%-30s %15s %12s %10s %12s\n", "Scenario", "Started", "Completed", "Failed", "Error Rate%"
    print "─────────────────────────────────────────────────────────────────────────────────────"
    total_started = 0
    total_completed = 0
    total_failed = 0
    for (scenario in total_iter_start_counts) {
        started = total_iter_start_counts[scenario]
        completed = (scenario in total_iter_complete_counts) ? total_iter_complete_counts[scenario] : 0
        failed = started - completed  # Iterations that did not complete
        error_rate = (started > 0) ? (failed / started) * 100 : 0  # Percentage
        total_started += started
        total_completed += completed
        total_failed += failed
        printf "%-30s %15d %12d %10d %11.2f\n", scenario, started, completed, failed, error_rate
    }
    # Calculate overall error rate across all scenarios
    overall_error_rate = (total_started > 0) ? (total_failed / total_started) * 100 : 0
    printf "%-30s %15d %12d %10d %11.2f\n", "TOTAL", total_started, total_completed, total_failed, overall_error_rate

    # ========================================================================
    # GENERATE JSON DATA FILE FOR EXCEL EXPORT
    # ========================================================================
    # Creates structured JSON with all metrics for Python script to consume
    # Includes: scenarios, totals, HTTP requests, full duration percentiles
    json_file = "perf_data_" timestamp ".json"
    print "{" > json_file
    printf "  \"timestamp\": \"%s\",\n", timestamp >> json_file
    print "  \"scenarios\": {" >> json_file

    scenario_idx = 0
    for (s = 1; s <= scenario_count; s++) {
        scenario = scenarios[s]
        scenario_idx++

        printf "    \"%s\": {\n", scenario >> json_file
        printf "      \"iter_started\": %d,\n", (scenario in iter_start_counts) ? iter_start_counts[scenario] : 0 >> json_file
        printf "      \"iter_completed\": %d,\n", (scenario in iter_complete_counts) ? iter_complete_counts[scenario] : 0 >> json_file

        if (mode == "multi") {
            duration = scenario_duration[scenario]
        } else {
            duration = single_duration
        }
        count = (scenario in iter_complete_counts) ? iter_complete_counts[scenario] : 0
        throughput = (duration > 0) ? count / duration : 0
        printf "      \"throughput\": %.2f,\n", throughput >> json_file

        started = total_iter_start_counts[scenario]
        completed = (scenario in total_iter_complete_counts) ? total_iter_complete_counts[scenario] : 0
        failed = started - completed
        error_rate = (started > 0) ? (failed / started) * 100 : 0

        printf "      \"total_started\": %d,\n", started >> json_file
        printf "      \"total_completed\": %d,\n", completed >> json_file
        printf "      \"failed\": %d,\n", failed >> json_file
        printf "      \"error_rate\": %.2f\n", error_rate >> json_file

        if (scenario_idx < scenario_count) {
            print "    }," >> json_file
        } else {
            print "    }" >> json_file
        }
    }

    print "  }," >> json_file
    print "  \"total\": {" >> json_file
    printf "    \"started\": %d,\n", total_started >> json_file
    printf "    \"completed\": %d,\n", total_completed >> json_file
    printf "    \"failed\": %d,\n", total_failed >> json_file
    printf "    \"error_rate\": %.2f\n", overall_error_rate >> json_file
    print "  }," >> json_file
    print "  \"http_requests\": {" >> json_file

    # Export HTTP requests by scenario
    for (s = 1; s <= scenario_count; s++) {
        scenario = scenarios[s]
        printf "    \"%s\": [\n", scenario >> json_file

        # Collect HTTP results for this scenario
        scenario_http_result_count = 0
        for (key in http_counts) {
            split(key, key_parts, "|")
            if (key_parts[1] == scenario) {
                http_export[++scenario_http_result_count] = key_parts[2] "|" key_parts[3] "|" http_counts[key]
            }
        }

        # Sort by count descending
        for (i = 1; i <= scenario_http_result_count; i++) {
            for (j = i + 1; j <= scenario_http_result_count; j++) {
                split(http_export[i], parts_i, "|")
                split(http_export[j], parts_j, "|")
                if (parts_i[3] < parts_j[3]) {
                    temp = http_export[i]
                    http_export[i] = http_export[j]
                    http_export[j] = temp
                }
            }
        }

        for (i = 1; i <= scenario_http_result_count; i++) {
            split(http_export[i], parts, "|")
            gsub(/"/, "\\\"", parts[1])  # Escape quotes
            printf "      {\"group\": \"%s\", \"status\": \"%s\", \"count\": %d}", parts[1], parts[2], parts[3] >> json_file
            if (i < scenario_http_result_count) {
                print "," >> json_file
            } else {
                print "" >> json_file
            }
        }

        if (s < scenario_count) {
            print "    ]," >> json_file
        } else {
            print "    ]" >> json_file
        }

        delete http_export
    }

    print "  }," >> json_file
    print "  \"full_duration_percentiles\": {" >> json_file

    # Export full duration percentiles by scenario
    for (s = 1; s <= scenario_count; s++) {
        scenario = scenarios[s]
        printf "    \"%s\": [\n", scenario >> json_file

        # Collect full duration results for this scenario
        full_export_count = 0
        for (key in full_duration_count) {
            split(key, key_parts, "|")
            if (key_parts[1] == scenario) {
                group = key_parts[2]
                count = full_duration_count[key]

                # Write values to temp file with safe filename
                tmpfile = "/tmp/perf_export_" s "_" full_export_count "_" rand() ".txt"
                for (i = 1; i <= count; i++) {
                    print full_duration_values[key "|" i] > tmpfile
                }
                close(tmpfile)

                # Sort using system sort
                cmd = "sort -n " tmpfile
                idx = 0
                while ((cmd | getline val) > 0) {
                    sorted_vals[++idx] = val
                }
                close(cmd)
                system("rm -f " tmpfile)

                # Calculate percentile indices
                p95_idx = int(count * 0.95)
                p99_idx = int(count * 0.99)
                if (p95_idx < 1) p95_idx = 1
                if (p99_idx < 1) p99_idx = 1
                if (p95_idx > count) p95_idx = count
                if (p99_idx > count) p99_idx = count

                full_export[++full_export_count] = group "|" sorted_vals[p95_idx] "|" sorted_vals[p99_idx] "|" count
                delete sorted_vals
            }
        }

        # Sort by group name
        for (i = 1; i <= full_export_count; i++) {
            for (j = i + 1; j <= full_export_count; j++) {
                split(full_export[i], parts_i, "|")
                split(full_export[j], parts_j, "|")
                if (parts_i[1] > parts_j[1]) {
                    temp = full_export[i]
                    full_export[i] = full_export[j]
                    full_export[j] = temp
                }
            }
        }

        for (i = 1; i <= full_export_count; i++) {
            split(full_export[i], parts, "|")
            gsub(/"/, "\\\"", parts[1])
            printf "      {\"transaction\": \"%s\", \"p95\": %.0f, \"p99\": %.0f, \"count\": %d}", parts[1], parts[2], parts[3], parts[4] >> json_file
            if (i < full_export_count) {
                print "," >> json_file
            } else {
                print "" >> json_file
            }
        }

        if (s < scenario_count) {
            print "    ]," >> json_file
        } else {
            print "    ]" >> json_file
        }

        delete full_export
    }

    print "  }" >> json_file
    print "}" >> json_file
    close(json_file)

    print "\n📄 JSON data file generated: " json_file
}'

# End timing and calculate duration
END_TIMESTAMP=$(date +%s.%N)
EXECUTION_TIME=$(echo "$END_TIMESTAMP - $START_TIMESTAMP" | bc -l)

echo ""
echo "⏱️  PERFORMANCE METRICS"
echo "─────────────────────────"
printf "Execution Time: %.2f seconds\n" $EXECUTION_TIME
echo "Completed at: $(date)"
echo ""

# ============================================================================
# EXCEL REPORT GENERATION
# ============================================================================
# Calls Python script to generate Excel workbook with three tabs:
#   1. Response Time (steady-state & full duration percentiles)
#   2. Journey Error Rate
#   3. HTTP Requests by status code
# Requires: python3 and openpyxl library

JSON_FILE=$(ls -t perf_data_*.json 2>/dev/null | head -1)  # Find most recent JSON file

if [[ -n "$JSON_FILE" ]] && [[ -f "$JSON_FILE" ]]; then
    # Extract timestamp from JSON filename (format: perf_data_YYYY-MM-DD-HH-MM-SS.json)
    TIMESTAMP=$(echo "$JSON_FILE" | sed 's/perf_data_\(.*\)\.json/\1/')
    echo "📊 Generating Excel report..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"  # Get script directory

    # Check if python3 is available
    if command -v python3 &> /dev/null; then
        # Check if openpyxl library is installed
        if python3 -c "import openpyxl" 2>/dev/null; then
            # Generate Excel report using Python script
            python3 "${SCRIPT_DIR}/generate_excel_report.py" "$TIMESTAMP" "$JSON_FILE"
        else
            echo "⚠️  Warning: openpyxl not installed. Install with: pip3 install openpyxl"
            echo "   Excel report not generated, but JSON data available: $JSON_FILE"
        fi
    else
        echo "⚠️  Warning: python3 not found. Excel report not generated."
        echo "   JSON data available: $JSON_FILE"
    fi
fi

echo ""
echo "✅ Combined analysis complete!"

# ============================================================================
# CREATE OUTPUT DIRECTORY AND MOVE FILES INTO IT
# ============================================================================
OUTPUT_DIR="analysis_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"
mv SS_RT_*_${TIMESTAMP}.csv "$OUTPUT_DIR/" 2>/dev/null || true
mv perf_data_${TIMESTAMP}.json "$OUTPUT_DIR/" 2>/dev/null || true
mv Performance_Report_${TIMESTAMP}.xlsx "$OUTPUT_DIR/" 2>/dev/null || true
cd "$OUTPUT_DIR"

echo ""
echo "🔍 Checking for SLA breaches..."
echo "   P95 SLA: 1000ms | P99 SLA: 2500ms"
echo ""

# Find breached transactions from CSV files
BREACHED_TRANSACTIONS=()
ALL_TRANSACTIONS=()
for csv_file in SS_RT_*_${TIMESTAMP}.csv; do
    if [[ -f "$csv_file" ]]; then
        while IFS=',' read -r txn p95 p99 count; do
            if [[ "$txn" != "Transaction Name" ]]; then
                ALL_TRANSACTIONS+=("$txn")
                if (( $(echo "$p95 > 1000" | bc -l) )) || (( $(echo "$p99 > 2500" | bc -l) )); then
                    BREACHED_TRANSACTIONS+=("$txn")
                    echo "⚠️  BREACH: $txn (P95: ${p95}ms, P99: ${p99}ms)"
                fi
            fi
        done < "$csv_file"
    fi
done



if [[ ${#BREACHED_TRANSACTIONS[@]} -eq 0 ]]; then
    echo "✅ No SLA breaches detected"
fi

# Ask user if they want detailed analysis
echo ""
read -p "Generate response time graphs? (yes/no) [no]: " DETAILED_ANALYSIS
DETAILED_ANALYSIS=${DETAILED_ANALYSIS:-no}

if [[ "$DETAILED_ANALYSIS" == "yes" ]]; then
    echo ""
    read -p "Generate graphs for all the transactions or only SLA breaches? (all/breach) [breach]: " ANALYSIS_MODE
    ANALYSIS_MODE=${ANALYSIS_MODE:-breach}
fi

# Determine which transactions to analyze for detailed analysis
if [[ "$DETAILED_ANALYSIS" == "yes" ]]; then
    if [[ "$ANALYSIS_MODE" == "breach" ]]; then
        TRANSACTIONS_TO_ANALYZE=("${BREACHED_TRANSACTIONS[@]}")
        echo "📊 Detailed analysis mode: SLA breaches only"
    else
        TRANSACTIONS_TO_ANALYZE=("${ALL_TRANSACTIONS[@]}")
        echo "📊 Detailed analysis mode: All transactions"
    fi
else
    TRANSACTIONS_TO_ANALYZE=()
    echo "📊 Skipping Generation of response time graphs"
fi

if [[ ${#TRANSACTIONS_TO_ANALYZE[@]} -gt 0 ]]; then
    echo ""
    echo "📊 Generating response time graphs for ${#TRANSACTIONS_TO_ANALYZE[@]} transaction(s)..."

    # Extract transaction data from results.gz
    if [[ -f "../$INPUT" ]]; then
        echo "   Extracting transaction data..."

        # Filter and create CSV for each transaction
        for txn in "${TRANSACTIONS_TO_ANALYZE[@]}"; do
            # Sanitize filename
            safe_name=$(echo "$txn" | sed 's/[^a-zA-Z0-9_]/_/g')
            output_file="${safe_name}.csv"

            echo "   Processing: $txn"

            # Extract data directly for this transaction
            gunzip -c "../$INPUT" | jq -r --arg txn "$txn" '
                select(.type=="Point" and .metric=="duration" and .data.tags.group == $txn) |
            [(.data.time), .data.tags.group, .data.value] | @csv' > "$output_file"

            if [[ -s "$output_file" ]]; then
                echo "     ✓ Created $output_file ($(wc -l < "$output_file") records)"
            else
                echo "     ⚠ No data found for $txn"
                rm -f "$output_file"
            fi
        done

        # Generate graphs using Python
        if command -v python3 &> /dev/null; then
            echo ""
            echo "📈 Generating graphs..."

            cat > /tmp/plot_breaches.py << 'PYEOF'
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path
import sys
import warnings
import matplotlib.dates as mdates
warnings.filterwarnings('ignore')

output_dir = sys.argv[1]
transactions = sys.argv[2:]

for txn in transactions:
    safe_name = ''.join(c if c.isalnum() or c == '_' else '_' for c in txn)
    csv_file = f"{output_dir}/{safe_name}.csv"

    if not Path(csv_file).exists():
        continue

    try:
        # Read CSV and clean extra quotes
        data = []
        with open(csv_file, 'r') as f:
            for line in f:
                line = line.strip().strip('"')
                parts = line.split(',')
                if len(parts) >= 3:
                    timestamp = parts[0].strip('\\"')
                    duration = float(parts[-1].strip('\\"'))
                    data.append({'timestamp': timestamp, 'duration': duration})

        if not data:
            continue

        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])

        # Resample to 1-second intervals
        df = df.set_index('timestamp').resample('1S')['duration'].mean().dropna().reset_index()

        if len(df) == 0:
            continue

        plt.figure(figsize=(14, 7))
        plt.plot(df['timestamp'], df['duration'], linewidth=1, alpha=0.7)

        # Add SLA lines
        plt.axhline(y=1000, color='orange', linestyle='--', label='P95 SLA (1000ms)', linewidth=2)
        plt.axhline(y=2500, color='red', linestyle='--', label='P99 SLA (2500ms)', linewidth=2)

        plt.xlabel('Time', fontsize=12)
        plt.ylabel('Duration (ms)', fontsize=12)
        plt.title(f'{txn}\nResponse Time Over Test Duration', fontsize=14, fontweight='bold')
        plt.legend(loc='upper right')
        plt.grid(True, alpha=0.3)
        plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))
        plt.xticks(rotation=45)
        plt.tight_layout()

        output_png = f"{output_dir}/{safe_name}.png"
        plt.savefig(output_png, dpi=150, bbox_inches='tight')
        plt.close()

        print(f"     ✓ Generated {output_png}")
    except Exception as e:
        print(f"     ✗ Error processing {txn}: {e}")
PYEOF

            python3 /tmp/plot_breaches.py "." "${TRANSACTIONS_TO_ANALYZE[@]}"
            rm -f /tmp/plot_breaches.py
        else
            echo "⚠️  Python3 not found - skipping graph generation"
        fi
    else
        echo "⚠️  $INPUT not found - skipping detailed analysis"
    fi

    echo ""
    echo "📁 Analysis Complete - All files saved to: $OUTPUT_DIR/"
    echo "   - Steady-state CSVs: $OUTPUT_DIR/SS_RT_*.csv"
    echo "   - Transaction data: $OUTPUT_DIR/*.csv"
    echo "   - Response time graphs: $OUTPUT_DIR/*.png"
    echo "   - Excel report: $OUTPUT_DIR/Performance_Report_${TIMESTAMP}.xlsx"
else
    echo ""
    echo "📁 Analysis Complete - All files saved to: $OUTPUT_DIR/"
    echo "   - Steady-state CSVs: $OUTPUT_DIR/SS_RT_*.csv"
    echo "   - JSON data: $OUTPUT_DIR/perf_data_${TIMESTAMP}.json"
    echo "   - Excel report: $OUTPUT_DIR/Performance_Report_${TIMESTAMP}.xlsx"
fi
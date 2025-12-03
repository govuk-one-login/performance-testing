# Multi-Scenario Performance Report Generator

**Author:** Umair Farooqui
**Created:** December 2025
**Last Updated:** 03-Dec-2025
**Version:** 1.0

---

## Overview
`multi-scenario-performance-report-generator.sh` supports per-scenario steady-state time windows, allowing accurate performance analysis when running multiple k6 scenarios with different start and end times.

## Features
- **Per-Scenario Steady-State Windows**: Each scenario can have its own unique steady-state period
- **Separate CSV Exports**: Generates individual CSV files for each scenario's percentiles
- **Automated Calculations**: Throughput and percentiles calculated per scenario
- **Backward Compatible**: Supports single scenario mode with global time window

## Usage

### Interactive Mode (Recommended)
Run without parameters to be prompted for scenario details:

```bash
./multi-scenario-performance-report-generator.sh results.gz
```

The script will prompt you for:
1. **Total number of scenarios** in the test
2. For each scenario:
   - **Scenario Name**
   - **Steady-State Start Time** (HH:MM:SS)
   - **Steady-State End Time** (HH:MM:SS)

**Example Interactive Session:**
```
=== Performance Test Steady-State Configuration ===

Enter the total number of scenarios in the test: 2

--- Scenario 1 of 2 ---
Enter Scenario Name: drivingLicence
Enter Steady-State Start Time (HH:MM:SS): 13:03:55
Enter Steady-State End Time (HH:MM:SS): 13:33:55

--- Scenario 2 of 2 ---
Enter Scenario Name: drivingLicenceAttestation
Enter Steady-State Start Time (HH:MM:SS): 13:04:10
Enter Steady-State End Time (HH:MM:SS): 13:34:10
```

### Command-Line Mode

#### Single Scenario
When all scenarios share the same steady-state window:

```bash
./multi-scenario-performance-report-generator.sh results.gz "13:05:03" "13:35:03"
```

#### Multi-Scenario
When scenarios have different steady-state windows:

```bash
./multi-scenario-performance-report-generator.sh results.gz "scenario1:START:END,scenario2:START:END"
```

**Format**: `scenarioName:HH:MM:SS:HH:MM:SS`
- Scenario name followed by colon
- Start time in HH:MM:SS format
- End time in HH:MM:SS format
- Multiple scenarios separated by commas

### Example: Two Scenarios with Different Windows

```bash
./multi-scenario-performance-report-generator.sh results.gz \
  "drivingLicence:13:03:55:13:33:55,drivingLicenceAttestation:13:04:10:13:34:10"
```

This example:
- **drivingLicence**: Steady-state from 13:03:55 to 13:33:55 (30 minutes)
- **drivingLicenceAttestation**: Steady-state from 13:04:10 to 13:34:10 (30 minutes)

## Output

### Per-Scenario Sections
For each scenario, the script generates:

1. **Iterations Started (Steady-State)**
   - Count of iterations started within the scenario's steady-state window

2. **Iterations Completed & Throughput (Steady-State)**
   - Count of completed iterations
   - Throughput (iterations/second) calculated using scenario-specific duration

3. **Steady-State Percentiles**
   - P95 and P99 response times for all transactions
   - Only includes data from the scenario's steady-state window
   - Alphabetically sorted by transaction name

4. **CSV Export**
   - Filename format: `SS_RT_{scenarioName}_{timestamp}.csv`
   - Contains: Transaction Name, P95(ms), P99(ms), Count
   - One CSV file per scenario

5. **HTTP Requests by Status (Entire Test)**
   - All HTTP requests for this scenario across entire test duration
   - Grouped by status code
   - Sorted by count (descending)

### Global Section
Applies to entire test duration (all scenarios):

1. **Journey Error Rate**
   - Iterations started vs completed
   - Failed iterations and error rate percentage
   - Calculated across entire test duration
   - Shows per-scenario and total error rates

## Key Differences from Original Script

| Feature | Original Script | Multi-Scenario Script |
|---------|----------------|----------------------|
| Steady-State Window | Single global window | Per-scenario windows |
| CSV Files | One combined file | One file per scenario |
| Throughput Calculation | Uses global duration | Uses scenario-specific duration |
| Percentiles | Mixed across scenarios | Isolated per scenario |
| Accuracy | Inaccurate for multi-scenario | Accurate per scenario |

## When to Use Which Script

### Use `combined-performance-report.sh` (original) when:
- Running a single scenario
- All scenarios have identical steady-state periods
- Quick analysis needed without per-scenario breakdown

### Use `multi-scenario-performance-report-generator.sh` when:
- Running multiple scenarios with different ramp-up times
- Scenarios have different steady-state start/end times
- Need accurate per-scenario metrics
- Require separate CSV exports per scenario

## Example Output

```
═══════════════════════════════════════════════════════════════════════════════════════════════
  SCENARIO: drivingLicence
═══════════════════════════════════════════════════════════════════════════════════════════════

🚀 ITERATIONS STARTED (STEADY-STATE)
───────────────────────────────────────────────
Scenario                                 Count
───────────────────────────────────────────────
drivingLicence                            4135

✅ ITERATIONS COMPLETED & THROUGHPUT (STEADY-STATE)
─────────────────────────────────────────────────────────────────────
Scenario                                 Count       Throughput/sec
─────────────────────────────────────────────────────────────────────
drivingLicence                            4138                 2.30

⏱️  STEADY-STATE PERCENTILES
═══════════════════════════════════════════════════════════════════════════════════════════════
Transaction Name                                                  P95(ms)      P99(ms)      Count
───────────────────────────────────────────────────────────────────────────────────────────────
::B02_Driving_01_DLEntryFromCoreStub_DVA                              288          320       2079
::B02_Driving_02_Select_DVA                                            89          117       2079
...

📄 CSV file generated: SS_RT_drivingLicence_2025-12-02-10-43-09.csv
```

## Performance
- Execution time: ~5-6 seconds for 200K records
- Single-pass data processing
- Memory-efficient streaming

## Requirements
- bash
- jq
- awk
- bc (for timing calculations)

## Troubleshooting

### No data in steady-state window
- Verify scenario names match exactly (case-sensitive)
- Check time format is HH:MM:SS
- Ensure times are within actual test data range
- Confirm scenario names exist in test data

### Incorrect throughput values
- Verify start time is before end time
- Check duration calculation (end - start)
- Ensure time format is correct

### Missing CSV files
- Check write permissions in current directory
- Verify script completed successfully
- Look for error messages in output

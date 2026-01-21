# Multi-Scenario Performance Report Generator

**Created:** 03-Dec-2025
**Last Updated:** 21-Jan-2026

**Version:** 4.0

---

## Overview

Advanced performance reporting tool for k6 test results with multi-scenario support, SLA breach detection, and automated visualization.

### Key Features
- Per-scenario steady-state time windows
- SLA breach detection (P95: 1000ms, P99: 2500ms)
- User-selectable detailed analysis (optional)
- Automated graph generation for breached transactions
- Excel report with multiple tabs
- Organized timestamped output folders

### Files
- `multi-scenario-performance-report-generator.sh` - Main reporting script
- `generate_excel_report.py` - Excel report generator

---

## Quick Start

### Prerequisites
- Python 3 with `openpyxl`: `pip3 install openpyxl`
- `jq`, `awk`, `bc` (pre-installed on macOS/Linux)
- k6 test results file (results.gz)

### Basic Usage
```bash
cd deploy/reporting/advanced-reporting
./multi-scenario-performance-report-generator.sh ../results.gz
```

### Interactive Prompts

**Prompt 1: Scenario Configuration**
```
Enter the total number of scenarios in the test: 2

--- Scenario 1 of 2 ---
Enter Scenario Name: signIn
Enter Steady-State Start Time (HH:MM:SS): 17:43:10
Enter Steady-State End Time (HH:MM:SS): 18:13:10
```

**Prompt 2: Detailed Analysis** (after SLA breach detection)
```
Generate detailed transaction analysis? (yes/no) [no]: yes
```
- `no` → Quick summary only (CSV, Excel, JSON)
- `yes` → Full analysis with transaction CSVs and graphs

**Prompt 3: Analysis Scope** (only if detailed analysis = yes)
```
Analyze all transactions or only SLA breaches? (all/breach) [breach]: breach
```
- `breach` → Only analyze SLA-breached transactions (recommended)
- `all` → Analyze all transactions

### Command-Line Mode (Non-Interactive)

```bash
# Single scenario
./multi-scenario-performance-report-generator.sh ../results.gz "signIn:17:43:10:18:13:10"

# Multi-scenario
./multi-scenario-performance-report-generator.sh ../results.gz "signIn:17:43:10:18:13:10,signUp:17:49:13:18:19:13"
```

**Format**: `scenarioName:HH:MM:SS:HH:MM:SS` (comma-separated for multiple scenarios)

---

## Output Structure

All outputs saved in: `advanced-reporting/analysis_YYYY-MM-DD-HH-MM-SS/`

### Always Generated
- `SS_RT_*.csv` - Steady-state percentiles per scenario (P95, P99, Count)
- `Performance_Report_*.xlsx` - Excel report with tabs:
  - Response Time (steady-state & full duration percentiles)
  - Journey Error Rate
  - HTTP Requests by status
  - SLA Breach Graphs (if breaches detected)
- `perf_data_*.json` - JSON data for programmatic access

### Generated Only if Detailed Analysis = Yes
- `*_transaction.csv` - Individual transaction data
- `*.png` - Response time graphs with SLA lines

### Metrics Reported
- **Iterations Started/Completed** (steady-state)
- **Throughput** (iterations/second per scenario)
- **Percentiles** (P95, P99 for all transactions)
- **Journey Error Rate** (entire test duration)
- **HTTP Requests** (grouped by status code)

---

## Implementation Details

### Folder Structure
```
deploy/reporting/
├── create-summary.sh              # Legacy reporting
└── advanced-reporting/            # Advanced reporting
    ├── multi-scenario-performance-report-generator.sh
    ├── generate_excel_report.py
    └── analysis_YYYY-MM-DD-HH-MM-SS/  # Output folders
        ├── SS_RT_*.csv
        ├── Performance_Report_*.xlsx
        ├── perf_data_*.json
        ├── *_transaction.csv (optional)
        └── *.png (optional)
```

### Key Capabilities
- **Per-Scenario Steady-State**: Each scenario has its own time window for accurate analysis
- **SLA Breach Detection**: Automatically identifies transactions exceeding P95 (1000ms) or P99 (2500ms)
- **User Control**: Choose between quick summary or detailed analysis
- **Self-Contained**: All files and outputs stay in advanced-reporting/
- **No Conflicts**: Outputs never mix with legacy tools

---

## Troubleshooting

**Error: "results.gz not found"**
- Ensure results.gz is in the correct location
- Use absolute path: `./multi-scenario-performance-report-generator.sh /full/path/to/results.gz`

**Error: "openpyxl not installed"**
- Install: `pip3 install openpyxl`
- Script will still generate CSV and JSON files

**No data in steady-state window**
- Verify scenario names match exactly (case-sensitive)
- Check time format is HH:MM:SS
- Ensure times are within actual test data range

**P95/P99 showing as 0**
- Fixed in v3.0 using temp files and system sort
- Handles transactions with any number of occurrences

---

## Tips

1. **Quick Check**: Answer "no" to detailed analysis for fast summary reports
2. **Investigation**: Answer "yes" + "breach" to focus on problematic transactions
3. **Comprehensive**: Answer "yes" + "all" for complete analysis (slower)
4. **Cleanup**: Old output folders can be deleted manually to save space

---

## Version History

**v4.0 (21-Jan-2026)**
- Added folder inside report i.e. Advanced-reporting to keep it separate from the existing reporting utility.

**v3.0 (22-Dec-2025)**
- Added SLA breach detection and automated graph generation
- User-selectable detailed analysis mode
- Excel report with SLA breach graphs tab

**v2.0 (22-Dec-2025)**
- Fixed P95/P99 calculation for transactions with >200K records
- Replaced string concatenation with temp files and system sort

**v1.0 (03-Dec-2025)**
- Initial release with per-scenario steady-state support

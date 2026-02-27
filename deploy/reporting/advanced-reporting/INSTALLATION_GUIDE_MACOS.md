# Installation Guide: Multi-Scenario Performance Report Generator (macOS)

Step-by-step installation guide for macOS users to set up all prerequisites for the `multi-scenario-performance-report-generator.sh` script.

## System Requirements

- **Operating System**: macOS 10.14 (Mojave) or later
- **Disk Space**: Minimum 500MB free space
- **Memory**: Minimum 4GB RAM (8GB+ recommended for large datasets)

## Prerequisites Installation

### Step 1: Install Homebrew (Package Manager)

**Check if installed:**
```bash
brew --version
```

**Install:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**After installation, follow the on-screen instructions to add Homebrew to your PATH.**

### Step 2: Install jq (JSON Processor)

**Purpose:** Parses JSON data from k6 results files.

**Check if installed:**
```bash
jq --version
```

**Install:**
```bash
brew install jq
```

**Verify:**
```bash
jq --version
# Expected: jq-1.6 or higher
```

### Step 3: Verify gzip/gunzip (Pre-installed)

**Purpose:** Decompresses k6 results files (`.gz` format).

**Verify:**
```bash
gunzip --version
```

**Note:** gzip/gunzip comes pre-installed with macOS. No installation needed.

### Step 4: Verify awk (Pre-installed)

**Purpose:** Processes and analyzes performance metrics data.

**Verify:**
```bash
awk --version
```

### Step 5: Install bc (Basic Calculator)

**Purpose:** Performs floating-point arithmetic for execution time calculations.

**Check if installed:**
```bash
bc --version
```

**Install:**
```bash
brew install bc
```

**Verify:**
```bash
bc --version
# Expected: bc 1.x or higher
```

### Step 6: Install Python 3

**Purpose:** Generates Excel reports and response time graphs.

**Check if installed:**
```bash
python3 --version
```

**Install:**
```bash
brew install python3
```

**Verify:**
```bash
python3 --version
# Expected: Python 3.7 or higher
```

### Step 7: Install Python Libraries

**Required libraries:**
- `openpyxl` - Excel report generation
- `pandas` - Data processing
- `matplotlib` - Graph generation

**Install all at once:**
```bash
pip3 install openpyxl pandas matplotlib
```

**Verify installation:**
```bash
python3 -c "import openpyxl; print('openpyxl:', openpyxl.__version__)"
# Expected: openpyxl 3.1.5 or higher

python3 -c "import pandas; print('pandas:', pandas.__version__)"
# Expected: pandas 2.3.3 or higher

python3 -c "import matplotlib; print('matplotlib:', matplotlib.__version__)"
# Expected: matplotlib 3.10.8 or higher
```

**Troubleshooting: If you encounter "error: externally-managed-environment"**

Use a virtual environment instead:
```bash
cd deploy/reporting/advanced-reporting
python3 -m venv .venv
source .venv/bin/activate
pip install pandas openpyxl matplotlib
```

**Important Note:** When using a virtual environment, activate it (`source .venv/bin/activate`) from the `advanced-reporting` directory before running the report generator script.

## Quick Verification

Verify all prerequisites are installed:
```bash
jq --version && bc --version && python3 --version
```

If all commands return version numbers, you're ready to use the report generator.
# owockibot Treasury Auditor

Automated tool that audits all owockibot mechanism subdomains and checks whether each one displays the correct canonical treasury address in its footer.

## What it does

- Scans all 25 owockibot mechanism subdomains
- Checks the treasury address displayed on each
- Reports matches, mismatches, and unreachable subdomains
- Runs automatically every Monday at 09:00 UTC via GitHub Actions
- Opens a GitHub Issue automatically if any mismatch is detected

## Canonical Treasury

`0x26B7805Dd8aEc26DA55fc8e0c659cf6822b740Be`

## Usage

Open `index.html` in a browser to run a manual audit via the dashboard.

## GitHub Actions

The workflow runs weekly and uploads an `audit-report.json` artifact with full results.

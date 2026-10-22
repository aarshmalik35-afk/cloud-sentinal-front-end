# CloudSentinel — Cloud Security Posture Scanner

CloudSentinel is a cloud security posture assessment tool designed to identify common security misconfigurations in AWS-style cloud infrastructure configurations. It evaluates configuration data against predefined security rules, generates findings with remediation guidance, and provides a risk score to help users understand potential security weaknesses.

The project demonstrates the fundamentals of cloud security monitoring, security misconfiguration detection, risk assessment, and remediation reporting.

## Live Demo

- **Frontend:** https://aarshmalik35-afk.github.io/cloud-sentinal-front-end/

## Key Features

- **Security Misconfiguration Detection:** Checks configuration data for common cloud security risks.
- **Risk Scoring:** Calculates a security score based on detected findings.
- **Severity Classification:** Categorizes findings by severity to help prioritize remediation.
- **Remediation Guidance:** Provides actionable recommendations for addressing identified issues.
- **Scenario-Based Scanning:** Supports secure, moderate-risk, and high-risk sample configurations.
- **Scan History:** Stores previous scan results for review.
- **Scan Comparison:** Compares scan results to help identify changes in security posture.
- **Report Generation:** Provides scan reports for reviewing findings and remediation steps.
- **Web Dashboard:** Offers a frontend for running scans and reviewing results.

## Security Checks

The scanner evaluates configuration data for issues such as:

- S3 bucket public access and access-block settings
- S3 encryption and versioning configuration
- S3 logging configuration
- Security groups exposing SSH or RDP to unrestricted sources
- IAM policies with wildcard actions or resources
- CloudTrail logging status
- Missing monitoring alarms

## Technology Stack

**Frontend**
- React
- Vite
- JavaScript

**Backend**
- Python
- FastAPI
- SQLite

**Security and Data Processing**
- Rule-based security checks
- JSON-based sample configurations
- Risk scoring and finding classification

**Deployment**
- GitHub Pages
- Render

## Architecture

1. The user selects a sample security scenario in the frontend.
2. The frontend sends the scan request to the FastAPI backend.
3. The backend evaluates the configuration against predefined security rules.
4. Findings are classified by severity and used to calculate a risk score.
5. Scan results are stored for history and comparison.
6. The frontend displays the results and remediation recommendations.

## Getting Started

### Prerequisites

- Python 3.10 or later
- Node.js and npm
- Git

### Backend Setup

Clone the backend repository and navigate to its directory.

```bash
git clone <YOUR_BACKEND_REPOSITORY_URL>
cd <BACKEND_DIRECTORY>
```

Create and activate a virtual environment:

```bash
python -m venv .venv
```

On Windows:

```bash
.venv\Scripts\activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Start the API:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`. Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend Setup

Clone the frontend repository:

```bash
git clone https://github.com/aarshmalik35-afk/cloud-sentinal-front-end.git
cd cloud-sentinal-front-end
```

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Configure the frontend API base URL to point to the local backend when developing locally.

## Project Scope and Limitations

CloudSentinel currently evaluates **sample configuration data** representing AWS-style resources. Scenario-based scans demonstrate how different configurations can produce different findings and risk scores.

The deployed version does not directly connect to or scan a live AWS account. Results depend on the configuration data supplied to the scanner and the security rules implemented in the project.

## Future Improvements

- Integration with AWS APIs for authorized, read-only configuration assessment
- Additional cloud security checks and policy validation
- IAM least-privilege analysis
- Improved trend visualization and security posture tracking
- Exportable reports and enhanced audit logging
- Automated security checks aligned with recognized cloud security benchmarks

## Responsible Use

CloudSentinel is intended for educational use, defensive security research, and authorized cloud security assessment. Any future integration with real cloud environments should use least-privilege permissions and follow the account owner's authorization and security requirements.

## Author

**Aarsh Malik**

GitHub: https://github.com/aarshmalik35-afk

---

*CloudSentinel is an educational project demonstrating cloud security posture assessment, rule-based detection, risk scoring, and remediation reporting.*

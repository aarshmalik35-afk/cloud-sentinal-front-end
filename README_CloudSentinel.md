# CloudSentinel 🛡️
### Cloud Security Posture Assessment & Monitoring

CloudSentinel is a defensive, portfolio-focused cloud security project that evaluates **simulated AWS-style configurations** for common security misconfigurations. It turns configuration data into prioritized findings, a heuristic security posture score, and remediation guidance through a web dashboard.

> **Important:** CloudSentinel currently analyzes supplied/simulated configuration data. It does **not** connect to or scan a live AWS account, and it does not modify cloud resources.

## ✨ Features

- **Rule-based security assessment** of supported configuration fields.
- **Scenario-based scans** for Secure, Moderate Risk, and High Risk environments.
- **Security findings** with severity, affected resource, evidence, explanation, and remediation guidance where provided by the scanner.
- **Posture score** derived from severity-weighted findings.
- **Scan history** stored in SQLite for reviewing previous assessments.
- **Scan comparison** to identify new, resolved, and unchanged findings where supported by the deployed API.
- **REST API** built with FastAPI.
- **Web dashboard** built with React and Vite.
- **Automated tests** for scanner and API behavior.

## 🧰 Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | Python, FastAPI, Pydantic |
| Data / history | JSON configuration files, SQLite |
| Testing | pytest, HTTPX |
| Frontend hosting | GitHub Pages |
| Backend hosting | Render |

## 🔍 Security Checks

The current rule set includes checks for selected settings such as:

- S3 public access controls
- S3 default encryption
- S3 bucket versioning
- S3 access logging
- Public SSH and RDP exposure in security group configuration
- IAM wildcard actions and resource scope
- CloudTrail audit logging
- Security monitoring alarm configuration

Coverage depends on the rules and schema implemented in the current scanner. This is not a complete AWS security audit or a compliance certification.

## 🏗️ Architecture

```text
React + Vite Dashboard
        |
        | HTTP / JSON
        v
FastAPI Backend
        |
        +--> Scenario / sample JSON configuration
        |
        +--> Rule-based scanner
        |       |
        |       +--> Findings + severity
        |       +--> Posture score
        |       +--> Remediation guidance
        |
        +--> SQLite scan history
        |
        v
Scan result returned to dashboard
```

## 📁 Project Structure

The backend scenario files are expected directly inside `sample_data/`:

```text
CloudSentinel/
├── frontend/
│   ├── src/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
└── backend/
    ├── app/
    │   ├── main.py
    │   └── scanner.py
    ├── sample_data/
    │   ├── aws_config.json
    │   ├── secure.json
    │   ├── moderate_risk.json
    │   └── high_risk.json
    ├── tests/
    │   ├── test_scanner.py
    │   └── test_main.py
    └── requirements.txt
```

Your actual repository may use different top-level folder names; preserve the structure already used by your project.

## 🚀 Run Locally

### Prerequisites

- Python 3.10+ (use the version supported by your backend dependencies)
- Node.js and npm
- Git

### 1. Start the backend

Open a terminal in the backend directory.

```bash
python -m venv .venv
```

Activate the environment:

**Windows PowerShell**
```powershell
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux**
```bash
source .venv/bin/activate
```

Install dependencies and start the API:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API should be available at:

- API root: `http://127.0.0.1:8000/`
- Health check: `http://127.0.0.1:8000/health`
- Interactive API docs: `http://127.0.0.1:8000/docs`

If your backend uses a different ASGI start command, follow the command configured in its deployment settings.

### 2. Start the frontend

Open another terminal in the frontend directory.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (commonly `http://localhost:5173`).

Ensure the frontend API base URL points to the local backend for local development. For a Vite app, this is commonly configured with `VITE_API_BASE_URL`; use the variable and `.env` conventions present in your repository.

## 🧪 Run Tests

From the backend root directory:

```bash
python -m pip install pytest httpx
python -m pytest -q
```

Run a specific test file:

```bash
python -m pytest -q tests/test_scanner.py
python -m pytest -q tests/test_main.py
```

The API tests require the scenario-enabled backend implementation and the corresponding scenario JSON files. If tests fail, inspect the error and verify that test expectations match the current API response schema.

## 🌐 Deployment

The current deployment setup is:

- **Frontend:** GitHub Pages
- **Backend:** Render

Before deploying, verify:

1. The scenario JSON files are committed to the backend repository and filenames match exactly.
2. The frontend's production API URL points to the deployed backend.
3. The backend CORS configuration allows the exact deployed frontend origin.
4. The frontend Vite base path matches the GitHub Pages repository path.
5. The backend deployment starts successfully and `/health` returns an OK status.
6. The `/scenarios` endpoint lists the expected scenario profiles, if enabled in the deployed version.

**Scenario file names must match exactly:** `secure.json`, `moderate_risk.json`, and `high_risk.json`. On Linux hosting, capitalization matters.

### Deployment URLs

- Frontend: [CloudSentinel Dashboard](https://aarshmalik35-afk.github.io/cloud-sentinal-front-end/)
- Backend health: [API Health Check](https://cloud-sentinal-backend.onrender.com/health)
- Interactive API docs: [API Documentation](https://cloud-sentinal-backend.onrender.com/docs)

## 📊 How the Posture Score Works

The score is a project-specific heuristic calculated from the severity weights in the scanner. In the original inspected implementation, the weights were:

| Severity | Weight |
|---|---:|
| Critical | 25 |
| High | 15 |
| Medium | 7 |
| Low | 3 |
| Info | 0 |

The original formula subtracts severity-weighted deductions from 100, with deductions capped at 100:

```python
deductions = sum(SEVERITY_WEIGHTS[f["severity"]] for f in findings)
score = max(0, 100 - min(100, deductions))
```

Check `app/scanner.py` in your final repository before publishing this section. If you changed the scoring formula during later development, update this description to match the deployed code. The score is **not** an industry-standard or compliance rating.

## 🔐 Security & Responsible Use

- Use sample or simulated configuration data unless a separately implemented and authorized live integration is added.
- Do not commit AWS credentials, API keys, passwords, or other secrets.
- Keep CORS origins restricted to the intended frontend and development origins.
- Treat scan results as configuration-based indicators, not proof of live cloud state.
- Review and validate findings before making security decisions.
- CloudSentinel does not automatically remediate cloud resources.

## 🛣️ Future Improvements

Possible next steps include:

- Optional read-only AWS integration using least-privilege IAM permissions
- Expanded detection rules and schema validation
- Authentication and role-based access control
- Persistent managed database storage
- Scheduled scans and alerting
- Improved historical trend analysis
- Downloadable PDF/CSV reports
- More integration and end-to-end tests

These are future ideas unless explicitly implemented in the current codebase.

## 🤝 Contributing

Contributions and suggestions are welcome. A useful contribution should include:

1. A clearly scoped change.
2. Tests for new or modified rules.
3. Updated documentation for changed API behavior.
4. No secrets or real account identifiers in sample files.

## 📄 License

No license is specified here. Add a `LICENSE` file and update this section before inviting reuse or redistribution.

---

**Built as a learning and portfolio project focused on cloud security, defensive analysis, and explainable configuration findings.**

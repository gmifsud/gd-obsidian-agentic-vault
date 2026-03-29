---
type: devops_resource
resource_name: ""
agent_summary: "What this pipeline/infra does and when an agent should modify it."
tech_stack: [] # e.g., [Docker, Terraform]
related_repos: []
environment: "prod | staging | dev"
criticality: "high | medium | low"
---

# {{resource_name}}

## Pipeline / Infrastructure Flow
- 

## Target Configuration Files
- `.github/workflows/deploy.yml`

## Common Failure Modes
- **Error:** `OOMKilled`
  **Fix:** Increase memory limit in `k8s/deployment.yaml`

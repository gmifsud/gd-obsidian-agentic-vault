---
type: moc
moc_name: "DevOps"
agent_summary: "Index of infrastructure, CI/CD pipelines, and runbooks."
---
# DevOps MOC

## CI/CD Pipelines
- [[20_DevOps/Pipe - CI Build and Deploy|CI Build and Deploy]] - `environment: all`

## Infrastructure
- [[20_DevOps/Infra - Kubernetes Cluster|Kubernetes Cluster]] - `environment: prod`

## Dataview Auto-Index (For Human Readers)
```dataview
TABLE agent_summary, environment, criticality
FROM "20_DevOps"
WHERE type = "devops_resource"
```

## Static Agent Index
- [[Infra - Kubernetes Cluster]] | environment: prod | tech_stack: Kubernetes,Docker
- [[Pipe - CI Build and Deploy]] | environment: all | tech_stack: GitHub Actions,Docker

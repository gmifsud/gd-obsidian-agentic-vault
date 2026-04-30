---
type: moc
moc_name: "DevOps"
agent_summary: "Index of infrastructure, CI/CD pipelines, and runbooks."
---
# DevOps MOC

## CI/CD Pipelines
- [[20_DevOps/github-actions-deploy|GitHub Actions Deploy]] - `environment: prod`
- [[20_DevOps/gitlab-ci-test|GitLab CI Testing]] - `environment: dev`

## Infrastructure
- [[20_DevOps/terraform-aws-core|Terraform AWS Core]] - `criticality: high`
- [[20_DevOps/k8s-cluster-config|Kubernetes Cluster Config]] - `criticality: high`

## Dataview Auto-Index (For Human Readers)
```dataview
TABLE agent_summary, environment, criticality
FROM "20_DevOps"
WHERE type = "devops_resource"
```

## Static Agent Index
- [[Infra - Kubernetes Cluster]] | environment: prod | tech_stack: Kubernetes,Docker
- [[Pipe - CI Build and Deploy]] | environment: all | tech_stack: GitHub Actions,Docker

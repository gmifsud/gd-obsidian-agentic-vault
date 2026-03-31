---
type: git_resource
resource_name: "PR Template"
agent_summary: "Standard template for creating pull requests, ensuring all necessary information is included."
tech_stack: ["Git", "GitHub"]
environment: "all"
---

# PR Template

## Overview
This resource provides a standard template for creating pull requests, ensuring all necessary information is included. It standardizes the review process by requiring contributors to detail the description, changes, testing, and related issues.

## Configuration / Setup
To enforce this template in your repository, copy the markdown body below (excluding the YAML frontmatter and Configuration section) and save it as `.github/pull_request_template.md` in the root of your repository.

## Usage
When opening a new Pull Request, fill out the following sections:

### Description
[Provide a high-level summary of the changes introduced by this PR. Explain the "why" behind the changes.]

### Changes
- [ ] Added feature X
- [ ] Fixed bug Y
- [ ] Refactored component Z

### Testing
[Describe the testing steps you have performed to verify your changes. Include any relevant test cases or environments used.]
- [ ] Unit tests passed
- [ ] Manual testing completed in staging

### Related Issues
- Fixes #123
- Related to #456

## Related Links
- [GitHub PR Templates Documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)

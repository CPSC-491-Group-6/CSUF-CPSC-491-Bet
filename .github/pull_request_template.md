# Pull Request Template

## Summary

<!-- Briefly describe what this pull request changes and why. -->

## Related Jira Work Item

<!-- Paste the Jira issue URL for this work. -->

## Type of Change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Automated test
- [ ] CI/CD or development tooling
- [ ] Documentation
- [ ] Other

## Local Validation

<!-- Check the items that apply to this pull request. -->

- [ ] I ran the affected application or feature locally.
- [ ] I ran `./scripts/ci-check.sh`, or the relevant component CI script.
- [ ] Backend checks pass locally, if this change affects the backend.
- [ ] Frontend lint/build checks pass locally, if this change affects the frontend.
- [ ] I added or updated automated tests when appropriate.
- [ ] I did not commit credentials, secrets, local databases, or generated dependency folders.

## CI/CD Impact

<!-- Explain any CI/CD changes or write "None". -->

- [ ] This pull request does not require CI/CD changes.
- [ ] This pull request adds or changes an automated test.
- [ ] This pull request changes a local CI script.
- [ ] This pull request changes a GitHub Actions workflow.
- [ ] This pull request changes build/versioning behavior.

## Reviewer Notes

<!-- Call out anything the reviewer should test or inspect closely. -->

## Review Requirement

- [ ] This pull request has been reviewed by another group member before merge.
- [ ] Required automated checks pass before merge.

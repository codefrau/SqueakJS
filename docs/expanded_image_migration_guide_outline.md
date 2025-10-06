# Expanded Image Compatibility – Documentation & Migration Guide Outline

## Purpose
Provide a production-ready reference that operators can follow to evaluate, convert, and run legacy Squeak images inside the hardened browser VM. The guide should combine narrative guidance with runnable examples and cross-links to automation.

## Target Audience
- Platform engineers embedding the VM into web properties.
- Power users maintaining legacy Smalltalk images.
- Support staff triaging image boot failures.

## Deliverables
1. **Support Matrix**
   - Table summarizing supported/unsupported combinations (Spur vs. non-Spur, 32/64-bit, endianness).
   - Notes on known caveats (e.g., feature gaps, performance tradeoffs).
   - Link to telemetry log locations for unsupported image detection.
2. **Conversion Workflow**
   - Step-by-step CLI walkthrough using `convert-image` with sample fixtures.
   - Explanation of emitted artifacts (reports, transformed images).
   - Guidance for validating object and selector counts post-conversion.
   - Automation hooks for CI/CD (e.g., npm scripts, GitHub Actions snippets).
3. **Native Loader Usage**
   - Configuration required to enable the compatibility loader in browser builds.
   - Instructions for hosting converted assets (MIME types, caching advice).
   - Checklist for verifying boot to Smalltalk prompt with screenshots/log snippets.
4. **Troubleshooting Playbook**
   - Decision tree keyed by loader telemetry (unsupported header, checksum mismatch, quota errors).
   - Common remediation steps and links back to conversion workflow.
   - FAQs addressing mixed-endian images, embedded plugins, or missing sources.
5. **Validation & Regression Strategy**
   - How to run the compatibility regression suite locally (`npm run test:compat`).
   - Expected outputs and how to interpret failures.
   - Template for documenting newly discovered image variants.
6. **Change Management Notes**
   - Versioning policy for the migration guide itself.
   - Recommended communication plan when deprecating unsupported formats.

## Implementation Tasks
- [ ] Draft support matrix using data gathered from Milestones 1–3 telemetry.
- [ ] Create CLI usage examples with copy-pasteable commands and expected console output.
- [ ] Capture screenshots/log excerpts for successful native loader boots.
- [ ] Author troubleshooting decision tree and FAQ entries.
- [ ] Integrate validation instructions referencing existing automated tests.
- [ ] Submit draft for review and iterate based on feedback from VM maintainers.

## Acceptance Criteria Traceability
- The published guide must live in `docs/` and be referenced from the main README.
- Examples must be runnable against repository fixtures without additional setup.
- Troubleshooting section should map each failure mode logged by the compatibility loader to at least one corrective action.
- Validation instructions should cite exact commands/scripts that already exist in the repo.

## Future Enhancements
- Localize the guide for high-priority locales once content stabilizes.
- Add embed-ready snippets (HTML/Markdown) for downstream documentation portals.
- Integrate with analytics to track which troubleshooting nodes are most frequently accessed.

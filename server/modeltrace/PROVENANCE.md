# ModelTrace Attribution

Source: https://github.com/xqy2006/ModelTrace
Revision: 55a2e4a55170423b484d701e9a82ab62b268c811
License: MIT (see LICENSE).

Unmodified upstream files:
- static/fingerprint-core.js
- static/challenge-browser.js
- static/data/unified_bank.json

The observatory uses the upstream three independent challenges and calibrated
16-candidate global classifier. Transport is OpenAI Responses, with no tools,
system prompt, temperature or explicit reasoning override. This differs from
the upstream automatic collector's Chat Completions/Anthropic transport and
can influence distributions. Three accepted, non-truncated samples are required.
The group can route the three requests to different upstream accounts: these
are endpoint-level observations, not evidence about a particular account.
Failed rounds have no probability and never reuse previous results as current.

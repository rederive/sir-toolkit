---
name: synth
description: Synthesize a capability via the Semantic Compiler's doesNotUnderstand loop.
user_invocable: true
---

# /synth - Synthesize a Capability

Synthesize a new capability from a natural language description. Uses the full pipeline: decompose → verify → synthesize → validate → install.

Run this command with a description of what you want:

```
/synth compute the hamming distance between two integers
```

This will:
1. Search the Method Dictionary for existing matches
2. If not found, trigger doesNotUnderstand synthesis
3. Generate LLVM IR via Claude Code (`claude -p`)
4. Validate structurally (LLVM parse) and behaviorally (test execution)
5. Install permanently to the dictionary

Use the MCP tools:
```
mcp__semcom__send_intent(intent="$ARGUMENTS", test_cases="[]")
```

Or via Python:
```bash
cd ~/endgame && source .venv/bin/activate
python -c "
from semcom.decomposer import decompose_intent
from semcom.harness.iterative_composer import iterative_compose
plan = decompose_intent('$ARGUMENTS')
result = iterative_compose(plan, output_path=None)
print(f'Synthesized: {result.synthesized}, Failed: {result.failed}')
"
```

Note: as of J.4 (Workstream J), `decompose_intent` is the closed-loop
skill-driven entry point. It iterates internally against its validator
(see `semcom/orchestration/decomposer_tools.py:validate_decomposition_plan`)
so a separate `verify_and_repair` step is no longer needed.

# Neural Engine Post-Mortems

## Auto-Generated Lessons & Negative Constraints

### ❌ [2026-09-25] engines/claude-seo/01-claude-seo-lifecycle-kernel.ts `source: mutation-cycle`
**Symptom:** AST / TypeScript Compiler Validation Rejected
**EVIDENCE (Machine-Copied Fact):**
```
Line 23, Col 20: '{' expected.
Line 23, Col 41: ';' expected.
Line 24, Col 3: Declaration or statement expected.
Line 24, Col 10: Declaration or statement expected.
Line 25, Col 3: Declaration or statement expected.
Line 25, Col 10: Declaration or statement expected.
Line 26, Col 3: Declaration or statement expected.
Line 26, Col 10: Declaration or statement expected.
Line 27, Col 3: Declaration or statement expected.
Line 28, Col 3: Declaration or statement expected.
Line 28, Col 47: ')' expected.
Line 28, Col 57: ';' expected.
Line 28, Col 85: ';' expected.
Line 28, Col 87: Declaration or statement expected.
Line 28, Col 95: Expression expected.
Line 28, Col 109: Expression expected.
Line 28, Col 113: Expression expected.
Line 29, Col 3: Declaration or statement expected.
Line 31, Col 20: ',' expected.
Line 31, Col 52: ',' expected.
Line 31, Col 70: ',' expected.
Line 31, Col 106: ',' expected.
Line 31, Col 114: ';' expected.
Line 37, Col 3: Declaration or statement expected.
Line 37, Col 23: ',' expected.
Line 37, Col 40: ',' expected.
Line 37, Col 44: ';' expected.
Line 38, Col 9: ':' expected.
Line 38, Col 35: ',' expected.
Line 41, Col 3: Declaration or statement expected.
Line 41, Col 22: ',' expected.
Line 41, Col 31: ';' expected.
Line 41, Col 33: Unexpected keyword or identifier.
Line 51, Col 3: Declaration or statement expected.
Line 51, Col 16: ',' expected.
Line 51, Col 25: ';' expected.
Line 51, Col 27: Unexpected keyword or identifier.
Line 56, Col 3: Declaration or statement expected.
Line 56, Col 21: ',' expected.
Line 56, Col 49: ',' expected.
Line 56, Col 75: ',' expected.
Line 56, Col 97: ';' expected.
Line 56, Col 105: Expression expected.
Line 56, Col 120: ';' expected.
Line 56, Col 121: Declaration or statement expected.
Line 56, Col 123: Unexpected keyword or identifier.
Line 73, Col 3: Declaration or statement expected.
Line 73, Col 10: Unexpected keyword or identifier.
Line 73, Col 29: ',' expected.
Line 73, Col 57: ',' expected.
Line 73, Col 61: ';' expected.
Line 73, Col 75: Expression expected.
Line 74, Col 11: ':' expected.
Line 74, Col 43: ',' expected.
Line 75, Col 18: ',' expected.
Line 75, Col 38: ';' expected.
Line 89, Col 3: Declaration or statement expected.
Line 89, Col 22: ',' expected.
Line 89, Col 43: ';' expected.
Line 89, Col 72: ';' expected.
Line 93, Col 3: Declaration or statement expected.
Line 93, Col 10: Unexpected keyword or identifier.
Line 93, Col 25: ';' expected.
Line 93, Col 39: Expression expected.
Line 94, Col 11: ':' expected.
Line 94, Col 53: ',' expected.
Line 95, Col 9: ':' expected.
Line 95, Col 29: ',' expected.
Line 96, Col 10: Identifier expected. 'const' is a reserved word that cannot be used here.
Line 96, Col 16: ',' expected.
Line 96, Col 18: ',' expected.
Line 96, Col 21: ',' expected.
Line 103, Col 5: ',' expected.
Line 103, Col 9: ':' expected.
Line 103, Col 23: ',' expected.
Line 104, Col 9: ':' expected.
Line 104, Col 26: ',' expected.
Line 106, Col 1: Declaration or statement expected.
```
**CONSTRAINT (Model Generalization):** Never repeat code patterns that produce this compiler/linter error on engines/claude-seo/01-claude-seo-lifecycle-kernel.ts.

### ❌ [2026-09-25] engines/claude-seo/02-claude-seo-react-loop-engine.ts `source: mutation-cycle`
**Symptom:** AST / TypeScript Compiler Validation Rejected
**EVIDENCE (Machine-Copied Fact):**
```
Line 33, Col 20: '{' expected.
Line 33, Col 40: ';' expected.
Line 35, Col 13: ',' expected.
Line 35, Col 16: ',' expected.
Line 36, Col 13: ',' expected.
Line 36, Col 25: ',' expected.
Line 37, Col 13: ',' expected.
Line 37, Col 20: ',' expected.
Line 38, Col 13: ',' expected.
Line 38, Col 20: ',' expected.
Line 39, Col 13: ',' expected.
Line 39, Col 19: ',' expected.
Line 39, Col 40: ',' expected.
Line 40, Col 5: ';' expected.
Line 42, Col 3: Declaration or statement expected.
Line 42, Col 10: Unexpected keyword or identifier.
Line 42, Col 34: ',' expected.
Line 42, Col 43: ';' expected.
Line 43, Col 81: ',' expected.
Line 44, Col 28: An element access expression should take an argument.
Line 44, Col 29: ',' expected.
Line 45, Col 24: ',' expected.
Line 47, Col 11: ':' expected.
Line 47, Col 48: ',' expected.
Line 48, Col 11: ':' expected.
Line 48, Col 58: ',' expected.
Line 49, Col 11: ':' expected.
Line 49, Col 21: ',' expected.
Line 49, Col 33: ',' expected.
Line 49, Col 34: Expression expected.
Line 49, Col 36: ':' expected.
Line 49, Col 40: ',' expected.
Line 51, Col 9: ':' expected.
Line 51, Col 78: ',' expected.
Line 52, Col 9: ':' expected.
Line 52, Col 66: ',' expected.
Line 54, Col 9: ',' expected.
Line 54, Col 23: ',' expected.
Line 55, Col 9: ',' expected.
Line 55, Col 33: ',' expected.
Line 56, Col 9: ',' expected.
Line 56, Col 31: ',' expected.
Line 58, Col 23: ',' expected.
Line 139, Col 5: ',' expected.
Line 139, Col 12: ':' expected.
Line 143, Col 6: ',' expected.
```
**CONSTRAINT (Model Generalization):** Never repeat code patterns that produce this compiler/linter error on engines/claude-seo/02-claude-seo-react-loop-engine.ts.

### ❌ [2026-09-25] engines/claude-seo/03-claude-seo-unified-model-stream-adapter.ts `source: mutation-cycle`
**Symptom:** AST / TypeScript Compiler Validation Rejected
**EVIDENCE (Machine-Copied Fact):**
```
Line 18, Col 20: '{' expected.
Line 18, Col 37: ';' expected.
Line 19, Col 23: ',' expected.
Line 19, Col 34: ',' expected.
Line 19, Col 67: ';' expected.
Line 21, Col 3: Declaration or statement expected.
Line 21, Col 40: ',' expected.
Line 21, Col 46: An element access expression should take an argument.
Line 21, Col 54: ',' expected.
Line 21, Col 60: An element access expression should take an argument.
Line 21, Col 62: ';' expected.
Line 22, Col 9: ':' expected.
Line 23, Col 13: ':' expected.
Line 27, Col 9: ',' expected.
Line 29, Col 11: Identifier expected.
Line 29, Col 20: ',' expected.
Line 29, Col 23: ',' expected.
Line 29, Col 25: Property assignment expected.
Line 35, Col 9: Unexpected keyword or identifier.
Line 35, Col 52: ';' expected.
Line 39, Col 11: Unexpected keyword or identifier.
Line 41, Col 21: ';' expected.
Line 43, Col 19: ';' expected.
Line 44, Col 19: ';' expected.
Line 45, Col 13: Expression expected.
Line 45, Col 14: Declaration or statement expected.
Line 48, Col 9: Unexpected keyword or identifier.
Line 48, Col 45: ';' expected.
Line 53, Col 9: Unexpected keyword or identifier.
Line 53, Col 46: ';' expected.
Line 55, Col 7: Unexpected keyword or identifier.
Line 55, Col 43: ';' expected.
Line 56, Col 7: 'try' expected.
Line 58, Col 7: Unexpected keyword or identifier.
Line 60, Col 21: ';' expected.
Line 61, Col 7: Expression expected.
Line 62, Col 7: Unexpected keyword or identifier.
Line 64, Col 18: ';' expected.
Line 65, Col 7: Expression expected.
Line 66, Col 7: Unexpected keyword or identifier.
Line 66, Col 43: ';' expected.
Line 68, Col 3: Declaration or statement expected.
Line 69, Col 1: Declaration or statement expected.
```
**CONSTRAINT (Model Generalization):** Never repeat code patterns that produce this compiler/linter error on engines/claude-seo/03-claude-seo-unified-model-stream-adapter.ts.

### ❌ [2026-09-25] engines/claude-seo/04-claude-seo-tool-sandbox-virtual-file-system-engine.ts `source: mutation-cycle`
**Symptom:** AST / TypeScript Compiler Validation Rejected
**EVIDENCE (Machine-Copied Fact):**
```
Line 17, Col 20: '{' expected.
Line 17, Col 42: ';' expected.
Line 18, Col 3: Declaration or statement expected.
Line 20, Col 27: ',' expected.
Line 20, Col 58: ';' expected.
Line 26, Col 3: Declaration or statement expected.
Line 26, Col 28: ',' expected.
Line 26, Col 37: ';' expected.
Line 26, Col 39: Unexpected keyword or identifier.
Line 27, Col 38: Unterminated regular expression literal.
Line 27, Col 72: ')' expected.
Line 30, Col 3: Declaration or statement expected.
Line 30, Col 24: ',' expected.
Line 30, Col 41: ',' expected.
Line 30, Col 50: ';' expected.
Line 31, Col 11: ':' expected.
Line 31, Col 48: ',' expected.
Line 32, Col 9: ':' expected.
Line 37, Col 7: ',' expected.
Line 40, Col 3: Declaration or statement expected.
Line 40, Col 23: ',' expected.
Line 40, Col 32: ';' expected.
Line 40, Col 34: Unexpected keyword or identifier.
Line 49, Col 3: Declaration or statement expected.
Line 49, Col 21: ',' expected.
Line 49, Col 30: ';' expected.
Line 49, Col 32: Unexpected keyword or identifier.
Line 53, Col 3: Declaration or statement expected.
Line 53, Col 25: ',' expected.
Line 53, Col 34: ';' expected.
Line 53, Col 36: Unexpected keyword or identifier.
Line 57, Col 3: Declaration or statement expected.
Line 57, Col 36: ';' expected.
Line 57, Col 45: An element access expression should take an argument.
Line 57, Col 47: ';' expected.
Line 68, Col 3: Declaration or statement expected.
Line 68, Col 29: ',' expected.
Line 68, Col 54: ',' expected.
Line 68, Col 82: ',' expected.
Line 68, Col 91: ';' expected.
Line 68, Col 93: Unexpected keyword or identifier.
Line 79, Col 20: '{' expected.
Line 79, Col 36: ';' expected.
Line 80, Col 3: Declaration or statement expected.
Line 82, Col 27: ',' expected.
Line 82, Col 58: ';' expected.
Line 86, Col 3: Declaration or statement expected.
Line 86, Col 21: ';' expected.
Line 96, Col 3: Declaration or statement expected.
Line 96, Col 10: Unexpected keyword or identifier.
Line 96, Col 34: ',' expected.
Line 96, Col 48: ',' expected.
Line 96, Col 62: ',' expected.
Line 96, Col 84: ';' expected.
Line 97, Col 11: ':' expected.
Line 97, Col 29: ',' expected.
Line 98, Col 9: ',' expected.
Line 98, Col 20: ',' expected.
Line 99, Col 9: ',' expected.
Line 99, Col 24: ',' expected.
Line 101, Col 9: ':' expected.
Line 102, Col 16: ',' expected.
Line 102, Col 31: ',' expected.
Line 102, Col 33: Property assignment expected.
Line 104, Col 9: Declaration or statement expected.
Line 118, Col 7: 'try' expected.
Line 130, Col 3: Declaration or statement expected.
Line 132, Col 3: Declaration or statement expected.
Line 132, Col 11: Unexpected keyword or identifier.
Line 132, Col 33: ',' expected.
Line 132, Col 42: ';' expected.
Line 133, Col 11: ':' expected.
Line 133, Col 31: ',' expected.
Line 134, Col 9: Identifier expected.
Line 134, Col 19: '{' expected.
Line 134, Col 26: ':' expected.
Line 134, Col 28: ',' expected.
Line 136, Col 11: ':' expected.
Line 136, Col 39: ',' expected.
Line 137, Col 11: ':' expected.
Line 137, Col 29: ',' expected.
Line 139, Col 17: ',' expected.
Line 139, Col 27: ';' expected.
Line 160, Col 3: Declaration or statement expected.
Line 162, Col 3: Declaration or statement expected.
Line 162, Col 24: ',' expected.
Line 162, Col 33: ';' expected.
Line 162, Col 35: Unexpected keyword or identifier.
Line 165, Col 1: Declaration or statement expected.
```
**CONSTRAINT (Model Generalization):** Never repeat code patterns that produce this compiler/linter error on engines/claude-seo/04-claude-seo-tool-sandbox-virtual-file-system-engine.ts.

### ❌ [2026-09-25] engines/claude-seo/05-claude-seo-non-linear-session-tree-token-budget-engine.ts `source: mutation-cycle`
**Symptom:** AST / TypeScript Compiler Validation Rejected
**EVIDENCE (Machine-Copied Fact):**
```
Line 139, Col 20: '{' expected.
Line 139, Col 42: ';' expected.
Line 139, Col 50: Unexpected keyword or identifier.
```
**CONSTRAINT (Model Generalization):** Never repeat code patterns that produce this compiler/linter error on engines/claude-seo/05-claude-seo-non-linear-session-tree-token-budget-engine.ts.

### ❌ [2026-09-25] engines/autogpt/04-autogpt-tool-sandbox-virtual-file-system-engine.ts `source: mutation-cycle`
**Symptom:** AST / TypeScript Compiler Validation Rejected
**EVIDENCE (Machine-Copied Fact):**
```
Line 27, Col 38: Unterminated regular expression literal.
Line 27, Col 72: ')' expected.
```
**CONSTRAINT (Model Generalization):** Never repeat code patterns that produce this compiler/linter error on engines/autogpt/04-autogpt-tool-sandbox-virtual-file-system-engine.ts.

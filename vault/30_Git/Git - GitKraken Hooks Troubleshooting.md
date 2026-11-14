---
type: git_resource
resource_name: "GitKraken Hooks Troubleshooting"
agent_summary: "Root-cause analysis and remediation for GitKraken CLI agent hooks crashing Claude Code tool calls with Go runtime out-of-memory and Windows commit-limit errors."
tech_stack: ["GitKraken CLI", "Claude Code", "Go", "PowerShell", "Git Bash"]
environment: "Windows"
---

# GitKraken Hooks Troubleshooting

## Problem

When AI coding agents (specifically Claude Code `2.1.323` on Windows) execute tool calls (`Bash`, `Read`, etc.), the GitKraken CLI hook (`gk ai hook run --host claude-code`) intermittently crashes with Go runtime out-of-memory panics or `/usr/bin/bash` `Resource temporarily unavailable` errors. When a `PreToolUse` hook crashes with a non-zero exit code, Claude Code rejects the underlying tool invocation before the command runs.

## Symptoms

During parallel tool calls (`Read` + `Bash`) in session `38eaa9d0-916e-497a-9f73-5bca73d50c61` (`C:\Users\grego\.claude\projects\D--Repos-LLM-llm-agentforge-cli\38eaa9d0-916e-497a-9f73-5bca73d50c61.jsonl`, lines 58–63, `2026-11-14T09:02:31Z`), four simultaneous hook failures occurred:

1. **Go heap arena allocation panic on `PreToolUse:Bash` (`gk-alpha.exe`):**
   ```text
   PreToolUse:Bash hook error: ["C:/Users/grego/AppData/Local/GitKrakenCLI/gk-alpha.exe" ai hook run --host claude-code]: fatal error: out of memory allocating heap arena map

   runtime stack:
   runtime.throw({0x7ff689fe4e70?, 0x0?})
       runtime/panic.go:1094 +0x4d fp=0x98417ff618 sp=0x98417ff5e8 pc=0x7ff688548b6d
   runtime.(*mheap).sysAlloc(0x7ff68b36afa0, 0x4?, 0x7ff68b37b3a0, 0x7ff68b37b3c8)
       runtime/malloc.go:776 +0x3b6 fp=0x98417ff6d0 sp=0x98417ff618 pc=0x7ff6884e9316
   ...
   runtime.schedinit()
       runtime/proc.go:876 +0xe5 fp=0x98417ffb30 sp=0x98417ffae0 pc=0x7ff688518385
   runtime.rt0_go()
       runtime/asm_amd64.s:349 +0x13c fp=0x98417ffb38 sp=0x98417ffb30 pc=0x7ff68854ecdc

   This hook comes from the gitkraken-hooks@gitkraken plugin.
   ```

2. **Git Bash fork/exec failure on `PreToolUse:Bash` (`gk.exe`, exit code `126`):**
   ```text
   Failed with non-blocking status code: /usr/bin/bash: line 1: C:/Users/grego/AppData/Local/GitKrakenCLI/gk.exe: Resource temporarily unavailable
   ```

3. **Windows PowerShell CLR initialization failure on `PreToolUse:Bash` (`dispatcher.ps1`, exit code `127`):**
   ```text
   Internal Windows PowerShell error. Loading managed Windows PowerShell failed with error 800705af.
   ```
   (`0x800705af` = Win32 error `1455` / `ERROR_COMMITMENT_LIMIT`: *"The paging file is too small for this operation to complete."*)

4. **Go `persistentalloc` failure on `PostToolUse:Read` (`gk.exe`):**
   ```text
   PostToolUse:Read hook blocking error from command: "\"C:/Users/grego/AppData/Local/GitKrakenCLI/gk.exe\" ai hook run --host claude-code":
   fatal error: runtime: cannot allocate memory
   runtime.rt0_go() -> runtime.schedinit() -> runtime.mallocinit() -> runtime.(*mheap).init() -> runtime.persistentalloc1()
   ```

5. **Continuous JSON parse warnings in `C:\Users\grego\AppData\Local\GitKrakenCLI\gk_cli.log`:**
   ```json
   {"error":"invalid character 'ï' looking for beginning of value","level":"warning","msg":"aihook: failed to parse hook input","time":"2026-11-14T13:30:49.1080428+01:00"}
   ```

6. **Installer proxy paging file errors in `C:\Users\grego\AppData\Local\GitKrakenCLI\gk_cli_proxy.log`:**
   ```json
   {"error":"command failed:\n main.execute\n gkcli/cmd/installer-proxy/main.go:506\n - failed to run core binary: The paging file is too small for this operation to complete.:\n gkcli/internal/installerproxy.(*svc).doProxy\n gkcli/internal/installerproxy/service.go:543","level":"error","msg":"command failed"}
   ```

## Root Cause

### Confirmed Findings

1. **3x Redundant GitKraken Hook Invocations per Event:**
   Every Claude Code lifecycle event (`PreToolUse`, `PostToolUse`, `PermissionRequest`, `Notification`, `UserPromptSubmit`, `Stop`, etc.) was configured to spawn GitKraken CLI **three times** concurrently:
   - **Instance 1 (`dispatcher.ps1`):** `C:\Users\grego\.claude\settings.json` invokes `powershell.exe -NonInteractive -File "C:\Users\grego\.claude\hooks\dispatcher.ps1"`, which piped stdin into `C:\Users\grego\AppData\Local\GitKrakenCLI\gk-alpha.exe ai hook run --host claude-code`.
   - **Instance 2 (`gk-alpha.exe` in plugin):** `gitkraken-hooks@gitkraken` (`3.1.80`) registered `"C:/Users/grego/AppData/Local/GitKrakenCLI/gk-alpha.exe" ai hook run --host claude-code` with `"matcher": ".*"` in both:
     - `C:\Users\grego\.claude\plugins\cache\gitkraken\gitkraken-hooks\3.1.80\hooks\hooks.json`
     - `C:\Users\grego\.claude\plugins\marketplaces\gitkraken\plugins\gitkraken-hooks\hooks\hooks.json`
   - **Instance 3 (`gk.exe` in plugin):** The same `hooks.json` files also registered `"C:/Users/grego/AppData/Local/GitKrakenCLI/gk.exe" ai hook run --host claude-code` with `"matcher": ""`.

2. **50 MB Go Binaries Exhausting Windows Commit Charge During Parallel Tool Calls:**
   - `C:\Users\grego\AppData\Local\GitKrakenCLI\gk.exe` symlinks to `versions\gk_3_1_80\gk_3_1_80.exe` (`50,075,320` bytes).
   - `C:\Users\grego\AppData\Local\GitKrakenCLI\gk-alpha.exe` symlinks to `versions\gk_3_1_80-alpha_3\gk_3_1_80-alpha_3.exe` (`50,075,320` bytes).
   - Alongside `Run-OrcaHook.ps1` and `dispatcher.ps1` (which also spawns `node.exe` for Tabby status), two parallel tool calls (`Read` + `Bash`) simultaneously spawned **6 instances of 50 MB Go binaries, 4 `powershell.exe` processes, 4 `/usr/bin/bash` shells, and 2 `node.exe` processes**.
   - During a system-wide Windows pagefile commit spike (concurrently observed in `D:\Repos\GitCthulhu` session `db9e084c-edc7-4751-84dd-f3c3e38b4355.jsonl` where `gix` packfile memory mappings triggered `os error 1455`), Windows returned `0x800705af` (`ERROR_COMMITMENT_LIMIT`), causing Go's `rt0_go -> schedinit -> mheap.sysAlloc` to panic before `main()` executed.

3. **Why Only `Bash` Appeared to Crash While `PowerShell` Worked:**
   - Claude Code executes all `"type": "command"` plugin hooks via `/usr/bin/bash` regardless of which tool is called (`Read`, `Bash`, or `PowerShell`).
   - `PreToolUse:Read` and `PreToolUse:Bash` both suffered hook crashes in the same second (`09:02:31Z`), but `PreToolUse:Bash` hit the fatal `gk-alpha.exe` panic that rejected the `Bash` tool use. When the agent switched to the `PowerShell` tool seconds later, the commit-charge spike had already cleared.

4. **UTF-8 BOM Corruption in `dispatcher.ps1`:**
   - In Windows PowerShell 5.1 (`powershell.exe`), piping `$stdinData | & $execPath @extraArgs` encodes the stream with a UTF-8 Byte Order Mark (`EF BB BF`, which decodes as `ï»¿` in Latin-1/Windows-1252).
   - `gk-alpha.exe`'s JSON parser rejected every single event from `dispatcher.ps1` with `invalid character 'ï' looking for beginning of value`.

### Unconfirmed / Hypotheses (Guesses)

- **Why `hooks.json` had both `gk-alpha.exe` and `gk.exe`:** Likely caused by running both the production `gk` channel (`3.1.80`) and alpha `gk-alpha` channel (`3.1.80-alpha.3`, auto-updated at `2026-11-14T11:38:26+01:00`), where `gk ai hook install` deduplicates hook entries by comparing the exact command string or matcher (`".*"` vs `""`), resulting in an append instead of an in-place replacement.

## Fix

Applied **Option B** (retain single production `gk.exe` plugin hook; remove duplicate `gk-alpha.exe` plugin hooks and broken `dispatcher.ps1` entry):

1. **Disabled redundant/broken `gitkraken` entry in `C:\Users\grego\.claude\hooks\dispatcher.ps1`:**
   ```powershell
   $hookRegistry = [ordered]@{
       # Tabby terminal status integration
       "tabby"     = "C:\Users\grego\AppData\Roaming\tabby\plugins\node_modules\tabby-claude-status-gse\hook.js"

       # GitKraken CLI integration (disabled here: handled by gitkraken-hooks@gitkraken plugin; PowerShell pipe also prepends UTF-8 BOM 'ï»¿' breaking JSON parse)
       # "gitkraken" = "C:\Users\grego\AppData\Local\GitKrakenCLI\gk-alpha.exe"
   }
   ```

2. **Deduplicated both plugin `hooks.json` files** (`C:\Users\grego\.claude\plugins\cache\gitkraken\gitkraken-hooks\3.1.80\hooks\hooks.json` and `C:\Users\grego\.claude\plugins\marketplaces\gitkraken\plugins\gitkraken-hooks\hooks\hooks.json`) so each lifecycle event invokes only `"C:/Users/grego/AppData/Local/GitKrakenCLI/gk.exe" ai hook run --host claude-code` once.

## How to Verify

1. **Confirm only one hook entry exists per event in `hooks.json`:**
   ```powershell
   Select-String -Path "$env:USERPROFILE\.claude\plugins\cache\gitkraken\gitkraken-hooks\3.1.80\hooks\hooks.json" -Pattern "gk-alpha\.exe"
   ```
   Expected output: no matches.

2. **Test `gk.exe ai hook run` directly without BOM errors:**
   ```powershell
   $ tailBefore = Get-Content "$env:LOCALAPPDATA\GitKrakenCLI\gk_cli.log" -Tail 5
   '{"hook_event_name":"PreToolUse","cwd":"D:\\Repos\\gd-obsidian-agentic-vault"}' | & "$env:LOCALAPPDATA\GitKrakenCLI\gk.exe" ai hook run --host claude-code
   Get-Content "$env:LOCALAPPDATA\GitKrakenCLI\gk_cli.log" -Tail 5
   ```
   Note: When testing from PowerShell 5.1 interactively, remember that PowerShell's `|` operator adds a BOM unless `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)` is set; Claude Code's native plugin runner passes stdin via `/usr/bin/bash` without a BOM.

3. **Monitor `gk_cli.log` during the next Claude Code session:**
   ```powershell
   Get-Content "$env:LOCALAPPDATA\GitKrakenCLI\gk_cli.log" -Wait -Tail 20
   ```
   Verify that `invalid character 'ï' looking for beginning of value` no longer appears on tool invocations.

## Open Questions

1. **Will `gk-alpha.exe` re-inject itself into `hooks.json` on the next alpha auto-update?**
   - If `gk-alpha.exe` is invoked by another tool or background updater, it may run `ai hook install` and re-add the `"matcher": ".*"` blocks to `C:\Users\grego\.claude\plugins\marketplaces\gitkraken\plugins\gitkraken-hooks\hooks\hooks.json`. Removing `gk-alpha.exe` if unused prevents channel drift.
2. **Should `PermissionRequest` keep `--blocking` (`timeout: 86400`)?**
   - `gk_cli.log` repeatedly logs `{"event":"PermissionRequest","level":"warning","msg":"aihook: no GitKraken client took the blocking event, returning control to the host"}`. If GitKraken Desktop / CLI is not actively handling permission prompts, removing `--blocking` from `PermissionRequest` in `hooks.json` will avoid holding an extra `gk.exe` process open during permission checks.
3. **Should stale session lockfiles in `C:\Users\grego\AppData\Local\GitKrakenCLI\sessions\` be pruned?**
   - There are currently `865` files (`524` `.lock`/session files in root and `341` in `ended/`), which may slow down session directory scans during hook execution.

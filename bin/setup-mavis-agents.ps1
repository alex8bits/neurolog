# bin/setup-mavis-agents.ps1
#
# Cold-start helper for the seizure project's Mavis (MiniMax Code) side:
# installs the project's custom Mavis agents and skills into the local
# runtime at $env:USERPROFILE\.minimax.
#
#
# On a fresh machine, after `git clone` + `composer install`:
#
#     pwsh -File bin/setup-mavis-agents.ps1
#
# What it does:
#   1. Copies every .mavis/skills/<name>/SKILL.md into
#      $env:USERPROFILE\.minimax\agents\mavis\skills\<name>\SKILL.md
#      (Mavis picks skills up dynamically from this directory).
#   2. For every .mavis/agents/<name>.md, parses the YAML frontmatter
#      and prints the exact `mavis agent create` / `mavis agent update`
#      invocations the local Mavis runtime should run to register the
#      agent. (Mavis currently exposes this only through its internal
#      `mavis` tool, not a public CLI; the script is therefore a
#      *recorder* for the create/update calls - the Mavis session on
#      the new machine must run them once.)
#
# Idempotent: re-running it overwrites skills and re-prints agent
# commands; agent update is a no-op if the system_prompt is unchanged.
#
# Exit code: 0 on success, non-zero on any failure.

$ErrorActionPreference = 'Stop'

# ---- resolve paths ---------------------------------------------------------

$ScriptDir       = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot     = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$MavisAgentsDir  = Join-Path $ProjectRoot '.mavis\agents'
$MavisSkillsDir  = Join-Path $ProjectRoot '.mavis\skills'
$RuntimeMavisDir = Join-Path $env:USERPROFILE '.minimax\agents\mavis\skills'

if (-not (Test-Path -Path $MavisAgentsDir -PathType Container)) {
    throw "Missing $MavisAgentsDir - agent source-of-truth not found in project."
}
if (-not (Test-Path -Path $MavisSkillsDir -PathType Container)) {
    throw "Missing $MavisSkillsDir - skill source-of-truth not found in project."
}

Write-Host ""
Write-Host "==> Seizure project: Mavis (MiniMax Code) cold-start setup" -ForegroundColor Cyan
Write-Host "    Project root:        $ProjectRoot"
Write-Host "    Runtime skills dir:  $RuntimeMavisDir"
Write-Host ""

# ---- 1. skills: copy SKILL.md into the runtime ----------------------------

if (-not (Test-Path -Path $RuntimeMavisDir -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $RuntimeMavisDir | Out-Null
}

$SkillDirs = Get-ChildItem -Path $MavisSkillsDir -Directory
if ($SkillDirs.Count -eq 0) {
    Write-Warning "No skills found in $MavisSkillsDir"
}

$InstalledSkills = @()
foreach ($d in $SkillDirs) {
    $srcSkill = Join-Path $d.FullName 'SKILL.md'
    if (-not (Test-Path -Path $srcSkill -PathType Leaf)) {
        Write-Warning "  [skip] $d - no SKILL.md inside"
        continue
    }
    $dstDir  = Join-Path $RuntimeMavisDir $d.Name
    $dstFile = Join-Path $dstDir 'SKILL.md'
    if (-not (Test-Path -Path $dstDir -PathType Container)) {
        New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
    }
    Copy-Item -Path $srcSkill -Destination $dstFile -Force
    Write-Host "  [skill] $($d.Name)" -ForegroundColor Green
    $InstalledSkills += $d.Name
}

Write-Host ""
Write-Host "==> Skills installed: $($InstalledSkills.Count)" -ForegroundColor Cyan
Write-Host ""

# ---- 2. agents: parse frontmatter, print mavis agent create/update --------

$AgentFiles = Get-ChildItem -Path $MavisAgentsDir -Filter '*.md' -File
if ($AgentFiles.Count -eq 0) {
    Write-Warning "No agent files found in $MavisAgentsDir"
}

# Very small frontmatter parser: only the flat scalar fields we use.
function Get-FrontmatterField {
    param(
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][string]$Field
    )
    $pattern = '(?m)^' + [regex]::Escape($Field) + ':\s*(.+?)\s*$'
    $m = [regex]::Match($Text, $pattern)
    if ($m.Success) {
        $raw = $m.Groups[1].Value
        # strip surrounding quotes if present
        if ($raw.StartsWith('"') -and $raw.EndsWith('"')) { $raw = $raw.Substring(1, $raw.Length - 2) }
        if ($raw.StartsWith("'") -and $raw.EndsWith("'")) { $raw = $raw.Substring(1, $raw.Length - 2) }
        return $raw
    }
    return $null
}

function Get-Body {
    param([Parameter(Mandatory)][string]$Text)
    # split off the leading --- ... --- block
    $parts = $Text -split "(?m)^---\s*$", 3
    if ($parts.Count -ge 3) { return $parts[2].TrimStart("`r`n") }
    return $Text
}

Write-Host "==> Agent registrations to run in the Mavis session:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    The Mavis runtime (MiniMax Code) exposes agent registration" -ForegroundColor Gray
Write-Host "    only through its internal `mavis` tool, not a public CLI." -ForegroundColor Gray
Write-Host "    On a fresh machine, open this project in MiniMax Code, start a" -ForegroundColor Gray
Write-Host "    session, and ask the assistant to run the commands below." -ForegroundColor Gray
Write-Host "    Each `update` is safe to re-run (idempotent); `create` runs only" -ForegroundColor Gray
Write-Host "    the first time and is skipped on subsequent runs." -ForegroundColor Gray
Write-Host ""

$AgentIndex = 0
foreach ($f in $AgentFiles) {
    $AgentIndex++
    $text = Get-Content -Path $f.FullName -Raw -Encoding UTF8
    $name          = Get-FrontmatterField -Text $text -Field 'name'
    $displayName   = Get-FrontmatterField -Text $text -Field 'display_name'
    $description   = Get-FrontmatterField -Text $text -Field 'description'
    $defaultWsDir  = Get-FrontmatterField -Text $text -Field 'default_workspace_dir'
    $body          = Get-Body -Text $text

    if (-not $name) {
        Write-Warning "  [skip] $($f.Name) - no `name:` in frontmatter"
        continue
    }

    Write-Host "  [agent #$AgentIndex] $name" -ForegroundColor Yellow
    Write-Host "    source: $($f.FullName.Substring($ProjectRoot.Length + 1))"
    if ($displayName)   { Write-Host "    display_name:           $displayName" }
    if ($description)   { Write-Host "    description:            $description" }
    if ($defaultWsDir)  { Write-Host "    default_workspace_dir:  $defaultWsDir" }
    Write-Host "    system_prompt length:   $($body.Length) chars"
    Write-Host ""
    Write-Host "    Ask the Mavis assistant to run (one call per agent):" -ForegroundColor Gray
    Write-Host ""
    Write-Host "      mavis({ command: `"agent get`", args: { agent_name: `"$name`" } })" -ForegroundColor DarkGray
    Write-Host "      # if the call above returns ok:true:" -ForegroundColor DarkGray
    Write-Host "      mavis({ command: `"agent update`", args: {" -ForegroundColor DarkGray
    Write-Host "        agent_name:    `"$name`"," -ForegroundColor DarkGray
    Write-Host "        system_prompt: <paste body of $($f.Name)>," -ForegroundColor DarkGray
    Write-Host "        persona:       `"You are $displayName for the seizure project.`"," -ForegroundColor DarkGray
    Write-Host "        description:   `"$description`"" -ForegroundColor DarkGray
    Write-Host "      } })" -ForegroundColor DarkGray
    Write-Host "      # else (agent missing):" -ForegroundColor DarkGray
    Write-Host "      mavis({ command: `"agent create`", args: {" -ForegroundColor DarkGray
    Write-Host "        name:                   `"$name`"," -ForegroundColor DarkGray
    Write-Host "        display_name:           `"$displayName`"," -ForegroundColor DarkGray
    Write-Host "        description:            `"$description`"," -ForegroundColor DarkGray
    Write-Host "        default_workspace_dir:  `"$defaultWsDir`"," -ForegroundColor DarkGray
    Write-Host "        system_prompt: <paste body of $($f.Name)>," -ForegroundColor DarkGray
    Write-Host "        persona:       `"You are $displayName for the seizure project.`"" -ForegroundColor DarkGray
    Write-Host "      } })" -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host "==> Done." -ForegroundColor Cyan
Write-Host "    Skills ($($InstalledSkills.Count)) copied to runtime; agents need a Mavis session to register." -ForegroundColor Cyan
Write-Host ""

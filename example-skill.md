---
name: log-harvest-time
description: Log daily time to Harvest by reviewing ADO work items for effort-hours changes. Use when the user asks to log time, log hours, submit timesheet, track time to Harvest, or review today's work for time entry.
---

# Log Harvest Time from ADO Effort

Review Azure DevOps work items for Effort (Completed Work) changes made today, then log corresponding time entries to Harvest under the correct project and role.

## Prerequisites

- ADO MCP tools (`user-ado-*`)
- Harvest MCP tools (`user-harvest-*`)

## Workflow

### Step 1: Identify work items changed today

Search ADO for work items assigned to the user that were changed today:

```
Tool: user-ado-search_workitem
Parameters:
  searchText: "<user display name>"
  top: 25
```

Filter results to items where `system.changeddate` falls on today's date.

### Step 2: Check Effort (Completed Work) revisions

For each work item changed today, pull its revision history:

```
Tool: user-ado-wit_list_work_item_revisions
Parameters:
  project: "<your-ado-project-name>"
  workItemId: <ID>
  top: 10
```

Compare consecutive revisions to find where `Microsoft.VSTS.Scheduling.CompletedWork` changed on today's date. Calculate the delta (hours added today) for each item.

**Key logic:**
1. Walk revisions from oldest to newest
2. Find the last revision BEFORE today -- note its `CompletedWork` value (or 0 if not set)
3. Find the last revision ON today -- note its `CompletedWork` value
4. Delta = today's value - previous value
5. Only include items where delta > 0

### Step 3: Look up Harvest project and tasks

Fetch the Harvest project list and task list:

```
Tool: user-harvest-list_projects
Tool: user-harvest-list_project_tasks
Parameters:
  project_id: <matching project ID>
```

### Default Harvest mappings

Configure these to match your own Harvest projects and tasks:

| Shorthand | Harvest Project | Project ID |
|-----------|----------------|------------|
| PROJ-01 | PROJ-001 Your Project Name | 12345678 |

| Role | Harvest Task | Task ID |
|------|-------------|---------|
| Developer | Developer | 1111111 |
| Senior Developer | Senior Developer | 2222222 |
| Lead / Architect | Lead Architect | 3333333 |
| Project Manager | Project Manager | 4444444 |

If the user specifies a role (e.g., "as a senior developer"), map it to the corresponding task ID. Default to **Developer** if no role is specified.

### Step 4: Log a single time entry (no confirmation prompt)

**Do NOT prompt the user for confirmation.** Immediately log the time entry after calculating the deltas. Present the summary table as part of the confirmation output after logging (see Step 5).

If the user specified a total (e.g., "write in 8 hours") and the ADO effort total is less, note the gap and ask how to handle the remaining hours -- this is the only case where you should prompt before logging.

Create **one** Harvest entry with the hours (applying the full-day rule above) and all work items listed in the notes, one per line:

```
Tool: user-harvest-log_time
Parameters:
  project_id: <project ID>
  task_id: <task ID>
  hours: <8 if sum of deltas >= 5, otherwise sum of deltas>
  spent_date: "YYYY-MM-DD"
  notes: |
    ADO #<ID1> - <Title1> (<delta1>h)
    ADO #<ID2> - <Title2> (<delta2>h)
    ADO #<ID3> - <Title3> (<delta3>h)
```

**Notes format rules:**
- Each work item goes on its own line
- Format: `ADO #<ID> - <Title> (<hours>h)`
- Lines are newline-separated (use `\n` in the notes string)

### Step 5: Confirm results

After logging, present a confirmation with the summary table and entry details:

```markdown
| ADO ID | Title | Hours (delta today) |
|--------|-------|---------------------|
| #XXXXX | Task title | X.X |
| ...    | ...        | ... |
| **Total** | | **X.X** |

**Harvest Entry ID**: XXXXXXXXXX
**Project**: [Project Name] - [Task Name]
**Date**: YYYY-MM-DD
**Total Hours**: X.X

**Notes**:
ADO #XXXXX - Title 1 (Xh)
ADO #XXXXX - Title 2 (Xh)
ADO #XXXXX - Title 3 (Xh)
```

## Handling today's time check

Before logging, check if time is already logged today:

```
Tool: user-harvest-get_todays_time
```

If entries already exist, warn the user and ask whether to add to existing entries or replace them. This is the only other case where you should prompt before logging.

## Notes

- Replace `<your-ado-project-name>` with your ADO project name (e.g., `MyProject`)
- Replace `<your-ado-project-id>` with your ADO project GUID
- Replace `<user display name>` with your ADO display name (used to search for assigned work items)
- Update the Harvest mappings table with your real project IDs and task IDs
- `CompletedWork` is the ADO field for Effort (Hours) Completed
- Always use `spent_date` in `YYYY-MM-DD` format for Harvest

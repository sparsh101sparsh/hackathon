# Phase 5: Notion Integration - Real Client API Controller

## 1. SDK Client Initialization & Config Check
The Notion API integration is managed in `server/src/notion/index.ts` using the official `@notionhq/client` SDK.

### Initialization Sequence
1. **Config Load**: The controller reads configuration variables from `.env` using `dotenv`. If running under Vitest tests (`process.env.VITEST` is true), environment loading is bypassed.
2. **Mock Logic Evaluation**: Determines the execution mode:
   ```typescript
   const isMock = process.env.MOCK_NOTION !== 'false';
   const token = process.env.NOTION_API_KEY || process.env.NOTION_INTEGRATION_TOKEN || '';
   ```
3. **Client Instantiation**: If mock mode is disabled and a token is present, the client is instantiated:
   ```typescript
   const notionClient = !isMock && token ? new Client({ auth: token }) : null;
   ```
4. **Mock File Scaffolding**: If `isMock` is true, the script creates mock JSON database files (`decisions.json`, `auditLogs.json`, `onboardingRecords.json`) in the `server/.mock-notion-db/` folder to ensure local file storage is ready.

---

## 2. Database Queries & Pagination Mapping
Reading from Notion databases uses the `queryDatabase` function, which handles pagination and properties extraction:

```typescript
async function queryDatabase<T>(
  databaseId: string,
  mapPage: (page: NotionPage) => T
): Promise<T[]> {
  if (!notionClient || !databaseId) {
    return [];
  }

  const results: T[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionClient.databases.query({
      database_id: databaseId,
      start_cursor: cursor
    });

    results.push(...(response.results as NotionPage[]).map(mapPage));
    cursor = response.has_more ? response.next_cursor || undefined : undefined;
  } while (cursor);

  return results;
}
```

### Property Extraction Mappers
To clean up Notion's nested property structures, helper methods extract values from the cell properties:
* **Title fields**:
  ```typescript
  function titleText(property: any): string {
    return property?.title?.map((item: any) => item?.plain_text || '').join('').trim() || '';
  }
  ```
* **Rich Text fields**:
  ```typescript
  function richText(property: any): string {
    return property?.rich_text?.map((item: any) => item?.plain_text || '').join('').trim() || '';
  }
  ```
* **Select Options**:
  ```typescript
  function selectName(property: any): string {
    return property?.select?.name || '';
  }
  ```
* **Number fields**:
  ```typescript
  function numberValue(property: any): number {
    return typeof property?.number === 'number' ? property.number : 0;
  }
  ```

---

## 3. Database Page Insertion Schemas
Adding records to Notion is handled by specific client helper methods.

### 1. Creating a Decision
```typescript
const response = await notionClient.pages.create({
  parent: { database_id: dbId },
  properties: {
    "Decision Name": {
      title: [{ text: { content: data.decisionName } }]
    },
    "Goal ID": {
      rich_text: [{ text: { content: data.goalId } }]
    },
    "Agent": {
      select: { name: data.agent }
    },
    "Decision Status": {
      select: { name: data.decisionStatus }
    },
    "Timestamp": {
      date: { start: data.timestamp }
    },
    "Reasoning": {
      rich_text: [{ text: { content: data.reasoning } }]
    }
  }
});
```

### 2. Creating an Audit Log
```typescript
const response = await notionClient.pages.create({
  parent: { database_id: dbId },
  properties: {
    "Log ID": {
      title: [{ text: { content: logId } }]
    },
    "Step Name": {
      rich_text: [{ text: { content: data.stepName } }]
    },
    "Agent": {
      select: { name: data.agent }
    },
    "Action Executed": {
      rich_text: [{ text: { content: data.actionExecuted } }]
    },
    "Thought Process": {
      rich_text: [{ text: { content: data.thoughtProcess } }]
    },
    "Cost": {
      number: data.cost
    },
    "Timestamp": {
      date: { start: data.timestamp }
    }
  }
});
```

---

## 4. Block Creation and Page Body Layout
When creating Onboarding Records, the script uses the `children` array in `pages.create` to insert content blocks directly into the page's body in Notion:

```typescript
const response = await notionClient.pages.create({
  parent: { database_id: dbId },
  properties: {
    "Employee Name": { title: [{ text: { content: data.employeeName } }] },
    "Role": { rich_text: [{ text: { content: data.role } }] },
    "Department": { select: { name: data.department } },
    "Salary": { number: data.salary },
    "Equipment List": { rich_text: [{ text: { content: data.equipmentList } }] },
    "GitHub Username": { rich_text: [{ text: { content: data.githubUsername } }] },
    "Onboarding Status": { select: { name: data.onboardingStatus } }
  },
  children: [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ text: { content: 'Final Specs & Comments' } }]
      }
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            text: {
              content: `Role: ${data.role}\nDepartment: ${data.department}\nSalary: $${data.salary}\nEquipment: ${data.equipmentList}\nGitHub: ${data.githubUsername}`
            }
          }
        ]
      }
    }
  ]
});
```
This structures the page layout in Notion: a dynamic table row contains the metadata, and the page body houses detailed onboarding specifications as structured blocks (`heading_2` followed by a multi-line `paragraph`).

---

## 5. API Error Handling and Fallbacks
The controller handles potential API failures gracefully:

* **Graceful Mock Fallback**: In `getNotionData`, if a network timeout, rate limit (429), or invalid credential error occurs, it catches the error and falls back to loading local mock data:
  ```typescript
  try {
    // ... query databases
  } catch (error) {
    console.error('[Notion API Error] Failed to read Notion data; falling back to mock data:', error);
    return getMockData();
  }
  ```
* **Mock Lock Mechanics (`writeMockRecord`)**: To avoid file corruption when simulating concurrent database updates, the mock writer uses a spin-lock mechanism:
  1. Attempts to create a lock file (`.lock`) using the `'wx'` write flag.
  2. If the lock exists, it backs off and retries.
  3. Updates the JSON object in memory, writes it to a temporary file (`.tmp`), and performs an atomic rename to replace the active JSON file.
  4. Removes the lock file inside a `finally` block.

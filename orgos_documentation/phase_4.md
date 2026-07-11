# Phase 4: Notion Schema Setup and Scaffolding Script

## 1. Execution Triggers: Real vs. Mock Modes
The scaffolding script `scripts/setup-notion.js` supports dual modes of execution based on variables loaded from the `.env` file. 

```javascript
const isMock = process.env.MOCK_NOTION !== "false";
const token = process.env.NOTION_API_KEY || process.env.NOTION_INTEGRATION_TOKEN;
const rootPageId = process.env.NOTION_PARENT_PAGE_ID || process.env.NOTION_ROOT_PAGE_ID;
```

* **Triggering Mock Mode**: If `MOCK_NOTION=true`, or if API keys/parent page IDs are missing, the script defaults to Mock Mode. It scaffolds the databases as local JSON files on the disk without querying the Notion API.
* **Triggering Real Mode**: If `MOCK_NOTION=false` and credentials are valid, the script uses the `@notionhq/client` SDK to establish a connection and dynamically create the three database nodes nested under the specified parent page.

---

## 2. Mock Directory Initialization
During local mock mode execution, the script verifies the presence of the simulated database directory and populates it:
1. **Target Folder**: `server/.mock-notion-db/` (located inside the server package root).
2. **Scaffolding Logic**: Checks if the folder exists via `fs.existsSync()`. If absent, it creates it recursively:
   ```javascript
   const mockDbDir = path.join(__dirname, "../server/.mock-notion-db");
   if (!fs.existsSync(mockDbDir)) {
     fs.mkdirSync(mockDbDir, { recursive: true });
   }
   ```
3. **JSON Database Scaffolds**: If files (`decisions.json`, `auditLogs.json`, `onboardingRecords.json`) do not exist, they are generated with a default structure mapping the schema template and containing an empty `records` array:
   ```json
   {
     "name": "Decisions",
     "schema": { ... },
     "records": []
   }
   ```

---

## 3. Database Layout Templates & Property Assignments
When scaffolding in Real Mode, the script configures specific property types via the Notion SDK. The tables are configured using the properties below:

### decisions
```javascript
const decisionsDb = await notion.databases.create({
  parent: { page_id: formattedPageId },
  title: [{ type: "text", text: { content: "Decisions" } }],
  properties: {
    "Decision Name": { title: {} }, // Main Title field
    "Goal ID": { rich_text: {} },
    "Agent": {
      select: {
        options: [
          { name: "PM" },
          { name: "Finance" },
          { name: "Engineering" }
        ]
      }
    },
    "Decision Status": {
      select: {
        options: [
          { name: "Approved" },
          { name: "Rejected" },
          { name: "Pending" }
        ]
      }
    },
    "Timestamp": { date: {} },
    "Reasoning": { rich_text: {} }
  }
});
```

### auditLogs
```javascript
const auditLogsDb = await notion.databases.create({
  parent: { page_id: formattedPageId },
  title: [{ type: "text", text: { content: "Audit Logs" } }],
  properties: {
    "Log ID": { title: {} },
    "Step Name": { rich_text: {} },
    "Agent": {
      select: {
        options: [
          { name: "System" },
          { name: "PM" },
          { name: "Finance" },
          { name: "Engineering" }
        ]
      }
    },
    "Action Executed": { rich_text: {} },
    "Thought Process": { rich_text: {} },
    "Cost": { number: { format: "number" } },
    "Timestamp": { date: {} }
  }
});
```

### onboardingRecords
```javascript
const onboardingRecordsDb = await notion.databases.create({
  parent: { page_id: formattedPageId },
  title: [{ type: "text", text: { content: "Onboarding Records" } }],
  properties: {
    "Employee Name": { title: {} },
    "Role": { rich_text: {} },
    "Department": {
      select: {
        options: [
          { name: "Product" },
          { name: "Finance" },
          { name: "Engineering" },
          { name: "Sales" }
        ]
      }
    },
    "Salary": { number: { format: "number" } },
    "Equipment List": { rich_text: {} },
    "GitHub Username": { rich_text: {} },
    "Onboarding Status": {
      select: {
        options: [
          { name: "In Progress" },
          { name: "Complete" },
          { name: "Failed" }
        ]
      }
    }
  }
});
```

---

## 4. Parent Page Mapping
Notion integrations require specifying a parent page under which new databases are created. The script handles this mapping with the following format:
* **UUID Formatting**: Notion URLs and copy-pasted page IDs often contain hyphens (`-`). The Notion API requires a raw 32-character hexadecimal string. The script sanitizes the root ID before sending the request:
  ```javascript
  const formattedPageId = rootPageId.replace(/-/g, "");
  ```
* **Payload Link**: The parent page mapping is passed as the `parent` property in the database creation configuration:
  ```json
  "parent": { "page_id": "formattedPageId" }
  ```
This nests the three databases within the parent workspace, ready to capture onboarding outcomes.

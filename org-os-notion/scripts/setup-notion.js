/**
 * OrgOS Notion Database Scaffolding Script
 * 
 * This script automates the creation of the required Notion databases:
 * 1. Decisions
 * 2. Audit Logs
 * 3. Onboarding Records
 * 
 * It can run in either REAL mode (interacting with Notion API using NOTION_INTEGRATION_TOKEN 
 * and NOTION_ROOT_PAGE_ID) or MOCK mode (scaffolding a local JSON-based simulated database 
 * layout inside server/.mock-notion-db/).
 */

const { Client } = require("@notionhq/client");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

function printSchemaDocumentation() {
  console.log(`
========================================================================
                       NOTION DATABASE SCHEMAS
========================================================================

1. Decisions Database
   - Title: Decision Name (Title)
   - Properties:
     - Goal ID (Rich Text)
     - Agent (Select: PM, Finance, Engineering)
     - Decision Status (Select: Approved, Rejected, Pending)
     - Timestamp (Date)
     - Reasoning (Rich Text)

2. Audit Logs Database
   - Title: Log ID (Title)
   - Properties:
     - Step Name (Rich Text)
     - Agent (Select: System, PM, Finance, Engineering)
     - Action Executed (Rich Text)
     - Thought Process (Rich Text)
     - Cost (Number)
     - Timestamp (Date)

3. Onboarding Records Database
   - Title: Employee Name (Title)
   - Properties:
     - Role (Rich Text)
     - Department (Select: Product, Finance, Engineering, Sales)
     - Salary (Number)
     - Equipment List (Rich Text)
     - GitHub Username (Rich Text)
     - Onboarding Status (Select: In Progress, Complete, Failed)
========================================================================
`);
}

function printInstructions() {
  console.log(`
========================================================================
                      HOW TO USE THIS SCRIPT
========================================================================
To run in REAL mode (creating actual Notion databases):
1. Create a Notion integration: https://developers.notion.com/
2. Share a parent root page in Notion with your integration.
3. In your root '.env' file, configure:
   - MOCK_NOTION=false
   - NOTION_INTEGRATION_TOKEN=secret_xxx...
   - NOTION_ROOT_PAGE_ID=xxx... (the ID of your parent root page)
4. Run:
   npm run setup:notion

To run in MOCK mode (creating local JSON-based schemas):
1. In your root '.env' file, configure:
   - MOCK_NOTION=true
2. Run:
   npm run setup:notion
========================================================================
`);
}

async function run() {
  printSchemaDocumentation();
  printInstructions();

  const isMock = process.env.MOCK_NOTION !== "false";
  const token = process.env.NOTION_API_KEY || process.env.NOTION_INTEGRATION_TOKEN;
  const rootPageId = process.env.NOTION_PARENT_PAGE_ID || process.env.NOTION_ROOT_PAGE_ID;

  if (isMock || !token || !rootPageId) {
    console.log("⚠️ Running in MOCK Mode (either MOCK_NOTION=true or missing API credentials).");
    console.log("Scaffolding local mock database directories & files...");

    const mockDbDir = path.join(__dirname, "../server/.mock-notion-db");
    if (!fs.existsSync(mockDbDir)) {
      fs.mkdirSync(mockDbDir, { recursive: true });
    }

    const mockDatabases = {
      decisions: {
        name: "Decisions",
        schema: {
          "Decision Name": { type: "title" },
          "Goal ID": { type: "rich_text" },
          "Agent": { type: "select", options: ["PM", "Finance", "Engineering"] },
          "Decision Status": { type: "select", options: ["Approved", "Rejected", "Pending"] },
          "Timestamp": { type: "date" },
          "Reasoning": { type: "rich_text" }
        },
        records: []
      },
      auditLogs: {
        name: "Audit Logs",
        schema: {
          "Log ID": { type: "title" },
          "Step Name": { type: "rich_text" },
          "Agent": { type: "select", options: ["System", "PM", "Finance", "Engineering"] },
          "Action Executed": { type: "rich_text" },
          "Thought Process": { type: "rich_text" },
          "Cost": { type: "number" },
          "Timestamp": { type: "date" }
        },
        records: []
      },
      onboardingRecords: {
        name: "Onboarding Records",
        schema: {
          "Employee Name": { type: "title" },
          "Role": { type: "rich_text" },
          "Department": { type: "select", options: ["Product", "Finance", "Engineering", "Sales"] },
          "Salary": { type: "number" },
          "Equipment List": { type: "rich_text" },
          "GitHub Username": { type: "rich_text" },
          "Onboarding Status": { type: "select", options: ["In Progress", "Complete", "Failed"] }
        },
        records: []
      }
    };

    // Write empty files for each table if they don't exist
    for (const [key, data] of Object.entries(mockDatabases)) {
      const filePath = path.join(mockDbDir, `${key}.json`);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
        console.log(`✅ Created mock database file: ${filePath}`);
      } else {
        console.log(`ℹ️ Mock database file already exists: ${filePath}`);
      }
    }

    console.log("\n🎉 Local mock database scaffolding complete.");
    return;
  }

  // Real Notion Mode
  console.log("🚀 Connecting to real Notion API...");
  // Clean root page ID if it contains dashes
  const formattedPageId = rootPageId.replace(/-/g, "");

  const notion = new Client({ auth: token });

  try {
    // 1. Create Decisions Database
    console.log("Creating Decisions Database...");
    const decisionsDb = await notion.databases.create({
      parent: { page_id: formattedPageId },
      title: [{ type: "text", text: { content: "Decisions" } }],
      properties: {
        "Decision Name": { title: {} },
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
    console.log(`✅ Decisions Database created successfully! ID: ${decisionsDb.id}`);

    // 2. Create Audit Logs Database
    console.log("Creating Audit Logs Database...");
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
    console.log(`✅ Audit Logs Database created successfully! ID: ${auditLogsDb.id}`);

    // 3. Create Onboarding Records Database
    console.log("Creating Onboarding Records Database...");
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
    console.log(`✅ Onboarding Records Database created successfully! ID: ${onboardingRecordsDb.id}`);

    console.log("\n🎉 All Notion databases created successfully on your parent page.");
    console.log("Please save these database IDs in your notes or config if needed!");
  } catch (error) {
    console.error("❌ Error creating Notion databases:", error);
    process.exit(1);
  }
}

run();

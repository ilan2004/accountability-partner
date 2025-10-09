# Notion Setup Guide

This guide will help you set up the Notion integration for the Accountability Partner system.

## Prerequisites

1. A Notion account
2. A shared Notion database with your accountability partner

## Step 1: Create the Tasks Database

1. In Notion, create a new database (or use an existing one)
2. Make sure it has the following properties:
   - **Title** (type: Title) - The task name
   - **Status** (type: Status) - With options: "Todo", "In Progress", "Done"
   - **Due** (type: Date) - Due date for the task
   - **Owner** (type: Person) - Who owns the task

## Step 2: Create a Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Give it a name like "Accountability Partner Bot"
4. Select your workspace
5. Copy the **Integration Token** (starts with `secret_`)

## Step 3: Share the Database with the Integration

1. Open your Tasks database in Notion
2. Click the "..." menu in the top right
3. Under "Connections", click "Add connection"
4. Search for your integration name and add it

## Step 4: Get the Database ID

1. In your Tasks database, click "..." → "Copy link"
2. The link will look like: `https://www.notion.so/[workspace]/[database-id]?v=[view-id]`
3. Extract the database ID (32 characters, mix of letters and numbers)
   - Example: If your link is `https://www.notion.so/myworkspace/a8f7b9c123456789abcdef0123456789?v=...`
   - Your database ID is: `a8f7b9c123456789abcdef0123456789`

## Step 5: Update Your .env File

Edit the `.env` file in the project root and update:

```env
NOTION_TOKEN=secret_YOUR_INTEGRATION_TOKEN_HERE
NOTION_DATABASE_ID=YOUR_DATABASE_ID_HERE
```

## Step 6: Test the Integration

Run the test script:

```bash
cd apps/worker
pnpm notion:test
```

If successful, you should see your tasks listed!

## Troubleshooting

### "unauthorized" error
- Make sure you've shared the database with the integration
- Verify the integration token is correct

### "No tasks found"
- Check that the database has the correct property names (case-sensitive)
- Make sure there are tasks in the database
- Verify the database ID is correct

### Property type errors
- Ensure Status property has the exact values: "Todo", "In Progress", "Done"
- Make sure Owner is a Person property, not Text

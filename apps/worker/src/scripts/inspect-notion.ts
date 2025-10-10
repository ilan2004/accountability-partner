#!/usr/bin/env tsx

/**
 * Notion Database Inspector
 * This script will show you the current structure of your Notion database
 * so we can adapt the project to work with your existing format.
 */

import { config } from 'dotenv';
import { Client } from '@notionhq/client';
import pino from 'pino';
import { join } from 'path';

// Load environment variables from project root
config({ path: join(process.cwd(), '.env') });

// If that didn't work, try finding it relative to this file
if (!process.env.NOTION_TOKEN) {
  config({ path: join(__dirname, '../../../../.env') });
}

// If still not found, try the worker dir
if (!process.env.NOTION_TOKEN) {
  config({ path: join(__dirname, '../../.env') });
}

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function inspectDatabase() {
  const notion = new Client({
    auth: process.env.NOTION_TOKEN,
  });

  const databaseId = process.env.NOTION_DATABASE_ID;
  
  if (!process.env.NOTION_TOKEN) {
    logger.error('NOTION_TOKEN not found in environment');
    process.exit(1);
  }

  if (!databaseId) {
    logger.error('NOTION_DATABASE_ID not found in environment');
    process.exit(1);
  }

  try {
    logger.info('🔍 Inspecting Notion database...');
    logger.info(`Database ID: ${databaseId}`);

    // Get database schema
    const database = await notion.databases.retrieve({
      database_id: databaseId,
    });

    logger.info('\n📊 Database Properties:');
    logger.info(`Title: ${(database as any).title[0]?.text?.content || 'Untitled'}`);

    const properties = (database as any).properties;
    console.log('\n🏗️  Property Structure:');
    
    Object.entries(properties).forEach(([name, prop]: [string, any]) => {
      console.log(`\n  ${name}:`);
      console.log(`    Type: ${prop.type}`);
      
      // Show additional details based on property type
      switch (prop.type) {
        case 'select':
          console.log(`    Options: ${prop.select.options.map((opt: any) => opt.name).join(', ')}`);
          break;
        case 'status':
          console.log(`    Options: ${prop.status.options.map((opt: any) => opt.name).join(', ')}`);
          break;
        case 'multi_select':
          console.log(`    Options: ${prop.multi_select.options.map((opt: any) => opt.name).join(', ')}`);
          break;
        case 'formula':
          console.log(`    Expression: ${prop.formula.expression}`);
          break;
        case 'relation':
          console.log(`    Database: ${prop.relation.database_id}`);
          break;
      }
    });

    // Try to fetch a few sample pages to see the actual data structure
    logger.info('\n📄 Fetching sample pages...');
    
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 3,
    });

    if (response.results.length === 0) {
      logger.warn('No pages found in the database');
      logger.info('\nTo test properly, add a few sample entries to your Notion database.');
    } else {
      logger.info(`\nFound ${response.results.length} sample pages:`);
      
      response.results.forEach((page: any, index) => {
        if ('properties' in page) {
          console.log(`\n  Page ${index + 1}:`);
          Object.entries(page.properties).forEach(([name, prop]: [string, any]) => {
            let value = '';
            
            switch (prop.type) {
              case 'title':
                value = prop.title.map((t: any) => t.text.content).join('') || '(empty)';
                break;
              case 'rich_text':
                value = prop.rich_text.map((t: any) => t.text.content).join('') || '(empty)';
                break;
              case 'select':
                value = prop.select?.name || '(none)';
                break;
              case 'status':
                value = prop.status?.name || '(none)';
                break;
              case 'multi_select':
                value = prop.multi_select.map((s: any) => s.name).join(', ') || '(none)';
                break;
              case 'date':
                value = prop.date?.start || '(none)';
                break;
              case 'people':
                value = prop.people.map((p: any) => p.name || p.id).join(', ') || '(none)';
                break;
              case 'checkbox':
                value = prop.checkbox ? 'Yes' : 'No';
                break;
              case 'number':
                value = prop.number?.toString() || '(none)';
                break;
              case 'url':
                value = prop.url || '(none)';
                break;
              case 'email':
                value = prop.email || '(none)';
                break;
              case 'phone_number':
                value = prop.phone_number || '(none)';
                break;
              case 'formula':
                if (prop.formula.type === 'string') {
                  value = prop.formula.string || '(none)';
                } else if (prop.formula.type === 'number') {
                  value = prop.formula.number?.toString() || '(none)';
                } else if (prop.formula.type === 'boolean') {
                  value = prop.formula.boolean ? 'Yes' : 'No';
                } else if (prop.formula.type === 'date') {
                  value = prop.formula.date?.start || '(none)';
                } else {
                  value = `(${prop.formula.type})`;
                }
                break;
              case 'relation':
                value = `${prop.relation.length} relations`;
                break;
              case 'rollup':
                value = `(rollup: ${prop.rollup.type})`;
                break;
              default:
                value = `(${prop.type})`;
            }
            
            console.log(`    ${name}: ${value}`);
          });
        }
      });
    }

    logger.info('\n✅ Database inspection completed!');
    logger.info('\n💡 Next steps:');
    logger.info('1. Review the property structure above');
    logger.info('2. Let me know what properties you want to use for:');
    logger.info('   - Task title/name');
    logger.info('   - Task status');
    logger.info('   - Due date (if any)');
    logger.info('   - Owner/assignee (if any)');
    logger.info('3. I\'ll update the code to match your database structure');

  } catch (error) {
    logger.error('Failed to inspect database:', error);
  }
}

// Run inspection
inspectDatabase().catch(console.error);

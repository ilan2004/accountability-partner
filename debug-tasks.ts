import { config } from 'dotenv';
import { join } from 'path';
import { SupabaseWorkerHelpers } from './apps/worker/src/lib/supabase';

// Load environment variables from root
config({ path: join(__dirname, '.env') });

async function debugTasks() {
  try {
    console.log('🔍 Debugging task data...\n');
    
    // Get all pairs
    const { supabase } = await import('./apps/worker/src/lib/supabase');
    const { data: pairs, error: pairError } = await supabase
      .from('Pair')
      .select('*');
    
    if (pairError) throw pairError;
    
    console.log(`Found ${pairs?.length || 0} pairs`);
    
    for (const pair of (pairs as any) || []) {
      console.log(`\n📊 Pair ID: ${pair.id}`);
      
      // Get all tasks for this pair
      const allTasks = await SupabaseWorkerHelpers.getAllTasksForPair(pair.id);
      console.log(`  Total tasks: ${allTasks.length}`);
      
      // Check task statuses
      const statusCounts: Record<string, number> = {};
      for (const task of allTasks) {
        const status = (task as any).status;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        console.log(`    Task: ${(task as any).title} | Status: "${status}" | Owner: ${(task as any).owner?.name}`);
      }
      
      console.log('\n  Status breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`    "${status}": ${count}`);
      });
      
      // Test the filter
      const openTasks = allTasks.filter(t => (t as any).status !== 'Done');
      const doneTasksCheck1 = allTasks.filter(t => (t as any).status === 'Done');
      const doneTasksCheck2 = allTasks.filter(t => (t as any).status === 'done');
      const doneTasksCheck3 = allTasks.filter(t => (t as any).status?.toLowerCase() === 'done');
      
      console.log(`\n  Open tasks (status !== 'Done'): ${openTasks.length}`);
      console.log(`  Done tasks (status === 'Done'): ${doneTasksCheck1.length}`);
      console.log(`  Done tasks (status === 'done'): ${doneTasksCheck2.length}`);
      console.log(`  Done tasks (status.toLowerCase() === 'done'): ${doneTasksCheck3.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error debugging tasks:', error);
  }
}

debugTasks();

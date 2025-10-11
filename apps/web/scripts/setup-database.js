const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDatabase() {
  console.log('🔗 Connecting to Supabase...');
  
  try {
    // First, let's check if the User table exists by trying to query it
    console.log('📋 Checking existing tables...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (tablesError) {
      console.error('Error checking tables:', tablesError);
    } else {
      console.log('Existing tables:', tables?.map(t => t.table_name) || []);
    }

    // Try to query the User table to see if it exists and what structure it has
    console.log('🔍 Checking User table structure...');
    
    const { data: userCheck, error: userError } = await supabase
      .from('User')
      .select('*')
      .limit(1);

    if (userError) {
      console.log('❌ User table error:', userError.message);
      
      if (userError.code === '42P01') { // Table doesn't exist
        console.log('📝 User table does not exist. Creating it...');
        
        // Create the User table using SQL
        const { error: createError } = await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS "User" (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              email VARCHAR(255) UNIQUE NOT NULL,
              name VARCHAR(255),
              "notionId" VARCHAR(255),
              "phoneNumber" VARCHAR(50),
              image VARCHAR(500),
              "emailVerified" TIMESTAMP WITH TIME ZONE,
              "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Enable RLS (Row Level Security)
            ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
            
            -- Create policies
            CREATE POLICY "Users can view own profile" ON "User"
              FOR SELECT USING (auth.uid() = id);
              
            CREATE POLICY "Users can update own profile" ON "User"
              FOR UPDATE USING (auth.uid() = id);
              
            CREATE POLICY "Anyone can insert during signup" ON "User"
              FOR INSERT WITH CHECK (true);
          `
        });

        if (createError) {
          console.error('❌ Error creating User table:', createError);
        } else {
          console.log('✅ User table created successfully!');
        }
      }
    } else {
      console.log('✅ User table exists and is accessible');
      console.log('Sample user data structure:', userCheck?.[0] || 'No users yet');
    }

    // Test the connection with a simple query
    console.log('🧪 Testing database connection...');
    const { data: test, error: testError } = await supabase
      .from('User')
      .select('count(*)')
      .single();

    if (testError) {
      console.error('❌ Database test failed:', testError);
    } else {
      console.log('✅ Database connection successful');
      console.log('User count:', test);
    }

  } catch (error) {
    console.error('💥 Setup failed:', error);
  }
}

// Alternative: Create table using raw SQL if the RPC method doesn't work
async function createUserTableDirectly() {
  console.log('📝 Creating User table with direct SQL...');
  
  const { data, error } = await supabase
    .from('pg_tables')
    .select('tablename')
    .eq('schemaname', 'public')
    .eq('tablename', 'User');

  if (error) {
    console.log('Checking tables error:', error);
  }

  if (!data || data.length === 0) {
    console.log('User table not found, need to create it manually in Supabase dashboard');
    console.log('\n🔧 Manual Setup Instructions:');
    console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard');
    console.log('2. Navigate to Table Editor');
    console.log('3. Create a new table called "User" with these columns:');
    console.log('   - id: uuid (primary key, default: gen_random_uuid())');
    console.log('   - email: text (unique, not null)');
    console.log('   - name: text');
    console.log('   - notionId: text');
    console.log('   - phoneNumber: text');
    console.log('   - image: text');
    console.log('   - emailVerified: timestamptz');
    console.log('   - createdAt: timestamptz (default: now())');
    console.log('   - updatedAt: timestamptz (default: now())');
    console.log('\n4. Enable RLS and create appropriate policies');
  } else {
    console.log('✅ User table exists!');
  }
}

if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('🏁 Setup complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabase, createUserTableDirectly };

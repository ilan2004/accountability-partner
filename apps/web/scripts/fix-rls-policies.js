const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for admin operations
);

async function fixRLSPolicies() {
  console.log('🔧 Fixing RLS policies for User table...');
  
  try {
    // First, let's check current policies
    console.log('📋 Checking current policies...');
    
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
          FROM pg_policies 
          WHERE tablename = 'User' AND schemaname = 'public';
        `
      });

    if (policiesError) {
      console.log('Could not check policies (might not have the RPC function)');
    } else {
      console.log('Current policies:', policies);
    }

    // Drop existing policies and create new ones
    console.log('🗑️  Dropping existing policies...');
    
    const dropPoliciesSQL = `
      -- Drop existing policies
      DROP POLICY IF EXISTS "Users can view own profile" ON "User";
      DROP POLICY IF EXISTS "Users can update own profile" ON "User";  
      DROP POLICY IF EXISTS "Anyone can insert during signup" ON "User";
      DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "User";
      DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "User";
      DROP POLICY IF EXISTS "Enable update for own profile" ON "User";
    `;

    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: dropPoliciesSQL
    });

    if (dropError) {
      console.log('Drop policies error (may not exist):', dropError.message);
    }

    // Create new policies
    console.log('✨ Creating new RLS policies...');
    
    const createPoliciesSQL = `
      -- Allow users to read their own profile
      CREATE POLICY "Users can read own profile" ON "User"
        FOR SELECT USING (auth.uid() = id);
      
      -- Allow users to update their own profile
      CREATE POLICY "Users can update own profile" ON "User"
        FOR UPDATE USING (auth.uid() = id);
      
      -- Allow authenticated users to insert their own record
      CREATE POLICY "Users can insert own profile" ON "User"
        FOR INSERT WITH CHECK (auth.uid() = id);
      
      -- Allow service role to do everything (for server-side operations)
      CREATE POLICY "Service role can do everything" ON "User"
        FOR ALL USING (current_setting('role') = 'service_role');
    `;

    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: createPoliciesSQL
    });

    if (createError) {
      console.error('❌ Error creating policies:', createError);
    } else {
      console.log('✅ RLS policies created successfully!');
    }

    // Test the policies
    console.log('🧪 Testing policies with test user creation...');
    
    const testEmail = `policytest${Date.now().toString().slice(-6)}@gmail.com`;
    const testPassword = 'TestPassword123!';
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: 'Policy Test User',
        }
      }
    });

    if (authError) {
      console.error('❌ Auth test error:', authError);
      return;
    }

    if (authData.user) {
      console.log('✅ Auth user created, testing profile creation...');
      
      // Use the service role client to create the profile (this simulates what happens in AuthContext)
      const { error: profileError } = await supabase
        .from('User')
        .insert({
          id: authData.user.id,
          email: testEmail,
          name: 'Policy Test User',
          emailVerified: authData.user.email_confirmed_at ? new Date(authData.user.email_confirmed_at) : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

      if (profileError) {
        console.error('❌ Profile creation still failing:', profileError);
      } else {
        console.log('✅ Profile creation successful!');
        
        // Clean up
        const { error: deleteError } = await supabase
          .from('User')
          .delete()
          .eq('id', authData.user.id);
          
        if (!deleteError) {
          console.log('🧹 Test user cleaned up');
        }
      }
    }

  } catch (error) {
    console.error('💥 Policy fix failed:', error);
  }
}

// Alternative approach: Temporarily disable RLS for testing
async function temporarilyDisableRLS() {
  console.log('⚠️  Temporarily disabling RLS for User table (FOR DEVELOPMENT ONLY)...');
  
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;`
    });

    if (error) {
      console.error('❌ Error disabling RLS:', error);
    } else {
      console.log('✅ RLS disabled for User table');
      console.log('⚠️  REMEMBER TO RE-ENABLE RLS IN PRODUCTION!');
    }
  } catch (error) {
    console.error('💥 Failed to disable RLS:', error);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--disable-rls')) {
    temporarilyDisableRLS()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    fixRLSPolicies()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = { fixRLSPolicies, temporarilyDisableRLS };

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkAuthSettings() {
  console.log('🔍 Checking Supabase Auth Configuration...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // Test 1: Try to create a user and see what happens
    console.log('🧪 Testing user creation with current settings...');
    
    const testEmail = `configtest${Date.now().toString().slice(-6)}@test.com`;
    const testPassword = 'TestPassword123!';
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (error) {
      console.log('❌ Signup failed with error:', error.message);
      console.log('Error details:', {
        code: error.status,
        message: error.message
      });
      
      if (error.message.includes('Database error saving new user')) {
        console.log('\n💡 DIAGNOSIS: Email confirmation is likely ENABLED');
        console.log('📝 SOLUTION: Disable email confirmation in Supabase dashboard');
        console.log('   1. Go to: https://supabase.com/dashboard/project/tgdsoavhplrurbbexfvm/auth/settings');
        console.log('   2. Find "Email Confirmations" section');
        console.log('   3. Turn OFF "Enable email confirmations"');
        console.log('   4. Click Save');
      }
      
      return false;
    }

    console.log('✅ Signup successful!');
    console.log('User created:', {
      id: data.user?.id,
      email: data.user?.email,
      email_confirmed: data.user?.email_confirmed_at,
      has_session: !!data.session
    });

    if (data.session) {
      console.log('🎉 Email confirmation is DISABLED (good for development)');
    } else {
      console.log('📧 Email confirmation is ENABLED (user needs to confirm email)');
      console.log('💡 For immediate signup, consider disabling email confirmation');
    }

    // Clean up test user if possible
    if (data.user) {
      console.log('🧹 Cleaning up test user...');
      
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(data.user.id);
      
      if (deleteError) {
        console.log('⚠️  Could not delete test user:', deleteError.message);
      } else {
        console.log('✅ Test user cleaned up');
      }
    }

    return true;

  } catch (error) {
    console.error('💥 Auth settings check failed:', error);
    return false;
  }
}

// Also check database connection
async function checkDatabaseConnection() {
  console.log('\n🗄️  Checking Database Connection...');
  
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    const { data, error } = await serviceSupabase
      .from('User')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }

    console.log('✅ Database connection working');
    console.log(`📊 Found ${data?.length || 0} user records in database`);
    return true;

  } catch (error) {
    console.error('💥 Database check failed:', error);
    return false;
  }
}

if (require.main === module) {
  Promise.resolve()
    .then(checkAuthSettings)
    .then(checkDatabaseConnection)
    .then(() => {
      console.log('\n🏁 Configuration check complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkAuthSettings, checkDatabaseConnection };

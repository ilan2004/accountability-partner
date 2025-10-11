const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testAuth() {
  console.log('🧪 Testing Supabase Auth Configuration...');
  
  try {
    // Test creating a user
    const timestamp = Date.now().toString().slice(-8);
    const testEmail = `testuser${timestamp}@gmail.com`;
    const testPassword = 'TestPassword123!';
    const testUsername = 'Test User';

    console.log(`📧 Attempting to create test user: ${testEmail}`);
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername,
          name: testUsername,
        }
      }
    });

    if (error) {
      console.error('❌ Auth signup error:', error);
      return;
    }

    console.log('✅ Auth signup successful!');
    console.log('User created:', {
      id: data.user?.id,
      email: data.user?.email,
      email_confirmed_at: data.user?.email_confirmed_at,
      session_exists: !!data.session
    });

    if (data.user && !data.session) {
      console.log('📧 Email confirmation required - check your Supabase auth settings');
      console.log('💡 To disable email confirmation:');
      console.log('   1. Go to your Supabase dashboard');
      console.log('   2. Go to Authentication > Settings');
      console.log('   3. Turn off "Enable email confirmations"');
    }

    if (data.user) {
      // Now test creating the User record
      console.log('👤 Creating user profile record...');
      
      const { error: profileError } = await supabase
        .from('User')
        .upsert({
          id: data.user.id,
          email: testEmail,
          name: testUsername,
          emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('❌ Profile creation error:', profileError);
      } else {
        console.log('✅ User profile created successfully!');
      }

      // Clean up - delete the test user
      console.log('🧹 Cleaning up test user...');
      
      if (data.session) {
        // If we have a session, we can delete the user
        await supabase.auth.admin.deleteUser(data.user.id);
        console.log('✅ Test user cleaned up');
      } else {
        console.log('⚠️  Cannot clean up test user (no session) - you may need to delete manually');
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

async function checkSupabaseSettings() {
  console.log('⚙️  Checking Supabase connection...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('User')
      .select('count(*)')
      .limit(1);

    if (error) {
      console.error('❌ Database connection error:', error);
    } else {
      console.log('✅ Database connection working');
    }

    // Check auth settings by attempting a simple auth operation
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('❌ Auth connection error:', authError);
    } else {
      console.log('✅ Auth connection working');
    }

  } catch (error) {
    console.error('💥 Connection test failed:', error);
  }
}

if (require.main === module) {
  Promise.resolve()
    .then(checkSupabaseSettings)
    .then(testAuth)
    .then(() => {
      console.log('🏁 Test complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAuth, checkSupabaseSettings };

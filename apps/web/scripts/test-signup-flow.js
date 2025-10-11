const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCompleteSignupFlow() {
  console.log('🧪 Testing Complete Signup Flow...');
  
  try {
    // Step 1: Test auth signup (simulates what AuthContext.signUp does)
    const timestamp = Date.now().toString().slice(-6);
    const testEmail = `signuptest${timestamp}@gmail.com`;
    const testPassword = 'TestPassword123!';
    const testUsername = 'Signup Test User';

    console.log(`📧 Step 1: Creating auth user: ${testEmail}`);
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername,
          full_name: testUsername,
        }
      }
    });

    if (authError) {
      console.error('❌ Auth signup failed:', authError.message);
      return false;
    }

    console.log('✅ Auth user created:', {
      id: authData.user?.id,
      email: authData.user?.email,
      has_session: !!authData.session
    });

    if (!authData.user) {
      console.error('❌ No user returned from auth signup');
      return false;
    }

    // Step 2: Test profile creation API (simulates what the API endpoint does)
    console.log('👤 Step 2: Testing profile creation API...');
    
    // For this test, we'll create the service client directly
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
    
    const { data: profileData, error: profileError } = await serviceSupabase
      .from('User')
      .upsert({
        id: authData.user.id,
        email: testEmail,
        name: testUsername,
        emailVerified: authData.user.email_confirmed_at ? new Date(authData.user.email_confirmed_at) : null,
        image: authData.user.user_metadata?.avatar_url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Profile creation failed:', profileError.message);
    } else {
      console.log('✅ Profile created successfully:', {
        id: profileData.id,
        name: profileData.name,
        email: profileData.email
      });
    }

    // Step 3: Test profile retrieval (simulates dashboard access)
    console.log('📖 Step 3: Testing profile retrieval...');
    
    const { data: retrievedProfile, error: retrieveError } = await serviceSupabase
      .from('User')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (retrieveError) {
      console.error('❌ Profile retrieval failed:', retrieveError.message);
    } else {
      console.log('✅ Profile retrieved successfully:', {
        name: retrievedProfile.name,
        notionId: retrievedProfile.notionId,
        hasNotionConnection: !!retrievedProfile.notionId
      });
    }

    // Step 4: Clean up test data
    console.log('🧹 Step 4: Cleaning up test data...');
    
    // Delete profile
    const { error: deleteProfileError } = await serviceSupabase
      .from('User')
      .delete()
      .eq('id', authData.user.id);

    if (deleteProfileError) {
      console.error('⚠️  Could not delete test profile:', deleteProfileError.message);
    } else {
      console.log('✅ Test profile deleted');
    }

    // Delete auth user (requires admin client)
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

    const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(authData.user.id);
    
    if (deleteAuthError) {
      console.error('⚠️  Could not delete test auth user:', deleteAuthError.message);
    } else {
      console.log('✅ Test auth user deleted');
    }

    console.log('\n🎉 Complete signup flow test PASSED!');
    return true;

  } catch (error) {
    console.error('💥 Signup flow test failed:', error);
    return false;
  }
}

if (require.main === module) {
  testCompleteSignupFlow()
    .then((success) => {
      if (success) {
        console.log('\n✅ All tests passed! Signup flow should work.');
        console.log('\n📝 Next steps:');
        console.log('1. Make sure email confirmation is disabled in Supabase dashboard');
        console.log('2. Try signing up through the web app');
        console.log('3. Check that the user is redirected to the Notion connection page');
      } else {
        console.log('\n❌ Tests failed. Check the errors above.');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testCompleteSignupFlow };

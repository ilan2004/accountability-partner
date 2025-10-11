const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testWebAppSignupFlow() {
  console.log('🌐 Testing Web App Signup Flow (exact replica)...');
  
  // Create the exact same client as the web app
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // Use the exact same parameters as the AuthContext
    const email = `webapptest${Date.now().toString().slice(-6)}@gmail.com`;
    const password = 'TestPassword123!';
    const name = 'Web App Test User';

    console.log(`📧 Testing signup with: ${email}`);
    console.log('🔧 Using exact same parameters as AuthContext...');
    
    // This is the EXACT call from AuthContext.tsx line 117
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          username: name,
        },
      },
    });

    if (error) {
      console.error('❌ Signup failed with error:', error.message);
      console.log('Full error details:', {
        message: error.message,
        status: error.status,
        statusCode: error.__isAuthError
      });
      
      // Check if it's the same error as the web app
      if (error.message.includes('Database error saving new user')) {
        console.log('\n🔍 FOUND THE ISSUE!');
        console.log('This is the exact same error as the web app.');
        console.log('Even though our basic test worked, this specific call pattern fails.');
        
        // Try without the metadata
        console.log('\n🧪 Testing without user metadata...');
        
        const testEmail2 = `webapptest2${Date.now().toString().slice(-6)}@gmail.com`;
        const { data: data2, error: error2 } = await supabase.auth.signUp({
          email: testEmail2,
          password: password,
        });

        if (error2) {
          console.log('❌ Still fails without metadata:', error2.message);
        } else {
          console.log('✅ Works without metadata!');
          console.log('💡 The issue is with the user metadata in options.data');
        }
      }
      
      return false;
    }

    console.log('✅ Web app signup successful!');
    console.log('User created:', {
      id: data.user?.id,
      email: data.user?.email,
      metadata: data.user?.user_metadata,
      has_session: !!data.session
    });

    // Test the profile creation API call
    console.log('\n👤 Testing profile creation API call...');
    
    // Simulate the fetch call from AuthContext
    const profileResponse = await fetch('http://localhost:3000/api/auth/create-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In real app, this would include auth cookies
      },
      body: JSON.stringify({
        name: name,
        email: email,
      }),
    });

    if (!profileResponse.ok) {
      const errorData = await profileResponse.json();
      console.log('❌ Profile API failed:', errorData.error);
    } else {
      const profileData = await profileResponse.json();
      console.log('✅ Profile API worked:', profileData.user?.name);
    }

    // Clean up
    if (data.user) {
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

      await adminSupabase.auth.admin.deleteUser(data.user.id);
      console.log('🧹 Test user cleaned up');
    }

    return true;

  } catch (error) {
    console.error('💥 Web app flow test failed:', error);
    return false;
  }
}

if (require.main === module) {
  testWebAppSignupFlow()
    .then((success) => {
      console.log(`\n${success ? '✅' : '❌'} Web app signup test complete`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testWebAppSignupFlow };

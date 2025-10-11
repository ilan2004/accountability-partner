const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function createIlanUser() {
  console.log('👤 Creating user: Ilan Usman...');
  
  // Use admin/service role client to bypass all restrictions
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

  try {
    const email = 'ilanusman16@gmail.com';
    const password = 'Ilanusman1234';
    const name = 'Ilan Usman';

    console.log(`📧 Creating auth user: ${email}`);

    // Method 1: Create user with admin client (bypasses all restrictions)
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: name,
        username: name,
      }
    });

    if (authError) {
      console.error('❌ Admin user creation failed:', authError.message);
      
      // Method 2: Try regular signup as fallback
      console.log('🔄 Trying regular signup as fallback...');
      
      const regularSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { data: regularData, error: regularError } = await regularSupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            username: name,
          }
        }
      });

      if (regularError) {
        console.error('❌ Regular signup also failed:', regularError.message);
        return false;
      } else {
        console.log('✅ Regular signup worked as fallback');
        Object.assign(authData, regularData);
      }
    } else {
      console.log('✅ Admin user creation successful!');
    }

    if (!authData.user) {
      console.error('❌ No user data returned');
      return false;
    }

    console.log('👤 Auth user created:', {
      id: authData.user.id,
      email: authData.user.email,
      email_confirmed: authData.user.email_confirmed_at
    });

    // Create profile in User table
    console.log('📝 Creating user profile...');
    
    const { data: profileData, error: profileError } = await adminSupabase
      .from('User')
      .upsert({
        id: authData.user.id,
        email: email,
        name: name,
        emailVerified: authData.user.email_confirmed_at ? new Date(authData.user.email_confirmed_at) : new Date(),
        image: null,
        notionId: null,
        phoneNumber: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Profile creation failed:', profileError.message);
      return false;
    }

    console.log('✅ User profile created:', {
      id: profileData.id,
      name: profileData.name,
      email: profileData.email,
      hasNotionId: !!profileData.notionId
    });

    console.log('\n🎉 SUCCESS! User "Ilan Usman" has been created!');
    console.log('\n📝 You can now:');
    console.log(`   1. Sign in with: ${email}`);
    console.log(`   2. Password: ${password}`);
    console.log('   3. Go to: http://localhost:3000/auth/signin');
    console.log('   4. After signin, connect your Notion account');

    return true;

  } catch (error) {
    console.error('💥 User creation failed:', error);
    return false;
  }
}

// Also create a function to verify the user exists and can sign in
async function verifyUserCanSignIn() {
  console.log('\n🧪 Verifying user can sign in...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'ilanusman16@gmail.com',
      password: 'Ilanusman1234',
    });

    if (error) {
      console.error('❌ Sign in test failed:', error.message);
      return false;
    }

    console.log('✅ Sign in test successful!');
    console.log('User data:', {
      id: data.user?.id,
      email: data.user?.email,
      hasSession: !!data.session
    });

    // Clean up the test session
    await supabase.auth.signOut();
    console.log('🧹 Test session cleaned up');

    return true;

  } catch (error) {
    console.error('💥 Sign in test failed:', error);
    return false;
  }
}

if (require.main === module) {
  createIlanUser()
    .then((success) => {
      if (success) {
        return verifyUserCanSignIn();
      }
      return false;
    })
    .then((verified) => {
      if (verified) {
        console.log('\n🏁 All done! You can now sign in through the web app.');
      } else {
        console.log('\n❌ User created but sign in verification failed. Try signing in manually.');
      }
      process.exit(verified ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createIlanUser, verifyUserCanSignIn };

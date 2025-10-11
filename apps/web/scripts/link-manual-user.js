const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function linkManualUser() {
  console.log('🔗 Linking manually created auth user to database profile...');
  
  const regularSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

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

  const email = 'ilanusman16@gmail.com';
  const password = 'Ilanusman1234';

  try {
    // Step 1: Test sign in to get the user ID
    console.log('1️⃣ Testing sign in to get auth user ID...');
    
    const { data: signInData, error: signInError } = await regularSupabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      console.log('\n💡 Please create the user manually in Supabase dashboard first:');
      console.log('1. Go to: https://supabase.com/dashboard/project/tgdsoavhplrurbbexfvm/auth/users');
      console.log('2. Click "Add User"');
      console.log(`3. Email: ${email}`);
      console.log(`4. Password: ${password}`);
      console.log('5. Check "Auto Confirm User"');
      console.log('6. Click "Create User"');
      console.log('7. Run this script again');
      return false;
    }

    console.log('✅ Sign in successful!');
    console.log(`   Auth User ID: ${signInData.user.id}`);
    console.log(`   Email: ${signInData.user.email}`);
    console.log(`   Confirmed: ${!!signInData.user.email_confirmed_at}`);

    // Step 2: Update/create database profile
    console.log('\n2️⃣ Updating database profile...');
    
    const { error: profileError } = await adminSupabase
      .from('User')
      .upsert({
        id: signInData.user.id,
        email: email,
        name: 'Ilan Usman',
        emailVerified: signInData.user.email_confirmed_at ? new Date(signInData.user.email_confirmed_at) : new Date(),
        notionId: null,
        phoneNumber: null,
        image: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('❌ Profile update failed:', profileError.message);
      return false;
    }

    console.log('✅ Database profile updated successfully!');

    // Step 3: Verify the complete setup
    console.log('\n3️⃣ Verifying complete setup...');
    
    await regularSupabase.auth.signOut();
    
    // Test sign in again
    const { data: verifyData, error: verifyError } = await regularSupabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (verifyError) {
      console.error('❌ Verification sign in failed:', verifyError.message);
      return false;
    }

    // Check database profile
    const { data: profileData, error: profileCheckError } = await adminSupabase
      .from('User')
      .select('*')
      .eq('id', verifyData.user.id)
      .single();

    if (profileCheckError) {
      console.error('❌ Profile check failed:', profileCheckError.message);
      return false;
    }

    console.log('✅ Verification successful!');
    console.log('📝 User profile:', {
      id: profileData.id,
      name: profileData.name,
      email: profileData.email,
      hasNotionId: !!profileData.notionId,
      emailVerified: !!profileData.emailVerified
    });

    await regularSupabase.auth.signOut();

    console.log('\n🎉 SUCCESS! User "Ilan Usman" is fully set up!');
    console.log('\n📝 Next Steps:');
    console.log('1. Go to: http://localhost:3000/auth/signin');
    console.log(`2. Sign in with: ${email}`);
    console.log(`3. Password: ${password}`);
    console.log('4. You should be redirected to Notion connect page');
    console.log('5. Connect your Notion account to complete setup');

    return true;

  } catch (error) {
    console.error('💥 Linking process failed:', error);
    return false;
  }
}

if (require.main === module) {
  linkManualUser()
    .then((success) => {
      if (success) {
        console.log('\n🏁 All done! User is ready to use the web app.');
      } else {
        console.log('\n❌ Linking failed. Follow the manual steps above.');
      }
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { linkManualUser };

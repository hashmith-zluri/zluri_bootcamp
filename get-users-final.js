// Final script to get all users from PostgreSQL
async function getAllUsers() {
  console.log('Fetching all users from the database...');
  
  try {
    // Execute the users query
    const result = await query('SELECT * FROM users ORDER BY id');
    
    console.log("=== USERS TABLE - COMPLETE DATA ===");
    console.log("Total users found:", result.rows.length);
    console.log('');
    
    if (result.rows.length > 0) {
      console.log('All user records:');
      result.rows.forEach((user, index) => {
        console.log(`User ${index + 1}:`, JSON.stringify(user, null, 2));
      });
    } else {
      console.log('No users found in the database.');
    }
    
    console.log('');
    console.log('Query completed successfully!');
    
  } catch (error) {
    console.log('Failed to fetch users:', error.message);
  }
}

await getAllUsers();
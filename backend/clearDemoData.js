// backend/clearDemoData.js
// Clean up demo patient data after presentation
// Run with: node clearDemoData.js

const { db } = require("./services/firebaseService");

const DEMO_PATIENT_ID = "ZXVqNFx1pcRhxRx2VQMz3zNLaVJ3";

async function clearDemoData() {
  console.log('\n🧹 Starting cleanup of demo data...\n');
  
  try {
    // Clear logs (vitals data)
    console.log('🗑️  Clearing vitals logs...');
    await db.ref(`patients/${DEMO_PATIENT_ID}/logs`).remove();
    console.log('   ✅ Vitals logs cleared\n');
    
    // Clear alerts
    console.log('🗑️  Clearing alerts...');
    await db.ref(`patients/${DEMO_PATIENT_ID}/alerts`).remove();
    console.log('   ✅ Alerts cleared\n');
    
    // Clear processed data if exists
    console.log('🗑️  Clearing processed data...');
    await db.ref(`patients/${DEMO_PATIENT_ID}/processed`).remove();
    console.log('   ✅ Processed data cleared\n');
    
    // Clear status if exists
    console.log('🗑️  Clearing status data...');
    await db.ref(`patients/${DEMO_PATIENT_ID}/status`).remove();
    console.log('   ✅ Status data cleared\n');
    
    console.log('✨ Cleanup complete! Demo patient is ready for next run.\n');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

clearDemoData();
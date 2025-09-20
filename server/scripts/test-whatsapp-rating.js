#!/usr/bin/env node

/**
 * Test Script for WhatsApp Rating Processing
 * This script simulates a customer sending a rating via WhatsApp
 */

const CustomerRatingService = require('../services/CustomerRatingService');

async function testWhatsAppRating() {
  console.log('🧪 [WHATSAPP TEST] Starting WhatsApp Rating Test...\n');

  try {
    // Test cases
    const testCases = [
      {
        phone: '6282229261247', // Admin number for testing
        message: 'RATING 5 Teknisi sangat ramah dan pekerjaan rapi!',
        description: 'Valid rating with feedback'
      },
      {
        phone: '6282229261247',
        message: 'RATING 4',
        description: 'Valid rating without feedback'
      },
      {
        phone: '6282229261247',
        message: 'RATING 6',
        description: 'Invalid rating (too high)'
      },
      {
        phone: '6282229261247',
        message: 'RATING 0',
        description: 'Invalid rating (too low)'
      },
      {
        phone: '6282229261247',
        message: 'rating 3 bagus',
        description: 'Valid rating (lowercase)'
      },
      {
        phone: '6282229261247',
        message: 'INVALID MESSAGE',
        description: 'Invalid format'
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🔍 [WHATSAPP TEST] Testing: ${testCase.description}`);
      console.log(`📱 [WHATSAPP TEST] Phone: ${testCase.phone}`);
      console.log(`💬 [WHATSAPP TEST] Message: "${testCase.message}"`);
      
      try {
        const result = await CustomerRatingService.processWhatsAppRating(
          testCase.phone, 
          testCase.message
        );
        
        console.log(`📊 [WHATSAPP TEST] Result:`);
        console.log(`   - Success: ${result.success}`);
        console.log(`   - Message: ${result.message}`);
        
        if (result.success) {
          console.log(`✅ [WHATSAPP TEST] PASSED: ${testCase.description}`);
        } else {
          console.log(`⚠️ [WHATSAPP TEST] EXPECTED FAILURE: ${testCase.description}`);
        }
        
      } catch (error) {
        console.log(`❌ [WHATSAPP TEST] ERROR: ${error.message}`);
      }
    }

    console.log('\n🎉 [WHATSAPP TEST] WhatsApp rating test completed!');
    console.log('📱 [WHATSAPP TEST] Check technician WhatsApp for notification messages.');
    console.log('📊 [WHATSAPP TEST] Check server logs for detailed processing.');

  } catch (error) {
    console.error('❌ [WHATSAPP TEST] Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testWhatsAppRating()
    .then(() => {
      console.log('\n✅ [WHATSAPP TEST] Test script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ [WHATSAPP TEST] Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testWhatsAppRating };

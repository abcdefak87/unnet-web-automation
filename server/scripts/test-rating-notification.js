#!/usr/bin/env node

/**
 * Test Script for Rating Notification System
 * This script tests the rating notification functionality to ensure technicians receive notifications
 */

const prisma = require('../utils/database');
const CustomerRatingService = require('../services/CustomerRatingService');

async function testRatingNotification() {
  console.log('🧪 [TEST] Starting Rating Notification Test...\n');

  try {
    // 1. Find a completed job with technicians
    console.log('🔍 [TEST] Looking for completed jobs with technicians...');
    
    const completedJob = await prisma.job.findFirst({
      where: {
        status: 'COMPLETED',
        technicians: {
          some: {}
        }
      },
      include: {
        technicians: {
          include: {
            technician: true
          }
        },
        customer: true
      },
      orderBy: {
        completedAt: 'desc'
      }
    });

    if (!completedJob) {
      console.log('❌ [TEST] No completed jobs with technicians found. Please complete a job first.');
      return;
    }

    console.log(`✅ [TEST] Found job: ${completedJob.jobNumber}`);
    console.log(`📋 [TEST] Job details:`);
    console.log(`   - Customer: ${completedJob.customer?.name || 'Unknown'}`);
    console.log(`   - Category: ${completedJob.category || completedJob.type}`);
    console.log(`   - Technicians: ${completedJob.technicians.length}`);
    
    completedJob.technicians.forEach((assignment, index) => {
      const tech = assignment.technician;
      console.log(`   - Tech ${index + 1}: ${tech.name} (${tech.phone}) - JID: ${tech.whatsappJid || 'Not set'}`);
    });

    // 2. Check if job already has rating
    const existingRating = await prisma.jobTechnician.findFirst({
      where: {
        jobId: completedJob.id,
        customerRating: { not: null }
      }
    });

    if (existingRating) {
      console.log(`⚠️ [TEST] Job ${completedJob.jobNumber} already has rating: ${existingRating.customerRating}/5`);
      console.log('🔄 [TEST] Testing notification with existing rating...');
      
      // Test notification with existing rating
      await CustomerRatingService.notifyTechniciansAboutRating(
        completedJob, 
        existingRating.customerRating, 
        'Test notification from script'
      );
    } else {
      console.log('📝 [TEST] Job has no rating yet. Testing with new rating...');
      
      // 3. Test rating submission and notification
      const testRating = 5;
      const testFeedback = 'Test rating from notification test script';
      
      console.log(`🎯 [TEST] Submitting test rating: ${testRating}/5 with feedback: "${testFeedback}"`);
      
      const result = await CustomerRatingService.submitRating(
        completedJob.id, 
        testRating, 
        testFeedback
      );
      
      if (result.success) {
        console.log(`✅ [TEST] Rating submitted successfully: ${result.jobNumber}`);
      } else {
        console.log(`❌ [TEST] Failed to submit rating: ${result.error}`);
        return;
      }
    }

    console.log('\n🎉 [TEST] Rating notification test completed!');
    console.log('📱 [TEST] Check technician WhatsApp for notification messages.');
    console.log('📊 [TEST] Check server logs for detailed notification process.');

  } catch (error) {
    console.error('❌ [TEST] Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testRatingNotification()
    .then(() => {
      console.log('\n✅ [TEST] Test script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ [TEST] Test script failed:', error);
      process.exit(1);
    });
}

module.exports = { testRatingNotification };

const prisma = require('../utils/database');

class EnhancedTechnicianStatsService {
  /**
   * Get comprehensive technician statistics
   * @param {string} phoneNumber - Technician phone number
   * @returns {Object} Enhanced statistics object
   */
  async getEnhancedTechnicianStats(phoneNumber) {
    try {
      const normalized = this.normalizePhone(phoneNumber);
      
      // Try multiple search patterns
      let technician = await prisma.technician.findFirst({
        where: { 
          OR: [
            { whatsappJid: normalized + '@s.whatsapp.net' },
            { phone: normalized }
          ]
        },
        include: {
          jobAssignments: {
            include: {
              job: true
            }
          }
        }
      });

      // If not found, try broader search
      if (!technician) {
        
        // Try different phone formats
        const searchPatterns = [
          phoneNumber,
          phoneNumber.replace(/\D/g, ''),
          '0' + phoneNumber.replace(/\D/g, ''),
          '62' + phoneNumber.replace(/\D/g, ''),
          normalized,
          normalized + '@s.whatsapp.net'
        ];
        
        for (const pattern of searchPatterns) {
          technician = await prisma.technician.findFirst({
            where: {
              OR: [
                { phone: pattern },
                { whatsappJid: pattern }
              ]
            },
            include: {
              jobAssignments: {
                include: {
                  job: true
                }
              }
            }
          });
          
          if (technician) {
            break;
          }
        }
      }
      
      if (!technician) {
        return null;
      }

      const assignments = technician.jobAssignments || [];
      const completedJobs = assignments.filter(a => a.job && a.job.status === 'COMPLETED');
      const activeJobs = assignments.filter(a => a.job && ['ASSIGNED', 'IN_PROGRESS'].includes(a.job.status));
      
      // Calculate comprehensive statistics
      const stats = {
        // Basic stats
        basic: {
          totalJobs: assignments.length,
          completedJobs: completedJobs.length,
          activeJobs: activeJobs.length,
          completionRate: assignments.length > 0 ? 
            Math.round((completedJobs.length / assignments.length) * 100) : 0
        },

        // Performance metrics
        performance: await this.calculatePerformanceMetrics(assignments, completedJobs),

        // Rating system
        rating: await this.calculateRatingMetrics(assignments),

        // Time analysis
        timeAnalysis: await this.calculateTimeMetrics(assignments, completedJobs),

        // Category breakdown
        categoryBreakdown: await this.calculateCategoryBreakdown(assignments),

        // Trends and insights
        insights: await this.calculateInsights(technician, assignments, completedJobs),

        // Achievements
        achievements: [], // TODO: Implement achievements system

        // Recent activity
        recentActivity: await this.getRecentActivity(assignments),

      // Team comparison (disabled for now - requires database migration)
      teamComparison: null
      };

      return stats;
    } catch (error) {
      console.error('Error getting enhanced technician stats:', error);
      return null;
    }
  }

  /**
   * Calculate performance metrics
   */
  async calculatePerformanceMetrics(assignments, completedJobs) {
    const totalWorkTime = completedJobs.reduce((sum, job) => {
      return sum + (job.workTimeMinutes || 0);
    }, 0);

    const avgWorkTime = completedJobs.length > 0 ? 
      Math.round(totalWorkTime / completedJobs.length) : 0;

    const totalTravelTime = completedJobs.reduce((sum, job) => {
      return sum + (job.travelTimeMinutes || 0);
    }, 0);

    const avgTravelTime = completedJobs.length > 0 ? 
      Math.round(totalTravelTime / completedJobs.length) : 0;

    // Calculate efficiency score (0-100)
    const efficiencyScore = this.calculateEfficiencyScore(assignments, completedJobs);

    return {
      avgWorkTimeMinutes: avgWorkTime,
      avgTravelTimeMinutes: avgTravelTime,
      efficiencyScore,
      totalWorkHours: Math.round(totalWorkTime / 60),
      totalTravelHours: Math.round(totalTravelTime / 60)
    };
  }

  /**
   * Calculate rating metrics
   */
  async calculateRatingMetrics(assignments) {
    const ratings = assignments
      .filter(a => a.customerRating || a.customerSatisfaction)
      .map(a => a.customerRating || a.customerSatisfaction);

    if (ratings.length === 0) {
      return {
        averageRating: 0,
        ratingCount: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        qualityScore: 0
      };
    }

    const avgRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach(rating => {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    });

    const qualityScores = assignments
      .filter(a => a.qualityScore)
      .map(a => a.qualityScore);
    
    const avgQualityScore = qualityScores.length > 0 ? 
      qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : 0;

    return {
      averageRating: Math.round(avgRating * 10) / 10,
      ratingCount: ratings.length,
      ratingDistribution,
      qualityScore: Math.round(avgQualityScore * 10) / 10
    };
  }

  /**
   * Calculate time metrics
   */
  async calculateTimeMetrics(assignments, completedJobs) {
    if (completedJobs.length === 0) {
      return {
        avgCompletionTimeHours: 0,
        fastestJob: null,
        slowestJob: null,
        timeDistribution: {}
      };
    }

    const completionTimes = completedJobs.map(job => {
      const startTime = job.startedAt || job.acceptedAt || job.assignedAt;
      const endTime = job.completedAt;
      return (endTime - startTime) / (1000 * 60 * 60); // hours
    }).filter(time => time > 0);

    const avgCompletionTime = completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length;

    const fastestJob = completedJobs.reduce((fastest, current) => {
      const currentTime = current.completedAt - (current.startedAt || current.acceptedAt || current.assignedAt);
      const fastestTime = fastest ? fastest.completedAt - (fastest.startedAt || fastest.acceptedAt || fastest.assignedAt) : Infinity;
      return currentTime < fastestTime ? current : fastest;
    }, null);

    const slowestJob = completedJobs.reduce((slowest, current) => {
      const currentTime = current.completedAt - (current.startedAt || current.acceptedAt || current.assignedAt);
      const slowestTime = slowest ? slowest.completedAt - (slowest.startedAt || slowest.acceptedAt || slowest.assignedAt) : 0;
      return currentTime > slowestTime ? current : slowest;
    }, null);

    // Time distribution (same day, 1-3 days, 3-7 days, >7 days)
    const timeDistribution = {
      sameDay: 0,
      oneToThreeDays: 0,
      threeToSevenDays: 0,
      moreThanSevenDays: 0
    };

    completedJobs.forEach(job => {
      const duration = job.completedAt - job.assignedAt;
      const days = duration / (1000 * 60 * 60 * 24);
      
      if (days <= 1) timeDistribution.sameDay++;
      else if (days <= 3) timeDistribution.oneToThreeDays++;
      else if (days <= 7) timeDistribution.threeToSevenDays++;
      else timeDistribution.moreThanSevenDays++;
    });

    return {
      avgCompletionTimeHours: Math.round(avgCompletionTime * 10) / 10,
      fastestJob: fastestJob ? {
        jobNumber: fastestJob.job.jobNumber,
        duration: Math.round((fastestJob.completedAt - (fastestJob.startedAt || fastestJob.acceptedAt || fastestJob.assignedAt)) / (1000 * 60 * 60) * 10) / 10
      } : null,
      slowestJob: slowestJob ? {
        jobNumber: slowestJob.job.jobNumber,
        duration: Math.round((slowestJob.completedAt - (slowestJob.startedAt || slowestJob.acceptedAt || slowestJob.assignedAt)) / (1000 * 60 * 60) * 10) / 10
      } : null,
      timeDistribution
    };
  }

  /**
   * Calculate category breakdown
   */
  async calculateCategoryBreakdown(assignments) {
    const categoryStats = {};
    
    assignments.forEach(assignment => {
      const category = assignment.job.category || 'UNKNOWN';
      const status = assignment.job.status;
      
      if (!categoryStats[category]) {
        categoryStats[category] = {
          total: 0,
          completed: 0,
          active: 0,
          avgRating: 0,
          ratings: []
        };
      }
      
      categoryStats[category].total++;
      if (status === 'COMPLETED') categoryStats[category].completed++;
      if (['ASSIGNED', 'IN_PROGRESS'].includes(status)) categoryStats[category].active++;
      
      if (assignment.customerRating) {
        categoryStats[category].ratings.push(assignment.customerRating);
      }
    });

    // Calculate average ratings per category
    Object.keys(categoryStats).forEach(category => {
      const ratings = categoryStats[category].ratings;
      categoryStats[category].avgRating = ratings.length > 0 ? 
        Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10 : 0;
      categoryStats[category].completionRate = categoryStats[category].total > 0 ? 
        Math.round((categoryStats[category].completed / categoryStats[category].total) * 100) : 0;
    });

    return categoryStats;
  }

  /**
   * Calculate insights and recommendations
   */
  async calculateInsights(technician, assignments, completedJobs) {
    const insights = [];
    
    // Completion rate insight
    const completionRate = assignments.length > 0 ? 
      (completedJobs.length / assignments.length) * 100 : 0;
    
    if (completionRate >= 90) {
      insights.push({
        type: 'positive',
        title: 'Excellent Completion Rate',
        message: `Anda memiliki tingkat penyelesaian ${Math.round(completionRate)}% - sangat luar biasa!`
      });
    } else if (completionRate < 70) {
      insights.push({
        type: 'warning',
        title: 'Perlu Peningkatan',
        message: `Tingkat penyelesaian ${Math.round(completionRate)}% - coba fokus pada prioritas pekerjaan.`
      });
    }

    // Rating insight
    const avgRating = technician.totalRating && technician.ratingCount > 0 ? 
      technician.totalRating / technician.ratingCount : 0;
    
    if (avgRating >= 4.5) {
      insights.push({
        type: 'positive',
        title: 'Rating Tinggi',
        message: `Rating ${avgRating.toFixed(1)}/5 - pelanggan sangat puas dengan layanan Anda!`
      });
    }

    // Streak insight
    if (technician.streakDays > 0) {
      insights.push({
        type: 'info',
        title: 'Streak Aktif',
        message: `Anda telah aktif ${technician.streakDays} hari berturut-turut!`
      });
    }

    // Time efficiency insight
    const avgCompletionTime = technician.avgCompletionTimeHours || 0;
    if (avgCompletionTime > 0) {
      if (avgCompletionTime <= 4) {
        insights.push({
          type: 'positive',
          title: 'Efisiensi Waktu',
          message: `Rata-rata penyelesaian ${avgCompletionTime} jam - sangat efisien!`
        });
      } else if (avgCompletionTime > 24) {
        insights.push({
          type: 'warning',
          title: 'Perlu Optimasi',
          message: `Rata-rata penyelesaian ${avgCompletionTime} jam - pertimbangkan untuk mengoptimalkan proses.`
        });
      }
    }

    return insights;
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(assignments) {
    const recentJobs = assignments
      .sort((a, b) => new Date(b.job.updatedAt) - new Date(a.job.updatedAt))
      .slice(0, 5)
      .map(assignment => ({
        jobNumber: assignment.job.jobNumber,
        category: assignment.job.category,
        status: assignment.job.status,
        updatedAt: assignment.job.updatedAt,
        customerRating: assignment.customerRating,
        completionTime: assignment.completedAt ? 
          Math.round((assignment.completedAt - (assignment.startedAt || assignment.acceptedAt || assignment.assignedAt)) / (1000 * 60 * 60) * 10) / 10 : null
      }));

    return recentJobs;
  }

  /**
   * Get team comparison
   */
  async getTeamComparison(technicianId) {
    const teamStats = await prisma.technician.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        totalRating: true,
        ratingCount: true,
        avgCompletionTimeHours: true,
        jobAssignments: {
          select: {
            job: {
              select: { status: true }
            }
          }
        }
      }
    });

    const currentTechnician = teamStats.find(t => t.id === technicianId);
    if (!currentTechnician) return null;

    const currentAvgRating = currentTechnician.totalRating && currentTechnician.ratingCount > 0 ? 
      currentTechnician.totalRating / currentTechnician.ratingCount : 0;

    const currentCompletionCount = currentTechnician.jobAssignments.filter(a => a.job.status === 'COMPLETED').length;
    
    // Calculate rankings
    const avgRatings = teamStats.map(t => ({
      id: t.id,
      rating: t.totalRating && t.ratingCount > 0 ? t.totalRating / t.ratingCount : 0
    })).sort((a, b) => b.rating - a.rating);

    const completionCounts = teamStats.map(t => ({
      id: t.id,
      count: t.jobAssignments.filter(a => a.job.status === 'COMPLETED').length
    })).sort((a, b) => b.count - a.count);

    const ratingRank = avgRatings.findIndex(t => t.id === technicianId) + 1;
    const completionRank = completionCounts.findIndex(t => t.id === technicianId) + 1;

    return {
      teamSize: teamStats.length,
      ratingRank,
      completionRank,
      avgTeamRating: teamStats.length > 0 ? 
        teamStats.reduce((sum, t) => sum + (t.totalRating && t.ratingCount > 0 ? t.totalRating / t.ratingCount : 0), 0) / teamStats.length : 0
    };
  }

  /**
   * Calculate efficiency score
   */
  calculateEfficiencyScore(assignments, completedJobs) {
    if (completedJobs.length === 0) return 0;

    const completionRate = (completedJobs.length / assignments.length) * 100;
    const avgRating = completedJobs.reduce((sum, job) => sum + (job.customerRating || 0), 0) / completedJobs.length;
    
    // Weighted score: 60% completion rate, 40% rating
    const efficiencyScore = (completionRate * 0.6) + (avgRating * 20 * 0.4);
    
    return Math.min(Math.round(efficiencyScore), 100);
  }

  /**
   * Normalize phone number
   */
  normalizePhone(phone) {
    if (!phone) return null;
    let p = phone.toString().replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.substring(1);
    if (!p.startsWith('62')) p = '62' + p;
    return p;
  }

  /**
   * Update technician performance metrics
   */
  async updateTechnicianPerformance(technicianId) {
    try {
      const technician = await prisma.technician.findUnique({
        where: { id: technicianId },
        include: {
          jobAssignments: {
            include: { job: true }
          }
        }
      });

      if (!technician) return;

      const assignments = technician.jobAssignments;
      const completedJobs = assignments.filter(a => a.job.status === 'COMPLETED');
      
      // Calculate new metrics
      const totalRating = completedJobs.reduce((sum, job) => sum + (job.customerRating || 0), 0);
      const ratingCount = completedJobs.filter(job => job.customerRating).length;
      const avgRating = ratingCount > 0 ? totalRating / ratingCount : 0;

      const completionTimes = completedJobs.map(job => {
        const startTime = job.startedAt || job.acceptedAt || job.assignedAt;
        const endTime = job.completedAt;
        return (endTime - startTime) / (1000 * 60 * 60);
      }).filter(time => time > 0);

      const avgCompletionTime = completionTimes.length > 0 ? 
        completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length : 0;

      const performanceScore = this.calculateEfficiencyScore(assignments, completedJobs);

      // Update technician record
      await prisma.technician.update({
        where: { id: technicianId },
        data: {
          totalRating,
          ratingCount,
          avgCompletionTimeHours: avgCompletionTime,
          performanceScore,
          lastPerformanceUpdate: new Date()
        }
      });

      // Log daily performance
      await this.logDailyPerformance(technicianId, {
        jobsCompleted: completedJobs.length,
        avgRating,
        avgCompletionTime,
        performanceScore
      });

    } catch (error) {
      console.error('Error updating technician performance:', error);
    }
  }

  /**
   * Log daily performance
   */
  async logDailyPerformance(technicianId, metrics) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.technicianPerformanceLog.upsert({
        where: {
          technicianId_date: {
            technicianId,
            date: today
          }
        },
        update: metrics,
        create: {
          technicianId,
          date: today,
          ...metrics
        }
      });
    } catch (error) {
      console.error('Error logging daily performance:', error);
    }
  }
}

module.exports = new EnhancedTechnicianStatsService();

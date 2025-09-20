const prisma = require('../utils/database');

class TechnicianAchievementService {
  constructor() {
    this.achievementTypes = {
      COMPLETION_STREAK: {
        name: 'Streak Master',
        description: 'Menyelesaikan pekerjaan berturut-turut',
        thresholds: [3, 7, 15, 30],
        emoji: '🔥'
      },
      HIGH_RATING: {
        name: 'Rating Champion',
        description: 'Mendapatkan rating tinggi',
        thresholds: [4.5, 4.8, 4.9, 5.0],
        emoji: '⭐'
      },
      FAST_COMPLETION: {
        name: 'Speed Demon',
        description: 'Menyelesaikan pekerjaan dengan cepat',
        thresholds: [2, 4, 8, 12], // hours
        emoji: '⚡'
      },
      TEAM_PLAYER: {
        name: 'Team Player',
        description: 'Bekerja sama dengan tim',
        thresholds: [5, 10, 20, 50], // team jobs
        emoji: '👥'
      },
      PROBLEM_SOLVER: {
        name: 'Problem Solver',
        description: 'Menyelesaikan masalah teknis sulit',
        thresholds: [5, 15, 30, 50], // complex jobs
        emoji: '🧠'
      },
      CUSTOMER_SATISFACTION: {
        name: 'Customer Favorite',
        description: 'Kepuasan pelanggan tinggi',
        thresholds: [10, 25, 50, 100], // satisfied customers
        emoji: '😊'
      },
      EFFICIENCY: {
        name: 'Efficiency Expert',
        description: 'Efisiensi kerja tinggi',
        thresholds: [80, 85, 90, 95], // percentage
        emoji: '🎯'
      },
      CONSISTENCY: {
        name: 'Consistency King',
        description: 'Konsistensi performa',
        thresholds: [30, 60, 90, 180], // days
        emoji: '📈'
      }
    };
  }

  /**
   * Check and award achievements for a technician
   * @param {string} technicianId - Technician ID
   * @param {Object} stats - Current technician statistics
   */
  async checkAndAwardAchievements(technicianId, stats) {
    try {
      const technician = await prisma.technician.findUnique({
        where: { id: technicianId },
        include: {
          achievements: true,
          jobAssignments: {
            include: { job: true }
          }
        }
      });

      if (!technician) return [];

      const newAchievements = [];

      // Check each achievement type
      for (const [type, config] of Object.entries(this.achievementTypes)) {
        const currentValue = await this.getCurrentValue(technician, stats, type);
        const earnedAchievements = await this.checkThresholds(
          technicianId, 
          type, 
          config, 
          currentValue
        );
        newAchievements.push(...earnedAchievements);
      }

      return newAchievements;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  /**
   * Get current value for achievement type
   */
  async getCurrentValue(technician, stats, achievementType) {
    const assignments = technician.jobAssignments;
    const completedJobs = assignments.filter(a => a.job.status === 'COMPLETED');

    switch (achievementType) {
      case 'COMPLETION_STREAK':
        return await this.getCurrentStreak(technician.id);
      
      case 'HIGH_RATING':
        const avgRating = technician.totalRating && technician.ratingCount > 0 ? 
          technician.totalRating / technician.ratingCount : 0;
        return avgRating;
      
      case 'FAST_COMPLETION':
        const completionTimes = completedJobs.map(job => {
          const startTime = job.startedAt || job.acceptedAt || job.assignedAt;
          const endTime = job.completedAt;
          return (endTime - startTime) / (1000 * 60 * 60); // hours
        }).filter(time => time > 0);
        
        return completionTimes.length > 0 ? 
          completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length : 0;
      
      case 'TEAM_PLAYER':
        return assignments.filter(a => a.role === 'SECONDARY' || a.role === 'SUPPORT').length;
      
      case 'PROBLEM_SOLVER':
        return completedJobs.filter(job => job.job.category === 'GANGGUAN' && job.job.priority === 'HIGH').length;
      
      case 'CUSTOMER_SATISFACTION':
        return completedJobs.filter(job => job.customerRating >= 4).length;
      
      case 'EFFICIENCY':
        return stats.performance?.efficiencyScore || 0;
      
      case 'CONSISTENCY':
        return await this.getActiveDays(technician.id);
      
      default:
        return 0;
    }
  }

  /**
   * Check achievement thresholds
   */
  async checkThresholds(technicianId, type, config, currentValue) {
    const existingAchievements = await prisma.technicianAchievement.findMany({
      where: {
        technicianId,
        achievementType: type
      }
    });

    const earnedThresholds = existingAchievements.map(a => 
      JSON.parse(a.metadata || '{}').threshold || 0
    );

    const newAchievements = [];

    for (const threshold of config.thresholds) {
      if (currentValue >= threshold && !earnedThresholds.includes(threshold)) {
        const achievement = await prisma.technicianAchievement.create({
          data: {
            technicianId,
            achievementType: type,
            achievementName: `${config.name} ${this.getThresholdSuffix(threshold)}`,
            description: `${config.description} - Level ${this.getLevel(threshold)}`,
            metadata: JSON.stringify({
              threshold,
              value: currentValue,
              earnedAt: new Date().toISOString()
            })
          }
        });

        newAchievements.push({
          ...achievement,
          emoji: config.emoji
        });
      }
    }

    return newAchievements;
  }

  /**
   * Get current completion streak
   */
  async getCurrentStreak(technicianId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let streak = 0;
      let checkDate = new Date(today);
      
      while (true) {
        const dayStart = new Date(checkDate);
        const dayEnd = new Date(checkDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        const jobCompleted = await prisma.jobTechnician.findFirst({
          where: {
            technicianId,
            job: {
              status: 'COMPLETED'
            },
            completedAt: {
              gte: dayStart,
              lte: dayEnd
            }
          }
        });
        
        if (!jobCompleted) break;
        
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
      
      return streak;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  }

  /**
   * Get active days count
   */
  async getActiveDays(technicianId) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeDays = await prisma.jobTechnician.groupBy({
        by: ['technicianId'],
        where: {
          technicianId,
          completedAt: {
            gte: thirtyDaysAgo
          }
        },
        _count: {
          id: true
        }
      });
      
      return activeDays.length > 0 ? activeDays[0]._count.id : 0;
    } catch (error) {
      console.error('Error calculating active days:', error);
      return 0;
    }
  }

  /**
   * Get threshold suffix
   */
  getThresholdSuffix(threshold) {
    if (threshold >= 100) return 'Master';
    if (threshold >= 50) return 'Expert';
    if (threshold >= 20) return 'Advanced';
    if (threshold >= 10) return 'Intermediate';
    return 'Beginner';
  }

  /**
   * Get level based on threshold
   */
  getLevel(threshold) {
    if (threshold >= 100) return 'IV';
    if (threshold >= 50) return 'III';
    if (threshold >= 20) return 'II';
    return 'I';
  }

  /**
   * Get all achievements for technician
   */
  async getTechnicianAchievements(technicianId) {
    try {
      return await prisma.technicianAchievement.findMany({
        where: { technicianId },
        orderBy: { earnedAt: 'desc' }
      });
    } catch (error) {
      console.error('Error getting technician achievements:', error);
      return [];
    }
  }

  /**
   * Get achievement leaderboard
   */
  async getAchievementLeaderboard(limit = 10) {
    try {
      const achievements = await prisma.technicianAchievement.groupBy({
        by: ['technicianId'],
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: limit
      });

      const leaderboard = await Promise.all(
        achievements.map(async (achievement) => {
          const technician = await prisma.technician.findUnique({
            where: { id: achievement.technicianId },
            select: { id: true, name: true, phone: true }
          });

          return {
            technician,
            achievementCount: achievement._count.id
          };
        })
      );

      return leaderboard;
    } catch (error) {
      console.error('Error getting achievement leaderboard:', error);
      return [];
    }
  }
}

module.exports = new TechnicianAchievementService();

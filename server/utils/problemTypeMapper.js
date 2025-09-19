/**
 * Utility functions for mapping problem types to readable text
 */

/**
 * Map problem type codes to readable Indonesian text
 * @param {string} problemType - The problem type code
 * @returns {string} - Readable problem type text
 */
function getProblemTypeText(problemType) {
  const types = {
    modem_rusak: 'Modem Rusak',
    kabel_putus: 'Kabel Putus',
    redaman_tinggi: 'Redaman Tinggi',
    ganti_modem_cas: 'Ganti Modem/CAS Rusak',
    masalah_settingan: 'Masalah Settingan',
    internet_lambat: 'Internet Lambat'
  }
  return types[problemType] || problemType || 'Tidak ada detail'
}

/**
 * Get problem description based on job category
 * @param {Object} job - Job object with category, problemType, description, etc.
 * @returns {string} - Formatted problem description
 */
function getProblemDescription(job) {
  if (job.category === 'GANGGUAN') {
    return getProblemTypeText(job.problemType)
  }
  if (job.category === 'PSB') {
    // For PSB, show package type from installation description
    return job.installationDescription || job.packageType || 'Pemasangan WiFi Baru'
  }
  return job.description || job.symptoms || job.notes || 'Tidak ada detail'
}

/**
 * Get all available problem types for GANGGUAN jobs
 * @returns {Array} - Array of problem type objects with code and label
 */
function getAvailableProblemTypes() {
  return [
    { code: 'modem_rusak', label: 'Modem Rusak' },
    { code: 'kabel_putus', label: 'Kabel Putus' },
    { code: 'redaman_tinggi', label: 'Redaman Tinggi' },
    { code: 'ganti_modem_cas', label: 'Ganti Modem/CAS Rusak' },
    { code: 'masalah_settingan', label: 'Masalah Settingan' },
    { code: 'internet_lambat', label: 'Internet Lambat' }
  ]
}

module.exports = {
  getProblemTypeText,
  getProblemDescription,
  getAvailableProblemTypes
}

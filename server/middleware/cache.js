const NodeCache = require('node-cache');

// Create cache instance with TTL (Time To Live)
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false // Don't clone objects for better performance
});

// Cache middleware factory
const createCacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for authenticated requests that need fresh data
    if (req.headers.authorization) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator 
      ? keyGenerator(req) 
      : `cache:${req.originalUrl}:${JSON.stringify(req.query)}`;

    // Try to get from cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = (data) => {
      // Cache the response
      cache.set(cacheKey, data, ttl);
      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
};

// Specific cache configurations
const cacheConfigs = {
  // Short cache for frequently accessed data
  short: createCacheMiddleware(60), // 1 minute
  
  // Medium cache for moderately changing data
  medium: createCacheMiddleware(300), // 5 minutes
  
  // Long cache for rarely changing data
  long: createCacheMiddleware(1800), // 30 minutes
  
  // Custom cache for specific endpoints
  inventory: createCacheMiddleware(120, (req) => {
    return `inventory:${req.params.id || 'list'}`;
  }),
  
  technicians: createCacheMiddleware(300, (req) => {
    return `technicians:${req.params.id || 'list'}`;
  }),
  
  customers: createCacheMiddleware(300, (req) => {
    return `customers:${req.params.id || 'list'}`;
  })
};

// Cache invalidation helper
const invalidateCache = (pattern) => {
  const keys = cache.keys();
  const regex = new RegExp(pattern);
  
  keys.forEach(key => {
    if (regex.test(key)) {
      cache.del(key);
    }
  });
};

// Clear all cache
const clearAllCache = () => {
  cache.flushAll();
};

// Get cache stats
const getCacheStats = () => {
  return cache.getStats();
};

module.exports = {
  cache,
  createCacheMiddleware,
  cacheConfigs,
  invalidateCache,
  clearAllCache,
  getCacheStats
};

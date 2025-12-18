import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = [
  {
    // Batas waktu 
    ttl: parseInt(process.env.THROTTLE_TTL!), 
    // Batas request
    limit: parseInt(process.env.THROTTLE_LIMIT!), 
  },
];
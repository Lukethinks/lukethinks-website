export const prerender = false;

import type { APIRoute } from 'astro';
import { redisClient } from '../../utils/redis';

export const GET: APIRoute = async () => {
  try {
    const isHealthy = await redisClient.ping();
    if (isHealthy) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          redis: 'connected',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Redis ping did not return PONG',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Redis error';
    return new Response(
      JSON.stringify({
        status: 'error',
        message,
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
};

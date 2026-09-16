import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, server } from '../server.js';

describe('Server REST API Integration Tests', () => {
  afterAll(() => {
    server.close();
  });

  it('should reject unauthenticated request to /api/dashboard', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });
});

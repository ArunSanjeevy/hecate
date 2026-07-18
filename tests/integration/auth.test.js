'use strict';

const request = require('supertest');
const app = require('../../app');
const { db } = require('../../lib/data-accessors/db');
const { disconnectRedis } = require('../../lib/cache/redis');

describe('Authentication and API key management', () => {
  beforeAll(async () => {
    const migrate = require('../../lib/helpers/migrate');
    await migrate();
  });

  beforeEach(async () => {
    await db.none('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await db.$pool.end();
    await disconnectRedis();
  });

  const signup = (email = 'owner@example.com') => request(app)
    .post('/api/v1/auth/signup')
    .send({ email, password: 'correct-horse-battery-staple' });

  it('registers a user without creating an SDK key', async () => {
    const res = await signup().expect(201);

    expect(res.body.status).toBe('success');
    expect(res.body.user.email).toBe('owner@example.com');
    expect(res.body.apiKey).toBeUndefined();
  });

  it('rejects duplicate emails and invalid login credentials', async () => {
    await signup().expect(201);
    await signup().expect(409);
    await request(app).post('/api/v1/auth/login').send({
      email: 'owner@example.com',
      password: 'wrong-password'
    }).expect(401);
  });

  it('authenticates a user and manages only their API keys', async () => {
    await signup().expect(201);
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'owner@example.com',
      password: 'correct-horse-battery-staple'
    }).expect(200);

    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.apiKeys).toEqual([]);

    const authorization = `Bearer ${login.body.token}`;
    const created = await request(app)
      .post('/api/v1/keys')
      .set('Authorization', authorization)
      .send({ name: 'Staging SDK' })
      .expect(201);

    expect(created.body.key.apiKey).toMatch(/^hk_[a-f0-9]{48}$/);
    const listed = await request(app)
      .get('/api/v1/keys')
      .set('Authorization', authorization)
      .expect(200);
    expect(listed.body.keys).toHaveLength(1);
    expect(listed.body.keys.every((key) => key.apiKey.includes('*'))).toBe(true);

    await request(app)
      .delete(`/api/v1/keys/${created.body.key.id}`)
      .set('Authorization', authorization)
      .expect(200);
    await request(app).get('/api/v1/keys').expect(401);
  });

  it('limits SDK keys to SDK routes while allowing the user JWT on the control plane', async () => {
    await signup('scoped-owner@example.com').expect(201);
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'scoped-owner@example.com',
      password: 'correct-horse-battery-staple'
    }).expect(200);
    const createdKey = await request(app)
      .post('/api/v1/keys')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Browser SDK' })
      .expect(201);
    const sdkKey = createdKey.body.key.apiKey;
    const experiment = {
      key: 'jwt_control_plane',
      status: 'active',
      variants: [
        { key: 'control', allocation: 50 },
        { key: 'treatment', allocation: 50 }
      ]
    };

    await request(app)
      .post('/api/v1/experiments')
      .set('x-api-key', sdkKey)
      .send(experiment)
      .expect(401);
    await request(app)
      .post('/api/v1/experiments')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send(experiment)
      .expect(201);
    await request(app)
      .post('/api/v1/assignments')
      .set('x-api-key', sdkKey)
      .send({ visitorId: 'sdk-visitor', experimentKeys: ['jwt_control_plane'] })
      .expect(200);
  });
});

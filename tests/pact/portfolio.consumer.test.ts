import { describe, it, expect } from 'vitest';
import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import path from 'path';

const provider = new PactV4({
  consumer: 'tracevault-web',
  provider: 'tracevault-gateway',
  dir: path.resolve(process.cwd(), 'pacts'),
});

describe('Portfolio API Contract', () => {
  it('returns portfolio value for authenticated user', async () => {
    await provider
      .addInteraction()
      .given('user has portfolio with assets')
      .uponReceiving('a request for portfolio value')
      .withRequest('GET', '/api/v1/valuation/portfolio', (builder) => {
        builder.headers({
          Authorization: 'Bearer valid-jwt-token',
          'Content-Type': 'application/json',
        });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ 'Content-Type': 'application/json' });
        builder.jsonBody({
          total_value: MatchersV3.like('50000000.00'),
          currency: 'KRW',
          assets: MatchersV3.eachLike({
            asset_id: MatchersV3.like('BTC'),
            symbol: MatchersV3.like('BTC'),
            amount: MatchersV3.like('0.5'),
            value_krw: MatchersV3.like('25000000.00'),
          }),
          updated_at: MatchersV3.like('2026-02-08T00:00:00Z'),
        });
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/v1/valuation/portfolio`,
          {
            headers: {
              Authorization: 'Bearer valid-jwt-token',
              'Content-Type': 'application/json',
            },
          },
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.total_value).toBeDefined();
        expect(body.assets).toBeInstanceOf(Array);
        expect(body.currency).toBe('KRW');
      });
  });

  it('returns ledger events (transactions)', async () => {
    await provider
      .addInteraction()
      .given('user has transactions')
      .uponReceiving('a request for ledger events')
      .withRequest('GET', '/api/v1/ledger/events', (builder) => {
        builder.headers({ Authorization: 'Bearer valid-jwt-token' });
        builder.query({ page: '1', limit: '20' });
      })
      .willRespondWith(200, (builder) => {
        builder.jsonBody({
          events: MatchersV3.eachLike({
            event_id: MatchersV3.like('evt-001'),
            event_type: MatchersV3.like('SELL'),
            asset: MatchersV3.like('BTC'),
            amount: MatchersV3.like('0.1'),
            timestamp: MatchersV3.like('2026-02-08T00:00:00Z'),
          }),
          pagination: {
            page: MatchersV3.like(1),
            limit: MatchersV3.like(20),
            total: MatchersV3.like(100),
          },
        });
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/v1/ledger/events?page=1&limit=20`,
          {
            headers: { Authorization: 'Bearer valid-jwt-token' },
          },
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.events).toBeInstanceOf(Array);
        expect(body.pagination).toBeDefined();
      });
  });

  it('returns tax summary for year', async () => {
    await provider
      .addInteraction()
      .given('user has tax calculations for 2026')
      .uponReceiving('a request for tax summary')
      .withRequest('GET', '/api/v1/tax/summary', (builder) => {
        builder.headers({ Authorization: 'Bearer valid-jwt-token' });
        builder.query({ year: '2026' });
      })
      .willRespondWith(200, (builder) => {
        builder.jsonBody({
          year: 2026,
          jurisdiction: MatchersV3.like('KR'),
          total_realized_gain: MatchersV3.like('5000000.00'),
          total_tax: MatchersV3.like('1100000.00'),
          deduction: MatchersV3.like('2500000.00'),
          events_count: MatchersV3.like(42),
        });
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/v1/tax/summary?year=2026`,
          {
            headers: { Authorization: 'Bearer valid-jwt-token' },
          },
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.year).toBe(2026);
        expect(body.jurisdiction).toBeDefined();
      });
  });

  it('returns exchange connections', async () => {
    await provider
      .addInteraction()
      .given('user has exchange connections')
      .uponReceiving('a request for connections')
      .withRequest('GET', '/api/v1/connections', (builder) => {
        builder.headers({ Authorization: 'Bearer valid-jwt-token' });
      })
      .willRespondWith(200, (builder) => {
        builder.jsonBody({
          connections: MatchersV3.eachLike({
            id: MatchersV3.like('conn-001'),
            exchange: MatchersV3.like('upbit'),
            status: MatchersV3.like('active'),
            last_synced_at: MatchersV3.like('2026-02-08T00:00:00Z'),
          }),
        });
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/v1/connections`,
          {
            headers: { Authorization: 'Bearer valid-jwt-token' },
          },
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.connections).toBeInstanceOf(Array);
      });
  });
});

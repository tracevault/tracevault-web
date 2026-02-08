import { PactV4 } from '@pact-foundation/pact';
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
          total_value: provider.like('50000000.00'),
          currency: 'KRW',
          assets: provider.eachLike({
            asset_id: provider.like('BTC'),
            symbol: provider.like('BTC'),
            amount: provider.like('0.5'),
            value_krw: provider.like('25000000.00'),
          }),
          updated_at: provider.like('2026-02-08T00:00:00Z'),
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
          events: provider.eachLike({
            event_id: provider.like('evt-001'),
            event_type: provider.like('SELL'),
            asset: provider.like('BTC'),
            amount: provider.like('0.1'),
            timestamp: provider.like('2026-02-08T00:00:00Z'),
          }),
          pagination: {
            page: provider.like(1),
            limit: provider.like(20),
            total: provider.like(100),
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
          jurisdiction: provider.like('KR'),
          total_realized_gain: provider.like('5000000.00'),
          total_tax: provider.like('1100000.00'),
          deduction: provider.like('2500000.00'),
          events_count: provider.like(42),
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
          connections: provider.eachLike({
            id: provider.like('conn-001'),
            exchange: provider.like('upbit'),
            status: provider.like('active'),
            last_synced_at: provider.like('2026-02-08T00:00:00Z'),
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

import { appConfig } from './app.config';

describe('appConfig', () => {
  it('provides the router and the coachmark storage', () => {
    expect(appConfig.providers).toBeDefined();
    expect(appConfig.providers.length).toBe(2);
  });
});

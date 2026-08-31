import { DemoPageComponent } from './demo-page/demo-page.component';
import { routes } from './app.routes';

describe('routes', () => {
  it('routes the root path to the demo page', () => {
    expect(routes).toEqual([{ path: '', component: DemoPageComponent }]);
  });
});

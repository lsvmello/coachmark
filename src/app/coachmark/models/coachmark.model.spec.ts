import { EMPTY_COACHMARK_STATE, SPOTLIGHT_PADDING } from './coachmark.model';

describe('coachmark.model', () => {
  it('exposes an empty state with no step and default flags', () => {
    expect(EMPTY_COACHMARK_STATE).toEqual({
      step: null,
      index: 0,
      total: 0,
      isFirst: true,
      isLast: false,
      arrowSide: 'none',
      targetRect: null,
    });
  });

  it('exposes the spotlight padding used by the service and the spotlight svg', () => {
    expect(SPOTLIGHT_PADDING).toBe(8);
  });
});

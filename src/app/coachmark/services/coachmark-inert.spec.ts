import { inertOutside } from './coachmark-inert';

/**
 * <body>
 *   <div id="app">
 *     <header id="header"></header>
 *     <main id="main">
 *       <section id="before"></section>
 *       <div id="target"><span id="inside"></span></div>
 *       <section id="after"></section>
 *     </main>
 *   </div>
 *   <div id="overlay"><div id="pane"></div><div id="other-pane"></div></div>
 *   <div id="loose"></div>
 * </body>
 */
function buildFixture(): void {
  document.body.innerHTML = `
    <div id="app">
      <header id="header"></header>
      <main id="main">
        <section id="before"></section>
        <div id="target"><span id="inside"></span></div>
        <section id="after"></section>
      </main>
    </div>
    <div id="overlay"><div id="pane"></div><div id="other-pane"></div></div>
    <div id="loose"></div>
  `;
}

function byId(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function isInert(id: string): boolean {
  return byId(id).hasAttribute('inert');
}

describe('inertOutside', () => {
  beforeEach(buildFixture);

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('makes the siblings along the path inert, but not the kept element or its ancestors', () => {
    inertOutside([byId('target')]);

    expect(isInert('header')).toBe(true);
    expect(isInert('before')).toBe(true);
    expect(isInert('after')).toBe(true);
    expect(isInert('overlay')).toBe(true);
    expect(isInert('loose')).toBe(true);

    expect(isInert('target')).toBe(false);
    expect(isInert('main')).toBe(false);
    expect(isInert('app')).toBe(false);
  });

  it('leaves the kept element children untouched', () => {
    inertOutside([byId('target')]);

    expect(isInert('inside')).toBe(false);
  });

  it('keeps several kept elements reachable without making each other inert', () => {
    inertOutside([byId('target'), byId('pane')]);

    expect(isInert('target')).toBe(false);
    expect(isInert('pane')).toBe(false);
    expect(isInert('overlay')).toBe(false);
    expect(isInert('app')).toBe(false);

    expect(isInert('other-pane')).toBe(true);
    expect(isInert('loose')).toBe(true);
  });

  it('restores every attribute it added', () => {
    const restore = inertOutside([byId('target')]);

    restore();

    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  });

  it('keeps elements that were already inert as they were', () => {
    byId('after').setAttribute('inert', '');
    byId('loose').setAttribute('inert', '');

    const restore = inertOutside([byId('target')]);
    restore();

    expect(isInert('after')).toBe(true);
    expect(isInert('loose')).toBe(true);
    expect(isInert('before')).toBe(false);
    expect(isInert('header')).toBe(false);
  });

  it('never touches the CDK live announcer and aria describer containers', () => {
    const announcer = document.createElement('div');
    announcer.className = 'cdk-live-announcer-element';
    const describer = document.createElement('div');
    describer.className = 'cdk-describedby-message-container';
    document.body.append(announcer, describer);

    inertOutside([byId('target')]);

    expect(announcer.hasAttribute('inert')).toBe(false);
    expect(describer.hasAttribute('inert')).toBe(false);
  });

  it('ignores null and undefined entries', () => {
    inertOutside([null, byId('pane'), undefined]);

    expect(isInert('pane')).toBe(false);
    expect(isInert('app')).toBe(true);
  });
});

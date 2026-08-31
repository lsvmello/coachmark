# Coachmark Demo

Angular 17.3.x app used to develop and try out the `Coachmark` component
(standalone components + `@angular/cdk` overlay, no external UI library).

Component source and docs: [`src/app/coachmark/README.md`](src/app/coachmark/README.md).

## Development server

```
npm install
npm start
```

Navigate to `http://localhost:4200/`. The demo page (`src/app/demo-page`)
launches the tour automatically on load, highlighting the "Filtrar por data"
button and the summary section. Use "Ver dicas novamente" to replay it
on demand, bypassing the once-a-month/3-months storage rule.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

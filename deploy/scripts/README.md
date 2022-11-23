# Performance Test Scripts

This folder (`deploy/scripts`) contains the configuration, test scripts and test data for performance tests.

Test scripts are written in TypeScript, and transpiled into JavaScript via esbuild to run in k6. For deploying in environments these scripts are bundled into the Docker image which is used as the CodeBuild agent; when testing locally these can just be run directly from `deploy/scripts/dist`.

## Prerequisites

- [k6](https://k6.io/docs/getting-started/installation)
- [NodeJS](https://nodejs.org/en/download/)

## Local Installation
Clone the repository and navigate to this folder `deploy/scripts`. Then to install the dependencies in [`package.json`](package.json) run

```bash
npm install
```

## Local Testing
Test scripts are written in the `src` folder. Test script files must match the path ( `src/*.ts`) specified in the [build.js](build.js#L7) file. Static data files are kept in the `src/data`, they are copied to `dist/data` by esbuild as defined [here](build.js#L18-L25).

To run a TypeScript test locally, navigate to the `deploy/scripts` folder and run the following

```bash
npm start
```
This command will generate the JavaScript files in the `dist` folder. These can then be run with k6 inn the normal way using a command such as

```bash
k6 run dist/test.js
```

## Unit Testing
Unit tests to validate the TypeScript utility files are contained in the [`src/unit-tests.js`](src/unit-tests.ts) file. They can be run to validate the utilities are working as intended by running

```bash
npm test
```

This unit test also runs when raising pull requests as a [github action](../../.github/workflows/push.yml). If adding an additional utility in the `src/utils` folder, add another `group` to the test script with `checks` to validate the behaviour.
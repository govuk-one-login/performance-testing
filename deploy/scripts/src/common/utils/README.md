# Utility functions

This directory (`common/utils`) contains TypeScript and JavaScript utility functions that can be used in test scripts.

## Generating documentation

These utility files contain comments in [TSDoc](https://tsdoc.org/)/[JSDoc](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html) format.
To generate [TypeDoc](https://typedoc.org/) documentation for these files run the following commands in the `scripts` directory

```console
% npx typedoc ./src/common/utils/**/*.ts
% open ./docs/index.html
```

This documentation is also avaialble on the GitHub page site for the repository.
// `server-only` is resolved by Next's bundler, not by Node. Under the test
// runner it is aliased here (see tests/tsconfig.json) so modules that import
// it can be loaded outside a Next build.
export {}

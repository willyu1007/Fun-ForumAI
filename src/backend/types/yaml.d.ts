declare module 'yaml' {
  export function parse<T = unknown>(input: string): T
  export function stringify(input: unknown): string
}

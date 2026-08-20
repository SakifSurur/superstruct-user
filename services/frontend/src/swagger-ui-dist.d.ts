declare module 'swagger-ui-dist/swagger-ui-es-bundle.js' {
  interface SwaggerUIOptions {
    domNode: HTMLElement;
    spec: unknown;
    deepLinking?: boolean;
    tryItOutEnabled?: boolean;
    defaultModelsExpandDepth?: number;
  }
  const SwaggerUIBundle: (options: SwaggerUIOptions) => unknown;
  export default SwaggerUIBundle;
}

declare module 'swagger-ui-dist/swagger-ui.css';

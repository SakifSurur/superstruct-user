import { useEffect, useRef } from 'react';
import SwaggerUIBundle from 'swagger-ui-dist/swagger-ui-es-bundle.js';
import 'swagger-ui-dist/swagger-ui.css';
import { openapiSpec } from './openapi';

// Loaded lazily (React.lazy in App) so Swagger UI's ~1.3MB only downloads
// when the explorer is actually opened.
export default function SwaggerDocs() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    SwaggerUIBundle({
      domNode: node,
      spec: openapiSpec,
      deepLinking: false,
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 0,
    });
    return () => {
      node.innerHTML = '';
    };
  }, []);

  return <div ref={container} className="swagger-container" />;
}

/**
 * @fileoverview Frontend logger configuration for Grafana LGTM stack
 *
 * Example React component showing browser logger setup optimized for:
 * - Remote logging to Loki via HTTP endpoint
 * - Sentry for error tracking
 * - LocalStorage buffering for offline support
 */

import type { BrowserLogger } from '@mrstern/logger/browser';

import { initBrowserLogger } from '@mrstern/logger/browser';
import { createContext, useContext, useMemo } from 'react';

/**
 * Logger context for React
 */
const LoggerContext = createContext<BrowserLogger | null>(null);

/**
 * Initialize browser logger optimized for production
 */
function createProductionLogger(): BrowserLogger {
  return initBrowserLogger({
    level: import.meta.env.DEV ? 'debug' : 'info',
    service: 'web-app',

    // Console output in development only
    console: import.meta.env.DEV,

    // Remote logging configuration
    remote: {
      // Your backend endpoint that forwards logs to Loki
      url: import.meta.env.VITE_LOG_ENDPOINT ?? 'https://api.example.com/logs',

      // Authentication headers
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_LOG_API_KEY}`,
      },

      // Batching for performance
      batch: {
        size: 50, // Send when 50 logs accumulated
        interval: 5000, // Or every 5 seconds
      },

      // Enable offline buffering
      enableOfflineBuffer: true,
    },

    // Sentry for error tracking
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,

    // Global context included in all logs
    context: {
      env: import.meta.env.MODE,
      version: import.meta.env.VITE_APP_VERSION,
    },

    // Redact sensitive fields
    redactPaths: ['password', 'token', 'apiKey', 'creditCard'],
  });
}

/**
 * Logger provider component
 */
export function LoggerProvider({ children }: { children: React.ReactNode }) {
  const logger = useMemo(() => createProductionLogger(), []);

  return (
    <LoggerContext.Provider value={logger}>{children}</LoggerContext.Provider>
  );
}

/**
 * Hook to use logger in components
 */
export function useLogger(): BrowserLogger {
  const logger = useContext(LoggerContext);
  if (logger == null) {
    throw new Error('useLogger must be used within LoggerProvider');
  }
  return logger;
}

/**
 * Example: User authentication component
 */
function LoginForm() {
  const logger = useLogger();

  const handleLogin = async (email: string, password: string) => {
    // Create child logger with user context
    const loginLogger = logger.child({
      component: 'LoginForm',
      operation: 'login',
    });

    loginLogger.info({ email }, 'Login attempt started');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }), // password is redacted
      });

      if (response.ok) {
        loginLogger.info({ email }, 'Login successful');
      } else {
        loginLogger.warn({ email, status: response.status }, 'Login failed');
      }
    } catch (err) {
      // Error automatically sent to Sentry (level === 'error')
      loginLogger.error({ err, email }, 'Login request failed');
    }
  };

  return <form>{/* Form UI */}</form>;
}

/**
 * Example: E-commerce checkout component
 */
function CheckoutButton() {
  const logger = useLogger();

  const handleCheckout = async (cartId: string, amount: number) => {
    const checkoutLogger = logger.child({
      component: 'CheckoutButton',
      operation: 'checkout',
      cartId,
    });

    // Set trace context for correlation with backend
    checkoutLogger.setTraceContext({
      traceId: generateTraceId(),
      spanId: generateSpanId(),
    });

    checkoutLogger.info({ amount, currency: 'USD' }, 'Starting checkout');

    try {
      await processPayment(cartId, amount);
      checkoutLogger.info({ amount }, 'Checkout completed');
    } catch (err) {
      checkoutLogger.error({ err, amount }, 'Checkout failed');
    } finally {
      checkoutLogger.clearTraceContext();
    }
  };

  return (
    <button onClick={() => handleCheckout('cart-123', 99.99)}>Checkout</button>
  );
}

/**
 * Example: Backend log forwarding endpoint
 *
 * This endpoint receives logs from the browser and forwards them to Loki.
 * Deploy this on your backend server.
 */
/*
// backend-endpoint.ts
import { Hono } from 'hono';
import { initLogger } from '@mrstern/logger';
import { createLokiTransport } from '@mrstern/logger/transports/loki';

const app = new Hono();

// Forward browser logs to Loki
app.post('/logs', async (c) => {
  const logs = await c.req.json();

  // Initialize logger with Loki transport
  const logger = await initLogger({
    level: 'info',
    transports: [
      createLokiTransport({
        host: process.env.LOKI_URL,
        labels: {
          service: 'web-app',
          env: 'production',
          source: 'browser',
        },
      }),
    ],
  });

  // Forward each log entry
  for (const log of logs) {
    logger[log.level](log.context, log.message);
  }

  return c.json({ success: true });
});
*/

function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function generateSpanId(): string {
  return Math.random().toString(36).substring(2, 11);
}

async function processPayment(_cartId: string, _amount: number): Promise<void> {
  // Payment processing logic
}

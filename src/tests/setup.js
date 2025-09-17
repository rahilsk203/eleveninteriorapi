/**
 * Test Setup for Eleven Interior API
 */

// Global test setup
beforeEach(() => {
  // Reset any global state before each test
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

// Mock crypto for testing environment
if (!global.crypto) {
  global.crypto = {
    getRandomValues: (array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    subtle: {
      digest: async (algorithm, data) => {
        // Mock implementation for testing
        return new ArrayBuffer(32);
      },
      importKey: async () => {
        return {};
      },
      sign: async () => {
        return new ArrayBuffer(32);
      }
    }
  };
}

// Mock Headers class
if (!global.Headers) {
  global.Headers = class MockHeaders extends Map {
    constructor(init) {
      super();
      if (init) {
        if (typeof init === 'object') {
          for (const [key, value] of Object.entries(init)) {
            this.set(key.toLowerCase(), value);
          }
        }
      }
    }
    
    get(name) {
      return super.get(name.toLowerCase());
    }
    
    set(name, value) {
      return super.set(name.toLowerCase(), value);
    }
    
    has(name) {
      return super.has(name.toLowerCase());
    }
    
    delete(name) {
      return super.delete(name.toLowerCase());
    }
    
    entries() {
      return super.entries();
    }
  };
}

// Mock Response class
if (!global.Response) {
  global.Response = class MockResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = new Headers(init.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }
    
    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body;
    }
    
    async text() {
      if (typeof this.body === 'string') {
        return this.body;
      }
      return JSON.stringify(this.body);
    }
  };
}

// Mock performance for testing
if (!global.performance) {
  global.performance = {
    now: () => Date.now()
  };
}

// Mock console methods to reduce test noise
const originalConsole = { ...console };
global.console = {
  ...console,
  log: () => {}, // Suppress logs during testing
  warn: () => {}, // Suppress warnings during testing
  error: originalConsole.error // Keep errors for debugging
};
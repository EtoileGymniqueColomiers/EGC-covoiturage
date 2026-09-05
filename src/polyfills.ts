import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

class DOMExceptionPolyfill extends Error {
  constructor(message?: string, name?: string) {
    super(message);
    this.name = name || 'Error';
  }
}

Object.defineProperty(global, 'DOMException', {
  value: DOMExceptionPolyfill,
  writable: true,
  configurable: true,
});

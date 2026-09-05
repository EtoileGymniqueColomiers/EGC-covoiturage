import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

if (typeof global.DOMException === 'undefined') {
  const { DOMException } = require('web-streams-polyfill');
  global.DOMException = DOMException;
  globalThis.DOMException = DOMException;
}

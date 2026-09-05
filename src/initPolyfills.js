if (typeof global.DOMException === 'undefined') {
  function DOMException(message, name) {
    this.message = message || '';
    this.name = name || 'Error';
  }
  DOMException.prototype = Object.create(Error.prototype);
  DOMException.prototype.constructor = DOMException;
  global.DOMException = DOMException;
}

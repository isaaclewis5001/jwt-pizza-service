const jsonwebtoken = require('jsonwebtoken');

class JWToken {
  constructor(token) {
    this._fullText = token;
    const parts = token.split('.');
    if (parts.length > 2) {
      this._signature = parts[2];
    }
    else {
      this._signature = '';
    }
  }

  static sign(payload, secret) {
    return new JWToken(jsonwebtoken.sign(payload, secret));
  }

  static fromRequest(request) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }

    let split = authHeader.split(' ');
    if (split.length < 2) {
      return null;
    }

    return new JWToken(split[1]);
  }

  verify(secret) {
    return jsonwebtoken.verify(this.fullText, secret);
  }

  get signature() {
    return this._signature;
  }

  get fullText() {
    return this._fullText;
  }
}

module.exports = JWToken;

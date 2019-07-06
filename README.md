# bwt

[![Travis](http://img.shields.io/travis/chiefbiiko/bwt.svg?style=flat)](http://travis-ci.org/chiefbiiko/bwt) [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/chiefbiiko/bwt?branch=master&svg=true)](https://ci.appveyor.com/project/chiefbiiko/bwt)

> Know someone that can *security review* this module?

## Usage

...

## Design

- `BWT` tokens are [encrypted and authenticated](https://en.wikipedia.org/wiki/Authenticated_encryption)
  - high-security `AEAD_CHACHA20_POLY1305` scheme
  - [RFC 8439](https://tools.ietf.org/html/rfc8439) compliant

- no [crypto agility](https://en.wikipedia.org/wiki/Crypto_agility) available to module users
  
- `BWT`s require a fixed set of four header claims: `typ`, `iat`, `exp`, `kid`

- in case of unexpected state marshalling ops return `null` rather than `throw`ing exceptions (that possibly leak sensitive information)
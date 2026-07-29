# Privacy and Demo Data

The public repository and Cloudflare demo use synthetic identities only. The baseline students are Jordan, Avery, and Guest Student. Real exports belong outside Git and are ignored by default.

The demo stores changes in the visitor's browser. It must not imply cloud accounts, encryption, FERPA compliance, or durable multi-device records.

Before every public release:

- run the privacy scan with private terms supplied through `BLH_PRIVATE_TERMS`
- inspect screenshots and fixtures
- reset the demo to synthetic defaults
- confirm no credentials, tokens, private URLs, or real family notes are present

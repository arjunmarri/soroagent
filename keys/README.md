# Extension ID key

`chrome-public-key.txt` is the public key Chrome uses to derive soroagent's extension ID for
unpacked installs: **jomghmmgdlajfonjihmagbhomimadpcg**. Because the ID never changes, every
new version you load keeps the same storage, so snippets, summary history and settings carry over
across updates, whatever folder you unzip into.

The build adds it to the Chrome manifest as `"key"`. No private key is needed or kept.

**Chrome Web Store:** the store assigns its own ID. Build the upload with `npm run store` (no
`key`). After the first upload, copy the item's public key from the Developer Dashboard into
this file, so unpacked builds and the store version share one ID.

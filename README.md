# City of Tides

An asynchronous shared-world game for AlterU. Travellers arriving at different times enter the same tide-changing city, read one another's expiring traces, exchange limited aid, advance seasonal civic projects, and leave a small number of permanent anchors in the city's history.

- Production: https://game.aiwaves.tech/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f/
- GitHub Pages mirror: https://yinxinghuan.github.io/city-of-tides/

## Development

```bash
npm install
npm run dev
npm run build
```

The default MiniAPP and web entry is the asynchronous shared world. The production frontend and API are served together under the permanent game session ID at `https://game.aiwaves.tech/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f`. GitHub stores the canonical source and version history and publishes a frontend mirror from the same commit; the mirror uses the same production API and does not create a second shared-world database. Public shared-world writes remain a bounded beta until AlterU exposes a signed identity proof that custom game Workers can verify.

## Technology and notices

Original game design and implementation. React and related third-party license notices are distributed in `public/THIRD_PARTY_NOTICES.txt` and the built package.

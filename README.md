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

The default MiniAPP and web entry is the asynchronous shared world. The production frontend and API are served together under the game UUID path. Game-owned requests derive `API_BASE` as `"/" + GAME_ID`, so a Remix receives its own Worker and database when the generated game ID is replaced; no production env or source-game backend URL is embedded in the frontend. GitHub stores the canonical source and version history, but its Pages build is not an authoritative multiplayer runtime because GitHub cannot serve the same-Worker API path. Public shared-world writes remain a bounded beta until AlterU exposes a signed identity proof that custom game Workers can verify.

## Technology and notices

Original game design and implementation. React and related third-party license notices are distributed in `public/THIRD_PARTY_NOTICES.txt` and the built package.

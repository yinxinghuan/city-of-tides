# City of Tides

An open-world conversational adventure for AlterU. Seven years after leaving home, the player returns with a compass that points toward unfinished promises and a recording from their missing sister dated tomorrow. The main journey follows the search for Gate Zero across a city whose routes change with the tide; asynchronous player traces, shared aid, seasonal works and permanent anchors remain a supporting world layer.

- Production: https://game.aiwaves.tech/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f/
- GitHub Pages mirror: https://yinxinghuan.github.io/city-of-tides/

## Development

```bash
npm install
npm run dev
npm run build
```

The production frontend and API are served together under the permanent game session ID at `https://game.aiwaves.tech/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f`. GitHub stores the canonical source and version history and publishes a frontend mirror from the same commit; it does not create a second shared-world database. Public shared-world writes remain a bounded beta until AlterU exposes a signed identity proof that custom game Workers can verify.

## Technology and notices

Original game design and implementation. React and related third-party license notices are distributed in `public/THIRD_PARTY_NOTICES.txt` and the built package.

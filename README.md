# City of Tides

An asynchronous shared-world experiment for AlterU. Travellers arriving at different times can leave expiring traces, share limited aid, reinforce useful messages, contribute to seasonal civic projects, and leave permanent anchors in the city’s history.

Live production beta: https://game.aiwaves.tech/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f/

## Development

```bash
npm install
npm run dev
npm run build
```

The production frontend and API are served together under the permanent game session ID at `https://game.aiwaves.tech/1a2916b0-8751-4e5d-9f9b-92daf5f7c96f`. GitHub stores the canonical source and version history; it is not the production runtime host. Public shared-world writes are intentionally running as a bounded beta until AlterU exposes a signed identity proof that custom game Workers can verify.

## Technology and notices

Original game design and implementation. React and related third-party license notices are distributed in `public/THIRD_PARTY_NOTICES.txt` and the built package.

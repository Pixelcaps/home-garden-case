# ItpHomeGarden

This repository uses an [Nx Monorepo](https://nx.dev/) setup, feel free to add you frontend inside this repository or create a separate repository.

## Prerequisites

You have Node.js installed on your machine and ran:

```sh
npm install
```

## Run backend

To run the backend, you can use this command

```sh
npx nx dev api
```

Once it's running, you can check out the api specs at http://localhost:3000/docs

## How to add your frontend

You can use the [Nx Docs](https://nx.dev/docs/technologies) to add your frontend to this repository.
For example, to add Remix, run this:

```sh
npx nx add @nx/remix
npx nx g @nx/remix:app apps/web
```

After installation, you can run the web application using:
```sh
npx nx dev web
```

# todo-replicache-sveltekit-supabase

Multiplayer, offline-compatible TODO-MVC Demo with Supabase integration.

![sveltekit-replicache-demo](https://github.com/isaacHagoel/todo-replicache-sveltekit/assets/20507787/11b5ae10-049d-4cc7-82bf-45d8287701f0)

This project is based on the [todo-replicache-sveltekit](https://github.com/isaacHagoel/todo-replicache-sveltekit) repository by Isaac Hagoel. The main focus of this fork is to explore and implement the connection between Replicache and Supabase.

## Project Focus

The primary goal of this project is to demonstrate how to integrate Supabase as the backend database for a Replicache-powered application. This integration aims to combine the offline-first, real-time synchronization capabilities of Replicache with the powerful and scalable backend services provided by Supabase.

Key areas of focus include:
1. Adapting the existing Postgres-based backend to work with Supabase.
2. Implementing Replicache's sync protocol (`push`, `pull`, `poke`, etc.) using Supabase's API.
3. Leveraging Supabase's real-time capabilities alongside Replicache's offline-first approach.
4. Exploring best practices for authentication and authorization in a Replicache + Supabase setup.

## Replicache Documentation

For a quick overview of Replicache concepts, features, and resources, please refer to the [Replicache Documentation Summary](docs/replicache_summary.md) in this repository. This summary provides essential information about:

- Key features of Replicache
- Core concepts (Mutations, Subscriptions, Synchronization)
- Getting started guide
- Additional resources and community links

For more detailed information, visit the full [Replicache Documentation](https://doc.replicache.dev/).

## Comprehensive Replicache Reference

We have created a comprehensive Replicache reference document specifically for this project. You can find it at [docs/replicache_reference.md](docs/replicache_reference.md). This document includes:

1. Detailed introduction to Replicache
2. In-depth explanation of key features
3. Comprehensive coverage of core concepts
4. Step-by-step getting started guide
5. API reference overview
6. Advanced topics and strategies
7. Examples and use cases
8. Community and support information

This reference document serves as a valuable resource for understanding Replicache in the context of this project and can be particularly helpful when working on the Supabase integration.

## Original Project Description

This repository contains sample code for [Replicache](https://replicache.dev/). The example uses SvelteKit. The backend demonstrates implementations of `push`, `pull`, `poke`, `createSpace`, and `spaceExists` handlers, which are required for the Replicache sync protocol.

This is a port of [todo-wc](https://github.com/rocicorp/todo-wc), with a few minor additions. The frontend was ported from [svelte-todomvc](https://github.com/sveltejs/svelte-todomvc). It uses [svelte-sse](https://github.com/razshare/sveltekit-sse) for server-sent events.

[Play with the original app on render](https://todo-replicache-sveltekit.onrender.com/)

## What's Being Demonstrated Here?

This application extends the functionality of the normal [TODO MVC](https://todomvc.com/) app with the following additional properties:

1. Automatic syncing across tabs (even while offline).
2. Cross-browser and cross-device syncing when online, including when returning online after being offline.
3. Snappy user experience regardless of network speed or offline status, thanks to Replicache's optimistic updates and use of IndexedDB as a storage engine.
4. All the benefits of a Replicache-powered app, such as conflict handling, rebasing, rollbacks, and schema changes.
5. Space-based syncing, where each "space" (or list) is a separate syncing unit, allowing for granular permissions and data management.

### Minor Functionality Additions

1. A primitive "sync pending/all changes saved" marker.
2. A service worker to allow refreshing or navigating to an existing space in offline mode.

## Setup

#### Get Your Replicache License Key (it's free)

```bash
$ npx replicache get-license
```

#### Set Your `VITE_REPLICACHE_LICENSE_KEY` Environment Variable, Either in .env or in Your Terminal:

```bash
$ export VITE_REPLICACHE_LICENSE_KEY="<your license key>"
```

#### Install

```bash
$ npm install
```

## Start the Dev Server

```bash
$ npm run dev
```

## Contribution and Feedback

As we explore the integration of Replicache with Supabase, contributions, suggestions, and feedback are highly welcome. Feel free to open issues or submit pull requests to help improve this project.

## Acknowledgements

Special thanks to Isaac Hagoel for the original todo-replicache-sveltekit project, which served as the foundation for this Supabase-focused fork.

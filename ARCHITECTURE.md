# Todo App ARCHITECTURE

## Core Files

1. `src/lib/replicache/todo.ts`
   - Purpose: Defines the Todo data model and related types
   - Contains: `Todo` interface, `TodoUpdate` type, and `listTodos` function

2. `src/lib/replicache/mutators.ts`
   - Purpose: Defines mutator functions for modifying todo data
   - Contains: `createTodo`, `updateTodo`, and `deleteTodo` mutators

3. `src/routes/TodoList.svelte`
   - Purpose: Main Svelte component for the todo list UI
   - Contains: Replicache setup, todo list rendering, and user interactions

## API Endpoints

4. `src/routes/api/replicache/[spaceID]/push/+server.ts`
   - Purpose: Handles Replicache push requests
   - Contains: Logic to apply mutations to the server-side database

5. `src/routes/api/replicache/[spaceID]/pull/+server.ts`
   - Purpose: Handles Replicache pull requests
   - Contains: Logic to fetch changes from the server-side database

## Database and Real-time

6. `src/lib/supabase.ts`
   - Purpose: Sets up Supabase client for database and real-time functionality
   - Contains: Supabase client initialization

7. `src/lib/server/sse/poke.ts`
   - Purpose: Implements the "poke" mechanism for real-time updates
   - Contains: Function to notify clients of changes via Supabase

## Server-side Database Handling

8. `src/lib/server/db/data.js`
   - Purpose: Handles server-side database operations
   - Contains: Functions for CRUD operations on the database

9. `src/lib/server/db/postgres-storage.js`
   - Purpose: Implements Postgres-specific storage operations for Replicache
   - Contains: Methods for reading and writing data to Postgres

10. `src/lib/server/db/pg.js`
    - Purpose: Sets up and manages Postgres database connection
    - Contains: Database connection pool and transaction management

## App Flow

1. The app initializes with `TodoList.svelte`, setting up Replicache and rendering the UI.
2. User interactions trigger local mutations via Replicache mutators.
3. Replicache sends push requests to apply mutations on the server.
4. The server processes mutations and updates the Postgres database.
5. Replicache sends pull requests to fetch latest changes.
6. Real-time updates are facilitated by the "poke" mechanism using Supabase.
7. The UI updates reactively as changes occur.

This structure enables a real-time, collaborative todo app with offline support and eventual consistency across clients.
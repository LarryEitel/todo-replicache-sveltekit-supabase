# Setup Guide

This guide will walk you through setting up the todo-replicache-sveltekit-supabase project on your local machine.

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- Git
- A Supabase account

## Installation Steps

1. Clone the repository:
   ```
   git clone https://github.com/LarryEitel/todo-replicache-sveltekit-supabase.git
   cd todo-replicache-sveltekit-supabase
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up Supabase:
   - Create a new project in your Supabase dashboard
   - Note down your project URL and anon key

4. Create a `.env` file in the root directory of the project and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. Initialize the Supabase database:
   - Navigate to the SQL editor in your Supabase dashboard
   - Run the following SQL to create necessary tables:
     ```sql
     -- Create todos table
     CREATE TABLE todos (
       id UUID PRIMARY KEY,
       text TEXT NOT NULL,
       completed BOOLEAN NOT NULL DEFAULT FALSE,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
     );

     -- Create replicache_client table
     CREATE TABLE replicache_client (
       id TEXT PRIMARY KEY,
       last_mutation_id BIGINT NOT NULL
     );

     -- Create replicache_server_version table
     CREATE TABLE replicache_server_version (
       version BIGINT PRIMARY KEY
     );
     ```

6. Run the development server:
   ```
   npm run dev
   ```

7. Open your browser and navigate to `http://localhost:5173` (or the port shown in your terminal).

## Troubleshooting

- If you encounter any issues with Supabase connections, double-check your `.env` file and ensure the credentials are correct.
- Make sure your Supabase project has the correct tables as specified in step 5.
- If you're having trouble with Replicache, ensure you have the latest version installed.

## Next Steps

- Explore the [Architecture Documentation](ARCHITECTURE.md) to understand the project structure.
- Check out the [Project Roadmap](../ROADMAP.md) to see what features are planned.
- If you're ready to contribute, read our [Contribution Guide](../CONTRIBUTING.md).

For any additional help, please open an issue on the GitHub repository.
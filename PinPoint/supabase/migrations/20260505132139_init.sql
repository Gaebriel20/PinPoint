-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Users Table (extends auth.users)
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) for users
alter table public.users enable row level security;
create policy "Users can view their own profile." on public.users for select using (auth.uid() = id);
create policy "Users can update their own profile." on public.users for update using (auth.uid() = id);

-- Create a trigger to automatically create a public.user when an auth.user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create Notes Table
create table public.notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.notes enable row level security;
create policy "Users can view their own notes." on public.notes for select using (auth.uid() = user_id);
create policy "Users can insert their own notes." on public.notes for insert with check (auth.uid() = user_id);
create policy "Users can update their own notes." on public.notes for update using (auth.uid() = user_id);
create policy "Users can delete their own notes." on public.notes for delete using (auth.uid() = user_id);

-- Create Quizzes Table
create table public.quizzes (
  id uuid default uuid_generate_v4() primary key,
  note_id uuid references public.notes(id) on delete cascade not null,
  generated_questions jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Quizzes (accessible if the user owns the related note)
alter table public.quizzes enable row level security;
create policy "Users can access quizzes linked to their notes." on public.quizzes 
  for all using (
    exists (select 1 from public.notes where notes.id = quizzes.note_id and notes.user_id = auth.uid())
  );

-- Create Quiz Attempts Table
create table public.quiz_attempts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  score integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.quiz_attempts enable row level security;
create policy "Users can view their own attempts." on public.quiz_attempts for select using (auth.uid() = user_id);
create policy "Users can insert their own attempts." on public.quiz_attempts for insert with check (auth.uid() = user_id);

-- Create Quiz Answers Table
create table public.quiz_answers (
  id uuid default uuid_generate_v4() primary key,
  attempt_id uuid references public.quiz_attempts(id) on delete cascade not null,
  question text not null,
  user_answer text,
  correct_answer text not null,
  is_correct boolean not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Quiz Answers (accessible if the user owns the related attempt)
alter table public.quiz_answers enable row level security;
create policy "Users can access answers linked to their attempts." on public.quiz_answers 
  for all using (
    exists (select 1 from public.quiz_attempts where quiz_attempts.id = quiz_answers.attempt_id and quiz_attempts.user_id = auth.uid())
  );

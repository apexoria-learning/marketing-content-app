-- DATABASE.md §2: pgcrypto is the only required extension (gen_random_uuid()).

create extension if not exists pgcrypto;

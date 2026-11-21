-- DATABASE.md §4. YouTube content shapes: Shorts and long-form videos.
--
-- Enum value additions live alone in their migration (`alter type ... add
-- value` cannot share a transaction with statements that use the new value).
-- The platform_formats rows that use them ship in 0020.

alter type public.content_format add value if not exists 'short';
alter type public.content_format add value if not exists 'video';

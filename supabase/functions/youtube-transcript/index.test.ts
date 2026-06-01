import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractVideoId, extractPlaylistId } from "./index.ts";

Deno.test("extractVideoId: bare 11-char ID", () => {
  assertEquals(extractVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

Deno.test("extractVideoId: standard watch URL", () => {
  assertEquals(
    extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: youtu.be short URL", () => {
  assertEquals(extractVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

Deno.test("extractVideoId: youtu.be with query", () => {
  assertEquals(
    extractVideoId("https://youtu.be/dQw4w9WgXcQ?t=42"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: /shorts/ URL", () => {
  assertEquals(
    extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: /embed/ URL", () => {
  assertEquals(
    extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: /live/ URL", () => {
  assertEquals(
    extractVideoId("https://www.youtube.com/live/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: /v/ URL", () => {
  assertEquals(
    extractVideoId("https://www.youtube.com/v/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: watch URL with playlist param", () => {
  assertEquals(
    extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890abcdef"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: m.youtube.com mobile URL", () => {
  assertEquals(
    extractVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: music.youtube.com URL", () => {
  assertEquals(
    extractVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: youtube-nocookie embed", () => {
  assertEquals(
    extractVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ",
  );
});

Deno.test("extractVideoId: invalid URL returns null", () => {
  assertEquals(extractVideoId("https://example.com/foo"), null);
  assertEquals(extractVideoId(""), null);
  assertEquals(extractVideoId("not-a-url"), null);
});

Deno.test("extractPlaylistId: standard playlist URL", () => {
  assertEquals(
    extractPlaylistId("https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"),
    "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  );
});

Deno.test("extractPlaylistId: watch with list param", () => {
  assertEquals(
    extractPlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890abcdef"),
    "PL1234567890abcdef",
  );
});

Deno.test("extractPlaylistId: no playlist returns null", () => {
  assertEquals(extractPlaylistId("https://youtu.be/dQw4w9WgXcQ"), null);
});
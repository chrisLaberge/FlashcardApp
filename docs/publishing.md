# Publishing notes

The release steps are in [RELEASE.md](RELEASE.md). What is below is background.

## Pixabay (read from their license page and API documentation)
- Images can be used for free, commercially, without attribution. Modified or adapted use is allowed. Selling or distributing images **standalone** (no creative effort applied) is not.
- The API requires: cache results for 24 h (done in `/images/search`), no permanent hotlinking (we download, resize and store a copy: matches their guidance), and **show where results come from with a link to Pixabay** (added in this change).
- Default API limit is 100 requests per minute per key, shared by all users. Our per-user limit (30/min) does not protect that shared budget once there are many users. Ask Pixabay for a higher limit before launch, or add a global limiter.
- Images showing recognisable people or brands must not be used in immoral, illegal, misleading or (for brands) commercial ways. Safe search is on. Consider a "report this picture" option.
- The stored copies in the Cloud Storage bucket are publicly readable. They are used inside flashcards (creative effort), but anyone with a URL could fetch the raw files. Low risk; mention if you want it tightened.
- Source: pixabay.com/en/service/license (summary; "only the full Content License is legally binding") and an archived copy of the API docs. Read the full terms at pixabay.com/service/terms once before launch.

## Still open
- Western Armenian server voice: the MMS model is non-commercial (CC-BY-NC). Not usable in a commercial/published app without another licence or voice.
- `/tts` endpoint is documented in `backend-tts-endpoint.md` but not built or deployed.
- Not legal advice: have the policy checked if you can.

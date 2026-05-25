v27 Function Path Fix:
- Forces frontend publish calls to use /.netlify/functions.
- Prevents accidental netlify/functions path that returns HTML.
- Adds safer JSON parsing error messages.
- No changes to Meta OAuth, Cloudinary, publish-reel function, or queue logic.
